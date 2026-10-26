# CarView Pakistan

A functional inspection MVP: sellers upload a walk-around sequence and the app automatically assembles a draggable/swipeable photo view. They can also label visible parts and angles and publish a shareable inspection page. Buyers select an area and see its actual uploads. React + TypeScript + Vite, Express 5, SQLite, Sharp, and a lazy-loaded Three.js GLB viewer.

**The photo-based 360 view works without a 3D asset.** It shows only actual uploaded frames. It does not generate unseen angles, scan the car or reconstruct a 3D mesh.

**Optional reference-3D asset limitation:** no exact vehicle 3D asset has been approved or included. All five supplied source pages returned network-proxy HTTP 403 during research. Creator, download availability, license and Pakistani geometry could not be verified. The app explicitly shows **“3D model not yet supported.”** and provides an original, generic 2D schematic and a searchable parts/angles interface. The schematic is visibly labelled, is not a 3D substitute, and makes no vehicle-geometry claim. The real GLB import, preview, approval, rotation and hotspot pipeline is implemented and tested using isolated non-vehicle test geometry. Exact-model visual acceptance remains blocked pending a suitable licensed asset.

No stock, AI-generated, or unrelated photographs are used as evidence. The default Corolla demonstration has no photos, is labelled as a demo, and is not an advertisement. Its vehicle details and price are illustrative.

## Car-ad marketplace: no installation

[Download the car-ad marketplace](https://github.com/hague143/360-app/raw/refs/heads/main/downloads/CarView-Pakistan-Marketplace.zip), extract it and open **CarView-Pakistan-Marketplace.html**. It adds a five-step car-ad form, gallery photos, seller contact, buyer preview, searchable/filterable local showroom, drafts, editing/sold/deletion and portable ad/backup HTML copies. Google sign-in is deferred. The existing photo/video 360 studio is embedded as a separate module without changing its source or media/gesture logic; the build verifies its SHA256. Saved standalone 360 HTML files can be imported into an ad.

The marketplace uses a dark neon showroom with lime/cyan accents, a concept-car hero, cursor-driven depth, a working glow switch, hover lighting and raised buttons/cards. The hero artwork is explicitly decorative AI-generated studio art, not listing evidence, and is embedded for offline use. Motion is reduced for touch devices and disabled when the user requests reduced motion. The embedded studio receives only host presentation colours; its protected standalone source and photo/video/gesture behavior remain unchanged.

This remains the local, no-account browser test the user requested: showroom ads are stored on the current device, not publicly hosted. Downloaded copies contain the selected ad's media/contact details; a full backup includes all drafts/ads. See [the reference-access and flow notes](docs/CLASSIFIEDS-FLOW.md) for the blocked PakWheels audit, design scope and preservation boundary. Build with `npm run package:marketplace`; validate the extracted package with `npm run test:marketplace` (FFmpeg is used only to create a developer test clip).

## Standalone 360 studio: no installation

[Download the browser edition](https://github.com/hague143/360-app/raw/refs/heads/main/downloads/CarView-Pakistan-Browser.zip), extract it, and double-click **CarView-Pakistan.html** in Chrome or Edge. It works directly at `file://`, offline, without Node.js, npm, a server, a cloud account or external libraries/fonts. The standalone [HTML source](downloads/CarView-Pakistan.html) is the complete runnable app.

This small edition offers **Photos** and **Video** sources. Upload up to 120 real photos in numeric filename order, or select a parked-car walk-around video, trim one lap and extract 36/72/120 frames entirely in the browser. MP4/H.264 is recommended; other codecs depend on browser support. Videos are limited to 500 MB/3 minutes. Extraction samples the selected interval with an exclusive end, commits the new sequence only after success, preserves the old sequence on cancel/error, and requires confirmation before replacing existing photos. It does not infer camera angles, stabilize/alignment-correct footage or verify full-lap coverage; steady capture at consistent height/distance matters.

The viewer supports one-finger rotation, anchored two-finger pinch and mouse-wheel zoom, double-click zoom, **Inspect details** panning, rotation while zoomed, fit/reset, keyboard/slider/playback/full-screen controls, thumbnail reordering/removal, optional manually confirmed 12+ frame looping and car details/notes. Select 1600px display copies to save space or 2560px before importing for more detail; zoom is 1–6x and cannot reveal detail missing from the source. This is a captured-photo object spin, not a reconstructed 3D scene or invented unseen views.

It uses browser IndexedDB for local persistence where available and reports storage failures. **Save HTML copy** embeds photos/video-derived frames and details into another runnable HTML file, so it can be backed up or opened in a fresh browser without the original video or browser storage. No media is shipped in the empty edition or sent to a server. Online accounts, public listings and server/3D features belong to the full application below.

The ZIP includes only the HTML and a short Roman Urdu guide. Regenerate it with `python scripts/package-browser.py`; validate the extracted HTML with `npm run test:browser-file`. Tests cover uploads, storage/reload, mobile gestures, portable HTML exports and unavailable-storage fallback with external networking offline. Where administrator policy blocks `file://` in the test browser, the harness reports the limitation and serves unchanged HTML through a document-only HTTP fixture; native file-origin execution is not claimed in that environment.

`npm run test:browser-media` also checks the packaged edition with a real locally generated H.264 test-pattern clip: preview, trim validation, cancelled-import safety, 72 decoded timestamps, exclusive end, manual loop confirmation, reload/export beyond 60 frames, 2560px photo detail, desktop pan/rotate/fit/wheel controls, actual two-finger mobile pinch/pan and corrupt-video recovery. FFmpeg is a developer-only fixture generator; users do not install it.

For a ready-filled browser example, [download the AI photo demo](https://github.com/hague143/360-app/raw/refs/heads/main/downloads/CarView-AI-Demo.zip), extract it and open `CarView-AI-Demo.html`. It embeds twelve generated views of a fictional white sedan and labels them as AI demo content. To test uploads yourself, [download the twelve original AI test PNGs](https://github.com/hague143/360-app/raw/refs/heads/main/downloads/CarView-AI-Test-Photos.zip), select all images in the `Photos` folder, then confirm full-lap looping. The photo ZIP includes provenance, intended approximate directions and SHA256 hashes. Frame geometry, size and angular spacing can vary; these are synthetic test inputs, not real listing/condition photographs or a measured 3D scan. Regenerate and validate the small demo ZIP through the app's actual browser upload/export flow with `npm run package:ai-demo`; the original PNGs are preserved unchanged.

## Download-and-run full local app

[Download the local-test ZIP](https://github.com/hague143/360-app/raw/refs/heads/main/downloads/CarView-Pakistan-Local.zip), extract the complete folder, and install **Node.js 24 LTS**. On Windows double-click `START-WINDOWS.cmd`; on macOS/Linux use the matching starter or run `npm run local`. Read `READ-ME-FIRST.txt` for the short Roman Urdu guide.

The ZIP includes the prebuilt frontend and full source. The first launch installs the correct production dependencies for your operating system and needs internet; later starts reuse them. The launcher serves only this computer, opens the browser, and stores accounts/photos in the extracted folder's `.data`. It forces local mode and needs no cloud account or API key. Keep the launcher window open while testing. Node modules, private data, real credentials and Git metadata are not included. Native Windows execution is not claimed; the launcher is tested on Linux and its Windows wrapper uses standard Node/cmd commands.

For a source checkout, run `npm ci` and `npm run build` before `npm run local`. To regenerate the downloadable ZIP after building, use `python scripts/package-local.py`.

## Deploy on Vercel with Supabase

The frontend **and** API now run on Vercel, with Supabase PostgreSQL and private Storage providing durable accounts/photos. No Render backend is required for this mode. Follow [the Supabase setup guide](docs/SUPABASE.md): create a project, run [`supabase/setup.sql`](supabase/setup.sql), add server-only settings in Vercel and redeploy. A static frontend import alone does not configure those services. Never use a temporary Function filesystem as the database.

## Run locally

Requires **Node.js 24+** and npm. No external credentials or services are needed for the local SQLite mode.

```sh
cd /workspace/360-app
npm ci
npm run dev
```

The frontend runs on port 5173 and proxies the API on port 3001. `/api/health` returns `{"ok":true}`. Use the existing checkout; a cloud task is already isolated and does not need a Git worktree.

1. Select **Sell your car**, create an account (password: at least 10 characters), and select **Add a car**.
2. Enter the catalog identity and listing details; save the private draft.
3. Upload your actual JPEG, PNG or WebP photographs. Select each photograph and confirm one or more labels. Add optional notes, reorder with drag/drop or arrow buttons, and mark unavailable checklist areas.
4. Preview the inspection page. Publishing requires at least one photograph. Each photograph must either have a manually confirmed part/angle label or be included in a seller-confirmed photo sequence.
5. Publish, then copy the listing URL. Other users can see display derivatives but cannot access your originals or modify your listing. Unpublish to make it private again.

`.env.example` documents configuration. Environment values must be exported by the host (the scripts do not implicitly load a `.env` file). Data defaults to `.data/carview.sqlite` and `.data/private/`. Both are ignored by Git. Vercel mode uses Supabase instead. Local mode uses the filesystem; Supabase mode uses PostgreSQL/private Storage. Browser localStorage is never the database.

## Automatic photo walk-around / 360 view

Open a listing in My garage → **360 photo view** → **Add photos**. Capture the parked car in one continuous direction, keeping the entire car in frame, with roughly the same camera height and distance. Aim for 12–24 exterior photos (one every 15–30°). Keep engine/interior/damage close-ups in the separate parts gallery.

The app naturally sorts selected filenames, uploads in safe batches of six, stores each original once and automatically assembles an interactive preview. Use drag/swipe, the slider, keyboard arrows, zoom and full-screen controls. Drag thumbnails or use arrow buttons to correct the sequence; existing library photos can be reused without reuploading.

Check the order and confirm the sequence. With at least 12 photos, the seller may additionally confirm that they cover one complete continuous lap and enable a 360 loop. This is a seller declaration, not automatic verification of angle coverage. With fewer photos or a partial lap, navigation stops at the last uploaded frame. No missing image or intermediate angle is synthesized. Two to four arbitrary photos cannot provide unseen sides.

Confirm, publish, and share the listing URL. Buyers get this photo view by default, even when no licensed 3D reference asset exists or WebGL is unavailable. Photo sequence configuration and ordering persist in SQLite. Editing the sequence or deleting one of its source photos clears its confirmation and loop status; check it again before buyers see it as a confirmed sequence. Removing a frame from a sequence keeps its original in the photo library. Deleting a photo from the library removes the stored original and derivatives as before.

## Commands and validation

```sh
npm run build         # strict TypeScript check and production frontend build
npm test              # API/database/storage/security workflow tests
npm run test:browser  # build first; uses /usr/bin/chromium by default
npm run test:supabase # real disposable PostgreSQL + Storage SDK HTTP fixture; requires Docker
```

Set `CHROMIUM_PATH` to your installed Chromium/Chrome executable when necessary. Browser tests serve the built app with production headers using a temporary database and ephemeral port; no running development server is required. Tests remove their accounts, fixtures, originals and databases afterward. Screenshots are written to ignored `test-results/`. The generated test images are plain geometric color fixtures, not car photographs. The GLB test fixture is a triangle explicitly labelled **TEST GEOMETRY — NOT A VEHICLE** and is never imported into the live demo.

Validated behaviors include 12-frame automatic photo-spin assembly across batches, numeric filename ordering, draggable/mobile swipe navigation, partial-sequence boundaries, confirmed loop wrapping, publish validation and deletion invalidation, as well as authentication, private drafts/media, decoded upload validation, original-byte preservation, stripped metadata and correct orientation, multi-area associations, publishing, ownership denial, persistent data/sessions after restart, immutable asset pinning, admin-only operations, photo zoom, mobile bottom sheets, GLB loading, mouse/touch rotation, scroll/pinch zoom, reset, orientation preservation and WebGL fallback. No exact vehicle model is claimed to have passed visual verification.

## Create an administrator

There is no default admin password or public admin registration. An operator with server access creates a new administrator:

```sh
read -rs -p 'New admin password (14+ characters): ' ADMIN_PASSWORD
export ADMIN_PASSWORD
npm run create-admin -- admin@example.com
unset ADMIN_PASSWORD
```

The password is read from the environment, hashed with scrypt, and never logged. The command refuses to overwrite or elevate an existing account. Sign in with the new account and open **Administration**. See [the asset onboarding guide](docs/ADDING_VEHICLES.md) before approving a model.

## Production on a single host

```sh
npm ci
npm run build
NODE_ENV=production APP_ORIGIN=https://your-carview-host.example DATA_DIR=/persistent/carview npm start
```

Terminate HTTPS at a trusted reverse proxy and forward to port 3001. `APP_ORIGIN` must be the exact public origin, without a trailing slash. On Render, its injected `RENDER_EXTERNAL_URL` is used when `APP_ORIGIN` is not explicitly set. Production cookies are Secure, HttpOnly and SameSite=Lax. Configure an appropriate request body size (at least 26 MB for asset imports, up to 61 MB for batch image requests), request timeouts, connection limits and IP throttling at the proxy. Never publish the data directory as static files. Install/start should run as a non-root account with a private writable data volume. Local database schema is in [migration 001](server/migrations/001_initial.sql), [photo-spin migration 002](server/migrations/002_photo_spins.sql) and [direct-upload migration 003](server/migrations/003_direct_uploads.sql), applied idempotently on startup. Supabase is initialized with its separate SQL setup file. Existing listings and uploads are preserved.

The `LocalStorage` adapter writes private files with generated keys for one persistent server. The `SupabaseStorage` adapter stores the same originals/derivatives in a private bucket, with PostgreSQL metadata and authorized short-lived signed delivery. Supabase mode supports independent Vercel Function instances. Uploaded originals bypass the Function request-size limit via scoped direct-upload tickets. No original-object URL is public by default. See [cloud setup](docs/SUPABASE.md) for the data model, private bucket guard, TLS settings and operational limits.

Back up SQLite and its WAL consistently (SQLite backup API or a stopped service), together with the private object directory. Restrict backups as they contain private originals and password hashes. Test restores. `schema_migrations` records the applied version; add explicit forward migrations for later schema changes. Processes and network connections do not survive environment snapshots; restart the app in new tasks.

## Security and integrity

- Passwords use salted scrypt hashes; session tokens are random, hashed in SQLite and expire after seven days. Signing out invalidates the session.
- Every listing/photo/marker mutation checks ownership. Admin-only routes check the live account role. Drafts are owner-only; even an administrator has no implicit original-photo access.
- Mutations require a same-origin custom header and validate the browser Origin. CORS is not enabled. React escapes seller text; production has Helmet security headers and a restrictive CSP.
- Images: up to 6 per request, 10 MB each, 40 million pixels, 60 per listing. Actual decoding, not claimed MIME alone, determines validity. Single-frame JPEG/PNG/WebP only. Safe UUID storage names, private originals, metadata-free thumbnails/display copies. Auto-orientation and proportional resizing are the only transforms; no retouching or reconstruction. Originals are retained byte-for-byte.
- GLB: admin-only, 25 MB limit, GLB 2.0 header validation, JSON/geometry limits and no resource URIs or required extensions. Only self-contained core GLB is supported. Admins must additionally inspect geometry, texture sizes, mobile performance, ownership/license and exact match before approval. See asset guide.
- Registration/login rate limits are per process; use shared gateway rate limiting before broad public launch. Supabase upload tickets additionally enforce durable account-level pending/recent limits, and completion locks the listing row before checking the photo quota.

## Scope and remaining work

Complete local flows: automatic upload-to-photo-spin assembly with manual order/loop confirmation, buyer inspection, seller accounts/drafts/upload/mapping/notes/reordering/replacement/deletion/preview/publishing, catalog management, versioned asset imports and manual approvals, custom detail/damage markers on approved models, and resilient photo navigation without WebGL.

Before a public launch: procure and verify exact licensed Pakistan-spec assets, manually calibrate their hotpots and cameras, test on physical target phones, set up HTTPS/persistent volumes/backups/monitoring and abuse controls. Hosted Supabase/Vercel live verification is pending project configuration. Email verification/password recovery, contact messaging, image moderation/virus scanning and Urdu translations are not implemented. English strings are concentrated in the presentation layer and taxonomy; they have not yet been extracted to a translation catalog. Asset configuration uses validated JSON rather than a visual mesh editor. Existing listing versions cannot be silently migrated; an explicit audited migration tool is future work.

Photo coverage is never a condition score, authenticity check, ownership proof or inspection certification. Photographs can be old or misleading; arrange an independent inspection.
