# Deployment

## Recommended for the existing Vercel site: Supabase

The repository supports a real Vercel Node API plus Supabase PostgreSQL/private Storage. **No Render service is required.** Follow [the Supabase setup guide](SUPABASE.md), run [`supabase/setup.sql`](../supabase/setup.sql), enter the server-only Vercel variables and redeploy.

The root `vercel.json` builds both the frontend and `api/index.mjs`. A frontend-only Vite deployment causes the earlier “Unexpected token … not valid JSON” error because `/api/*` returns a hosting error page. A catch-all rewrite to the homepage or a temporary `/tmp` SQLite database does not provide a persistent backend.

The client now handles non-JSON gateway errors safely. That error handling is not a substitute for configuring the real database and storage. Unconfigured serverless requests fail with JSON 503; a configured `/api/health` returns `{"ok":true}`.

## Optional single-server / local-storage deployment

The original SQLite + private local-file workflow is still available with `CARVIEW_MODE=local` outside Vercel. It requires one persistent server/disk. The optional Render blueprint (`render.yaml`) uses a **paid** persistent disk; review the service/disk price before approving its creation. No service is created by repository files alone. It can serve both frontend/API at one HTTPS origin using `npm start`.

For Docker/VPS, the supplied Dockerfile builds the frontend and production Node dependencies. Persist `/var/lib/carview`, supply the exact public `APP_ORIGIN`, terminate HTTPS at a reverse proxy and never expose the data directory. The non-root container user must be able to write to the mounted volume. Back up SQLite and its private objects together. Multiple independent SQLite instances do not share state; use Supabase mode for serverless instances.

The optional Docker image build could not complete in this workspace because its isolated builder could not reach the npm registry. Image build readiness is not claimed; native Node builds and the SQLite, PostgreSQL and browser workflows are validated separately.
