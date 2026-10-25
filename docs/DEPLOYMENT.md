# Deploying CarView Pakistan

## Why a Vercel-only import shows “Unexpected token … not valid JSON”

This repository contains two components: a Vite frontend and a persistent Express backend. Vite's `/api` and `/media` proxies only run during `npm run dev`. Building `dist/` and importing it as a Vercel static website deploys the UI without the backend. Requests such as `/api/me` then receive the hosting router's HTML or text 404 instead of JSON. The frontend now reports a service-unavailable message instead of showing the raw JSON parser failure; that message alone does not supply the missing backend.

The current database is SQLite and originals are private files on disk. A Vercel Function with `DATA_DIR=/tmp` is **not** a persistent deployment: instances do not share that database and it can disappear at any time. Adding an `api/index.js` wrapper or a catch-all rewrite to `index.html` does not solve this. Existing accounts and photographs must not be entrusted to such a workaround.

## Keep the existing Vercel URL (supported proxy configuration)

The repository now includes `vercel.json` and a Build Output API v3 generator (`scripts/build-vercel.mjs`). The Vercel frontend remains the same. It forwards both `/api/*` and `/media/*`, with their original paths, to a persistent backend. SPA URLs such as `/garage/new` and `/listing/...` fall back to the frontend **after** the API/media routes. No Vercel JavaScript Function buffers the original photos.

### A. Deploy the persistent backend

You still need one running backend. For the current SQLite/local-storage implementation, use the supplied Render blueprint with its paid persistent disk, or run the Docker image on an existing VPS with a persistent volume. If using Render, open New → Blueprint, select this repository and review the actual service/disk cost before creation. The blueprint asks for `APP_ORIGIN`; enter your exact Vercel production origin:

```text
APP_ORIGIN=https://360-app-three.vercel.app
```

Use your actual current Vercel domain if it differs. Keep `DATA_DIR` on the persistent disk. The backend's `/api/health` must return JSON `{"ok":true}` before connecting the frontend. The backend's own homepage is not the buyer-facing site in this topology.

### B. Connect it in Vercel

1. In the Vercel project, open **Settings → Environment Variables**.
2. Add `CARVIEW_BACKEND_URL` with the backend's actual HTTPS origin (e.g. the URL Render gives you). Do not enter the Vercel frontend URL, `/api`, a trailing path, credentials or an API key. This setting is an origin, not a secret token.
3. Apply it to **Production**. Only apply it to Preview if the backend's allowed origin is intentionally configured for that preview hostname; otherwise preview mutations will be rejected.
4. Deploy the commit containing `vercel.json`. The project uses `npm run build:vercel`, which builds the frontend and generates `.vercel/output/config.json` plus `.vercel/output/static/`. Disable any dashboard build/output override that forces a different command or serves `dist/` without the generated proxy routes.
5. **Redeploy after changing the variable**: proxy routes are generated at build time. Merely saving the variable does not change an already deployed build.
6. Open `https://360-app-three.vercel.app/api/health` (substitute your domain). It must return JSON `{"ok":true}`. Test `/api/catalog`, account registration, login/session cookies, private drafts, photo uploads, public display photos, private original downloads, and a direct listing URL through the Vercel site.
7. Restart/redeploy the backend and confirm accounts and photos survive. Never delete its persistent disk.

Until `CARVIEW_BACKEND_URL` exists, the generated API/media routes intentionally return JSON **503** with a service-unavailable message. This avoids the screenshot's raw JSON parser failure and makes the missing backend explicit in deployment logs. It does **not** simulate a working backend or claim login/uploads are ready. Invalid URLs or a proxy loop fail the build.

Verify Vercel's current external-rewrite upload/timeout limits against the photo batches and GLB sizes with a real deployment. The local tests verify generated routes, response handling, public-origin validation, and the application flows. A live split deployment remains unverified until a persistent backend is provisioned and connected. The current execution environment cannot directly fetch the user's `.vercel.app` domain because its network proxy denies that destination.

### Keeping everything inside Vercel Functions

A Vercel-only serverless backend instead requires a separate durable database and private object storage adapter, a serverless-compatible API, and direct-to-storage uploads that respect Function body-size limits. Those integrations and credentials are not supplied by importing the repository as a static Vite site. Pointing the current SQLite/filesystem backend at `/tmp` loses persistent/shared state and is not a fix. If you want that architecture, the database and storage must be selected/configured and the backend adapted before production use.

## Docker / VPS alternative

The root Dockerfile builds the frontend and installs production server dependencies in a Node 24 image. The image runs as the non-root `node` user and exposes port 3001. Persist `/var/lib/carview` and supply the public HTTPS origin:

```sh
docker build -t carview-pakistan .
docker volume create carview-data
docker run -d --name carview --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  -e APP_ORIGIN=https://YOUR-PUBLIC-DOMAIN \
  -v carview-data:/var/lib/carview carview-pakistan
```

Use an HTTPS reverse proxy in front. For a bind-mounted data folder instead of a named volume, provision its ownership so the non-root container user can write to it. Back up SQLite and its private objects consistently; do not expose the data directory or backups publicly. The app is designed for one server instance with local SQLite. Multiple independent instances need shared database/object storage first.

## Verifying this fix

`npm test` includes original app workflows plus hosting response parsing, generated external/fallback routes, invalid-backend and loop rejection, SPA fallback, and public-origin checks. `npm run test:browser` also simulates the screenshot’s plain-text hosting 404 and checks that the user sees a clear message and can recover using Retry once the real API returns. Generated configurations were additionally accepted by Vercel’s official `@vercel/routing-utils` validator. These local validations do not establish that a backend has been deployed for the user.

The optional Docker image build could not complete in this workspace because the isolated image builder could not access the npm registry, including after supplying the existing proxy configuration. Docker image readiness is not claimed. Native Node installation/build and the API/browser suites were executed successfully; the Render blueprint uses that native Node workflow.
