# Boundaries and persistence

- `catalog`: exact vehicle identities (make/model/generation/body shape/years/facelift/trim/market).
- `assets`: immutable reference GLB versions linked to catalog, with provenance/license/attribution, transform, cameras, hotspot normals/positions and mesh associations. Manual approval required.
- `listings`: owner account, selected catalog identity, explicit pinned asset version or null, vehicle details, private/published state and unavailable-area list.
- `photos`: one private original and two faithful metadata-free derivatives per upload; seller note and ordering. The original is never overwritten by derivative generation.
- `photo_areas`: many-to-many associations between one stored photo and stable taxonomy IDs or custom marker IDs. No file duplication for multi-label assignments.
- `photo_spins` / `spin_frames`: persistent photo sequence settings and ordered references to existing photos. Uploads are assembled automatically; a seller confirms sequence order and, with 12+ frames, a complete lap before looping. Partial sequences never wrap. Editing frames or deleting a source photograph invalidates the confirmation. Confirmed frame membership can satisfy the publishing confirmation requirement without inventing physical part labels.
- `markers`: listing-specific label/damage declaration, approved asset version, and local position. Version-specific positions never silently migrate.
- `users` / `sessions`: salted password hashes and hashed expiring session identifiers. Roles cannot be assigned through public registration.

SQLite enforces core foreign keys, uniqueness and cascade deletion. Taxonomy/custom-area validation is performed at the API boundary because area IDs span static standard IDs and listing-specific detail markers. The initial idempotent schema lives in `server/migrations/001_initial.sql`. `schema_migrations` records local versions 1–3 (photo-spin and direct-upload tables); future changes need explicit forward migration logic.

The local storage adapter is responsible for generated object keys, private writes, reads and deletion. The HTTP layer separately decides whether the requester can access a photo. Original downloads require the listing owner, even after publishing. A published photo derivative can be read anonymously; unpublishing immediately requires ownership for subsequent reads. Responses use private/no-store caching to avoid a shared CDN retaining newly private photos. Existing public recipients can still have saved copies; revoking already downloaded data is impossible.

Multer bounds input sizes; Sharp decodes the actual image, enforces pixel/frame limits, honors orientation and strips metadata in derivatives. Original bytes stay untouched. Upload processing failure cleans up generated objects. A synchronous database transaction rechecks the listing's photo limit after asynchronous processing. Multi-label updates are transactional. Database and filesystem writes are not a distributed transaction; restore/backup both together. Interrupted processes can leave orphan objects; production operators should schedule reconciliation, not expose the private directory.

Three.js is imported only for approved assets or administrator previews. Its renderer does not receive uploaded photos and cannot project, blend or reconstruct them. Business logic owns area selection; the GPU layer only maps surfaces/hotspots and camera commands. Mouse/touch orbit and zoom come from OrbitControls; a movement threshold suppresses taps during rotation. Hotspot outward normals plus ray intersections suppress points on the far side. GPU resources and observers are released on unmount. Photo dialogs are sibling components, so closing a photo does not recreate the viewer or reset the camera.

Only self-contained GLB 2.0 core assets are accepted. Resource URIs are rejected recursively; no arbitrary URLs or remote textures are loaded. Approval remains a trusted operator action requiring actual source/rights/geometry inspection. The app cannot prove a model is correctly licensed or geometrically accurate merely from metadata.

No external account, cloud bucket, AI model, payment provider or API integration is simulated. The image and GLB objects in automated tests are explicitly non-photographic/non-vehicle fixtures and exist only in disposable temporary storage.

The `PhotoSpin` component displays individual metadata-free display copies in sequence. There is no compositing, projection, interpolation, synthesis or new geometry. It works independently of Three.js and approved assets. Only immediate neighbor images are preloaded to limit mobile data/memory use. Seller confirmation is an explicit self-report; a minimum frame count is a capture guideline, not proof of angular coverage.


## Supabase/Vercel mode

`server/postgres.js` is an asynchronous PostgreSQL adapter with bound parameters, a dedicated private `carview` schema, strict TLS and request-scoped transaction clients using AsyncLocalStorage. API handlers await database operations and transactions. `server/runtime.js` selects it plus `SupabaseStorage` in cloud mode; local SQLite remains available outside Vercel. The Function entry explicitly requires cloud mode and never silently uses `/tmp`.

`server/direct-uploads.js` grants owner/admin-scoped upload tickets. Browser originals go directly to private Storage, then the API downloads and validates/decodes them before writing metadata and faithful display copies. PostgreSQL locks the listing quota during completion and records idempotent ticket results. Unprocessed objects are not media. Cloud reads redirect to short-lived private signed links only after application authorization.

`supabase/setup.sql` creates the private schema, RLS and bucket guard. Database credentials/server keys remain server-only. The app uses its existing scrypt/session authentication, not Supabase Auth. Hosted verification needs the user's project/schema/environment configuration.
