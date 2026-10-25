# Adding an exact reference vehicle

A vehicle catalog entry and a reference asset are separate. Adding a catalog entry does not mean 3D support is verified. Do not reuse a different generation, hatchback, facelift, market specification or visibly different trim.

1. **Verify the identity.** In Administration → Vehicle catalog, add make, model, generation/body shape, year range, facelift, visibly relevant trim and market specification. Split entries when geometry differs. Used entries are immutable; add a new identity instead of rewriting a buyer's vehicle.
2. **Verify the asset and rights.** Obtain a permitted file directly from its creator/source. Record the exact source URL, creator, license name/version, commercial web/app distribution rights, attribution and limits. Confirm that publishing a downloadable GLB in a browser is permitted. Free download alone is insufficient. Do not approve an asset with unknown provenance or use rights. Maintain purchase or permission evidence privately if applicable; the app never buys assets.
3. **Inspect the geometry.** Compare body shape, lights, bumpers, grille, wheels, mirrors, visible trim and right-hand-drive layout against reliable Pakistan-spec references for each supported year. Record limitations. Do not call an approximate asset an exact match. Reject incompatible geometry.
4. **Prepare a GLB.** Export a self-contained, uncompressed glTF 2.0 GLB. Embed binary images using buffer views (no external/data resource URIs). Remove unused materials, animation and cameras. Preserve recognizable body geometry while optimizing. Core PBR is supported; required glTF extensions are rejected. Aim well below the 25 MB hard limit, ~100k triangles, modest texture sizes and a few materials for mid-range phones. No accessor may exceed one million entries. Inspect textures for privacy/licensing.
5. **Calibrate.** The app expects X = occupant's right, Y = up, Z = front. The config's `scale` and Euler `rotation` (radians) transform the asset's native coordinates into the viewer. Hotspot `position` and `normal` stay in the original asset-local coordinates and receive this transform. Camera positions and `target` are viewer-world coordinates. Center the car and scale it to roughly 4–5 world units long. The viewer's OrbitControls limit distances to 2–14 units. Preserve the asset-local frame between compatible versions.
6. **Configure stable areas.** Obtain the supported IDs from `/api/taxonomy`. Add hotspots and outward normals. Map mesh names to area IDs if meshes are usefully divided. For whole-body meshes, use hotspots instead. Supply camera overrides if the defaults do not frame this asset. Never simulate mechanical accuracy for the underside; its preset opens actual underbody photographs.

```json
{
  "scale": 1,
  "rotation": [0, 0, 0],
  "target": [0, 0.7, 0],
  "hotspots": [
    { "area": "mirror_right", "position": [0.9, 0.9, 0.5], "normal": [1, 0, 0] },
    { "area": "angle_rear_right", "position": [0.8, 0.8, -1.7], "normal": [1, 0, -1] },
    { "area": "engine_bay", "position": [0, 0.8, 1.4], "normal": [0, 1, 0] },
    { "area": "boot_interior", "position": [0, 0.8, -1.6], "normal": [0, 1, 0] }
  ],
  "meshes": { "RightMirrorMesh": "mirror_right" },
  "cameras": { "angle_front": [0, 1.8, 6], "angle_rear": [0, 1.8, -6] }
}
```

**These example positions are not vehicle calibration.** Replace them after inspecting your actual file. For a given area, map photographs only when that area is visibly shown. Photos associated with several areas reference the same stored file.

7. **Import as unapproved.** Administration → 3D assets & versions. Complete all provenance/rights/compatibility fields and import the GLB and config. The new version remains admin-only. Each import is immutable and auto-increments that catalog identity's version.
8. **Preview and test.** Use Preview & verify. Test mouse and touch rotation, pinch and scroll zoom, reset and camera framing. Check every hotspot at several rotations, including occlusion on the opposite side. Verify no accidental selection while dragging. Test GLB performance and accessibility fallback on target phones. Compare the actual visible body geometry, not the file's title, to the catalog identity. Check license terms manually; the app cannot automate legal or geometric approval.
9. **Approve only after verification.** Confirm the checklist in the preview dialog. New listings select the latest approved version. Existing listings, including unsupported ones, keep their previous asset ID (or null). This prevents importing a version from silently moving their markers or changing their model. Existing listing migration is intentionally not implemented: require an explicit migration with preview, seller confirmation and marker remapping in a future tool.
10. **Exercise the evidence flow.** Create a new private test listing for that identity. Upload permitted actual photos, label right mirror/rear-right/engine/boot and check each opens the corresponding upload. Leave an area missing and verify its honest empty state. Do not mix unrelated photos into a real seller listing. Publish only a legitimate listing with the seller's authorization.

On custom detail markers: seller → listing → Detail markers → Place a marker. Drag to rotate, then tap a surface. The ray hit is saved in the pinned asset's local coordinates along with the asset ID. Mark damage only as **Seller-reported damage**. Attach photos in the normal label editor. Unsupported vehicles use the standard taxonomy until a matching asset exists.

The live registry in SQLite stores source, creator, license, attribution, compatibility/limitations, byte size, config and approval per immutable version. Candidate research with no downloaded file is recorded separately in `asset-manifest.json`.
