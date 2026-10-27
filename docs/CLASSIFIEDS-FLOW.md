# Car-ad flow and reference access

The user requested a PakWheels-like car-ad entry flow around the existing browser 360 studio, with Google sign-in deferred and the studio maintained unchanged.

On 26 October 2026 (Asia/Karachi), attempts to read these official public pages failed at the execution environment's network proxy with `Tunnel connection failed: 403 Forbidden`:

- https://www.pakwheels.com/used-cars/sell
- https://www.pakwheels.com/used-cars/
- https://www.pakwheels.com/blog/how-to-post-an-ad-on-pakwheels/

These failures do **not** verify that a particular page exists or describe its current fields. The user was informed. No authenticated form, submission, exact layout, official model catalogue or live website audit is claimed. The implementation follows a conventional Pakistan car-classifieds flow with original CarView design and a manually curated starter make/model list; custom make/model/variant inputs remain available. It does not reproduce PakWheels branding or submit ads to that service.

The five-step flow covers location/car identity; specifications, price/features/description; ordinary ad photos plus the existing 360 module; seller contact; and a buyer preview. Required data is validated before a local-showroom ad can be saved. Buyers can search/filter/sort saved ads and inspect their photos/360, specifications and seller contact. Drafts, edits, sold status, deletion and portable HTML copies work locally without Google sign-in.

The original `downloads/CarView-Pakistan.html` is protected by SHA256 `56a9872dfd8072da85009535e585e496684f5bfb39584211cf8e927e198125cf`. The marketplace build checks that hash and embeds the source unchanged. A separate host wrapper adds sizing, an editor/buyer presentation and a narrow, token-checked `postMessage` snapshot bridge; it does not rewrite the studio's media, video or gesture code. The iframe runs only this trusted, hash-verified module, never imported HTML. It allows same-origin scripts, native confirmation dialogs, downloads and fullscreen: browsers otherwise suppress the studio's video-replacement confirmation. The marketplace owns persistence; a self-removing host setup prevents duplicate child storage without appearing in native standalone exports. Existing standalone studio downloads remain available unchanged. The studio's own HTML export stays standalone with its normal persistence.

This release continues the user's no-installation, no-cloud local HTML test context. “Save to showroom” affects the current browser's local showroom. It does not create a publicly hosted ad or verify phone ownership. Downloaded ad/backup HTML files include their photos, contact details and notes; data copies are isolated from the main workspace in browser storage. Public multi-user accounts, Google OAuth and hosting remain deferred.

The neon UI revision adds a dark lime/cyan showroom, embedded decorative concept-car artwork, cursor-driven perspective, a scene-glow switch and raised cards/buttons. Artwork is AI-generated and labelled as a concept/studio illustration, separate from all actual ad media. The new effects affect presentation only; the original studio SHA and all listing/media state behavior remain protected. Touch layouts avoid pointer tilt and reduced-motion preferences disable decorative motion. Assets are embedded so the HTML remains offline-capable.

## Purple/pink showroom and complete ad media (27 October 2026 PKT)

The hero uses an original procedural black Land Cruiser 2026-inspired model and locally bundled Three.js, with no external assets or requests. It is a stylised illustration, not verified Toyota geometry. Automatic rotation can be paused, respects reduced motion and cleans up GPU resources when leaving the home page; WebGL failure shows a local SVG fallback. The standalone direct release is one self-contained HTML; the previous separate PNG is no longer required.

Ad media now includes an optional original playable video (maximum 50 MB), plus all gallery photos and all studio frames. The trusted studio bridge sends selected video Files to the host and reads export Blob.text() instead of fetch(blobURL), removing an unnecessary file-origin dependency. It never changes the protected source. A clip only selected for playback can be published without frame extraction; generating a spin still requires Create photo view. Larger studio clips can produce frames but are not stored as original playable videos. Invalid replacements preserve previous media. Older saved ads without video remain compatible.

Buyer previews and listed/copy ads expose separate Photos, walk-around and Video tabs. Frames are not truncated at 20 and gallery uploads no longer hide access to studio frames. Tests check actual image decoding, visible viewer rotation, original video bytes and playback in preview/listed/export/reload, not just DOM thumbnail counts. Managed browser policy blocks file:// here, so unchanged artifacts use offline HTTP fixtures; native Windows file-origin execution is not claimed.

## Actual photo home showcase (27 October 2026 PKT)

The procedural vehicle is removed from source/build. The home box accepts 1–24 local JPG/PNG/WebP files through the existing checked decoder/display-copy pipeline. Its photo angles, playback, swipe/drag, thumbnail selection, keyboard navigation and ordering use actual uploaded display copies. Four press images remain a photo-angle showcase; full-lap mode requires 12+ images plus explicit confirmation and still cannot infer unseen sides or consistent geometry. Source colour/background is not changed.

The user supplied white and silver Lexus press previews; the four white previews have varying backgrounds and include LX600/LX500d variants, so they are not a continuous orbit of one stationary car. Their actual binary files were unavailable: the initial archive exceeded the 32 MiB tool transfer limit; Drive/Google/Lexus requests hit the environment's 403 proxy block; inline images were visible to the model but not present as file resources or workspace images. No imitation photo is substituted. The empty distribution has no Lexus image assets. The user selects originals directly in the HTML once and saves a self-contained app copy, avoiding another chat attachment round trip.

Showcase data lives in an optional versioned `showroom` field separate from seller ads. Old saved copies default to an empty showcase. Reload, ad/backup export and the home Save app copy retain the selected display copies; a saved app copy starts at the home page. Exports include their existing ads/contact just as the prior backup did. Import commits only fully decoded batches, preserving the old showcase on failure. The protected 360 source, original frame/video import and buyer controls stay unchanged.

## Supplied Koenigsegg GLB display model (27 October 2026 PKT)

The user then supplied an accessible 3.49 MB ZIP containing Blender, FBX and OBJ versions of a Koenigsegg model. Its actual geometry is converted to a 1,435,628-byte GLB, with five source mesh objects and seven portable PBR materials. The material finish is pearl white; no model mesh is synthesized. Blender opens the file with script autoexec disabled. Three isolated tiny outlier triangles outside the body are removed to correct camera framing. Asset provenance records source/output hashes and the absent author/licence document; no asset licence or exact manufacturer geometry is asserted.

The home page defaults to this embedded model, using bundled Three.js GLTFLoader/OrbitControls, automatic orbit, direct pointer orbit, pinch/wheel/button zoom, reset and reduced-motion support. Offscreen/hidden animation is paused and disposal releases observers, geometry/materials, environment and the WebGL context. A captured poster of the same supplied model is shown on WebGL failure. No external buffer, texture, font, script or decoder request is needed.

The separate Photo angles workflow and every existing seller/buyer media feature remain. `showroom.display` switches between model/photos without deleting the other mode's data. Old copies with selected photos infer photos mode; new empty state defaults to model. Portable HTML copies automatically include model/library/poster bytes plus the selected showroom/ads. The protected standalone studio hash is unchanged.

Validation includes exact model-byte hash, real mesh loading/visible canvas, automatic orbit and pause, pointer orbit, zoom/reset, mobile two-finger pinch and static fallback with WebGL disabled, followed by the existing photo/video/import/publish/export/reload suite. Native file:// remains blocked by managed browser policy, so unchanged packaged HTML uses permitted document-only offline HTTP fixtures.
