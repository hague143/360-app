# Car-ad flow and reference access

The user requested a PakWheels-like car-ad entry flow around the existing browser 360 studio, with Google sign-in deferred and the studio maintained unchanged.

On 26 October 2026 (Asia/Karachi), attempts to read these official public pages failed at the execution environment's network proxy with `Tunnel connection failed: 403 Forbidden`:

- https://www.pakwheels.com/used-cars/sell
- https://www.pakwheels.com/used-cars/
- https://www.pakwheels.com/blog/how-to-post-an-ad-on-pakwheels/

These failures do **not** verify that a particular page exists or describe its current fields. The user was informed. No authenticated form, submission, exact layout, official model catalogue or live website audit is claimed. The implementation follows a conventional Pakistan car-classifieds flow with original CarView design and a manually curated starter make/model list; custom make/model/variant inputs remain available. It does not reproduce PakWheels branding or submit ads to that service.

The five-step flow covers location/car identity; specifications, price/features/description; ordinary ad photos plus the existing 360 module; seller contact; and a buyer preview. Required data is validated before a local-showroom ad can be saved. Buyers can search/filter/sort saved ads and inspect their photos/360, specifications and seller contact. Drafts, edits, sold status, deletion and portable HTML copies work locally without Google sign-in.

The original `downloads/CarView-Pakistan.html` is protected by SHA256 `56a9872dfd8072da85009535e585e496684f5bfb39584211cf8e927e198125cf`. The marketplace build checks that hash and embeds the source unchanged. A separate host wrapper adds sizing, an editor/buyer presentation and a narrow, token-checked `postMessage` snapshot bridge; it does not rewrite the studio's media, video or gesture code. Its sandboxed iframe has scripts/downloads/fullscreen but no same-origin privilege; the marketplace owns persistence. Existing standalone studio downloads remain available unchanged. The studio's own HTML export stays standalone.

This release continues the user's no-installation, no-cloud local HTML test context. “Save to showroom” affects the current browser's local showroom. It does not create a publicly hosted ad or verify phone ownership. Downloaded ad/backup HTML files include their photos, contact details and notes; data copies are isolated from the main workspace in browser storage. Public multi-user accounts, Google OAuth and hosting remain deferred.
