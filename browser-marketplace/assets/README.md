`neon-hero.png` is a legacy AI-generated decorative concept-studio illustration created with OpenAI image_gen for the earlier lime/cyan UI. It is not a listing photograph, a real vehicle identity or condition evidence. The original PNG is preserved without pixel edits, but is no longer included or required by the current build.

The Photo angles mode uses only locally selected photographs through `../hero-photos.js`. The procedural vehicle has been removed. No Lexus photographs, recoloured photos or generated replacement angles are bundled in the empty distribution. Selecting photos and saving an app copy embeds the checked display copies in that HTML. Actual ad media remains separate from the decorative home showcase.

## Supplied Koenigsegg model

`agera.glb` is converted from the user's `82-koenigsegg-agera.zip` archive, not generated vehicle geometry. The archive has Blender/FBX/OBJ versions but no texture images, author or licence document; [agera-provenance.json](agera-provenance.json) records exact source/output hashes and does not assert a commercial or redistribution licence. The original source archive is not copied to this repository.

Conversion uses the `.blend` with Blender auto-execution disabled. Only Body/FR/FL/RL/RR are exported; cameras, lights, animation, scripts and extras are excluded. Three tiny isolated triangles at world X≈25 (outside the car at X±9.4) are removed, correcting an inflated bounding box. Remaining car geometry stays in place. Legacy shaders become explicit PBR materials, with pearl-white bodywork. The GLB embeds its binary buffer, has no external URI/image/decoder dependency and uses only KHR_materials_clearcoat.

To reproduce with Blender 4.3.2 and the original matching-hash source:

```sh
blender --background --factory-startup --disable-autoexec --python scripts/prepare-agera.py -- /path/to/uploads_files_2792345_Koenigsegg.blend /tmp/agera.glb
```

`agera-poster.webp` is a capture of the actual GLB in the local Three.js viewer, used when WebGL is unavailable. It is a model rendering, not an original vehicle photograph. The renderer/library/model/poster are embedded into the generated HTML for offline use.
