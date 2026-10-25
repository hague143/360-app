# Vercel + Supabase deployment

Vercel runs the frontend **and** the Node API Function in `api/index.mjs`. Supabase provides the durable PostgreSQL database and a **private** object bucket. A separate Render server is not required for this mode. Local development can still run SQLite/local files without external credentials.

This integration uses Supabase **PostgreSQL and Storage**. The app keeps its existing seller-password/session authentication; accounts live in `carview.users`, not in Supabase Auth's Users screen. Browser code never receives the database URL or service/secret key.

## 1. Create a project and initialize the database

1. Create a project at https://supabase.com/dashboard. Select a suitable free plan/region and save the database password securely. Check the provider's current quotas; storage/egress/database limits and idle-project pausing apply.
2. Wait until the project is ready.
3. In **SQL Editor → New query**, paste the contents of [`supabase/setup.sql`](../supabase/setup.sql) and run it once. The script is idempotent: it creates the private `carview` schema, relationships, initial catalog/demo and upload-ticket table, with RLS enabled. Existing rows are preserved when run again.
4. Check **Storage** for the bucket **`carview-private`**. It must remain **private**. The script sets a 25 MB per-object limit and installs a restrictive guard that prevents anonymous/authenticated direct access to this bucket, even if some unrelated bucket has a broad permissive policy. Other buckets and their policies are preserved. Server-issued signed upload/download URLs remain the intended access path.
5. This starts a new cloud database. Existing local SQLite data/files are not automatically copied or deleted. If they contain real data, plan a deliberate migration before switching users to cloud mode.

Do not enable public access, create a public-read policy, disable RLS, or use a publishable/anon key as a substitute for the server credentials.

## 2. Add server-only environment settings to Vercel

Open the existing Vercel project → **Settings → Environment Variables**. Add the following for **Production**:

| Name | Value / where to find it |
| --- | --- |
| `CARVIEW_MODE` | `supabase` |
| `SUPABASE_URL` | Your project's HTTPS Project URL (Settings → Data API; dashboard labels may vary). |
| `DATABASE_URL` | **Connect → Transaction pooler** PostgreSQL connection string, with the database password supplied. Prefer the IPv4-compatible pooler for Vercel. The database user usually includes your project reference. URL-encode special characters when inserting the password. |
| `SUPABASE_SECRET_KEY` | A server **secret** key from the project's API Keys settings. A legacy `service_role` key is also supported; use this variable or `SUPABASE_SERVICE_ROLE_KEY`, not a publishable/anon key. |
| `APP_ORIGIN` | The exact production website origin, e.g. `https://360-app-three.vercel.app`, without a trailing slash or path. |

Optional settings:

- `SUPABASE_STORAGE_BUCKET`: defaults to `carview-private`. If customized, prepare an equivalent private bucket/guards first; the SQL setup uses the default name.
- `SUPABASE_DB_CA_CERT`: if the database TLS chain needs the project's CA, copy the CA certificate from Supabase's database SSL configuration. PEM with real newlines or literal `\n` separators is supported. Database TLS verifies the server certificate. Do not disable certificate checking or set `NODE_TLS_REJECT_UNAUTHORIZED=0`.

These are **server environment values**, never `VITE_*` variables, frontend source, Git files, screenshots or chat messages. You may share the non-secret Project URL, but enter the database URL/key/password only in Vercel's secure environment editor.

`CARVIEW_BACKEND_URL` from the previous external-backend approach is no longer used for this Vercel configuration. It can be removed. Do not point API requests back at the frontend through a proxy loop.

Production and Preview are separate deployments. Only add credentials to Preview if you intentionally want that environment to access this project, and set its exact `APP_ORIGIN`. Prefer an isolated database/project for development/preview. The production origin is not implicitly a wildcard permission for preview hostnames.

## 3. Redeploy the repository

1. Use the latest `main` commit from `hague143/360-app`.
2. Use Node **24.x**. Root `vercel.json` declares both builders: the Vite static build and the Node API Function. Its `/api/*` and `/media/*` routes precede the SPA fallback.
3. Remove old dashboard overrides that force a frontend-only build/output directory. The explicit builder configuration is authoritative; the static builder runs `npm run build` and publishes `dist/` alongside the API Function.
4. **Redeploy after adding/changing variables.** Saving a value does not update an already deployed Function.
5. Open `https://YOUR-VERCEL-DOMAIN/api/health`. It must return `{"ok":true}`. Initialization checks both the PostgreSQL schema and private bucket. Missing/inaccessible configuration returns JSON 503 and never silently creates a temporary SQLite database.
6. Open `/api/catalog`, then the homepage. Create a seller, upload actual car photos, confirm a walk-around and publish. Check the buyer page in a private browser window.
7. Trigger another Vercel deployment and verify the same account/listing/photos are still present. Durable data lives in Supabase, not the Function filesystem.

If `/api/health` returns 503, inspect Vercel Function logs and check the settings above, project availability, database password/pooler URL, SQL setup, TLS CA and private bucket. The public response deliberately does not print secrets or internal connection details. Fix the prerequisite and retry; do not repeatedly recreate the project or duplicate credentials without diagnosing the failure.

## Large photo uploads and private delivery

Vercel Functions have a request body-size limit. The browser therefore uploads originals **directly** to private Supabase Storage using a server-authorized, object-scoped signed upload URL. Only small JSON grant/completion requests pass through the Function. This supports the app's 10 MB photo and 25 MB GLB limits without proxying those raw uploads through a Function.

Each grant belongs to an authenticated owner (or an administrator for assets). Completion rechecks ownership and file size, actually decodes/validates the uploaded object, preserves the original bytes and generates metadata-free display/thumbnail copies. Unprocessed uploads stay private and are never served as photos. Completed grants are idempotent; invalid objects are rejected/removed. Authenticated account-level ticket limits and the final per-listing quota are checked in PostgreSQL.

Photo/media requests still go through the app's ownership/published-state checks. After authorization, the Function redirects to a private object URL that expires after 60 seconds. Original downloads require the owner even on published listings. A previously issued link can remain valid until its short expiry, and recipients can save already downloaded data; unpublishing blocks new links but cannot recall copies.

The application completion window is 15 minutes. Supabase's underlying signed upload link has its own provider-defined lifetime (commonly two hours). Do not treat the app window as cancellation of an already issued Storage token. Abandoned uploads remain private. Schedule periodic cleanup of expired ticket objects after the signing lifetime has elapsed, and reconcile storage/database backups before a broad public launch. A killed Function may leave a processing ticket/orphan object; retry with a fresh upload rather than assuming the original was published.

For administrators, GLB files also use the direct-upload flow. They remain unapproved until licensing, exact vehicle compatibility, hotspot calibration and preview tests are explicitly confirmed. Supabase does not validate geometry or photographs' authenticity for the app.

## Administrator account

The same operator-only `npm run create-admin -- admin@example.com` command works with `CARVIEW_MODE=supabase` and the server settings in your **local trusted process environment**. Supply `ADMIN_PASSWORD` securely (14+ characters), then unset it. The command refuses to overwrite/elevate an existing account. Do not put passwords or a bootstrap admin endpoint in the browser or public API.

## What has and has not been verified

- The original local SQLite/image/browser workflows remain tested.
- `npm run test:supabase` uses real disposable **PostgreSQL 17**, executes the setup script twice, tests schema/storage RLS against a deliberately broad test policy, ownership, direct-upload completion, invalid images, metadata removal, original preservation, admin GLB versions and persistence across a fresh API/database client instance.
- Storage HTTP calls use the **actual Supabase SDK** against an explicitly labelled local HTTP contract fixture. The fixture is not represented as a hosted Supabase project.
- A browser test uploads a real decoded, non-photographic test image larger than 4.5 MB directly, then confirms/publishes its photo sequence, verifies public display/private-original access and mobile operation. API request bodies stay small. No test creates fake vehicle advertisements or leaves fixtures in the demo.
- Your hosted Supabase/Vercel integration cannot be called verified until you create the project, run SQL, enter the server-only settings and exercise the live flow. Free-plan availability/quotas are provider-controlled.
