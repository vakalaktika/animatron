# Editable cloth deformation proof

- `cloth.svg`: authored editable source artwork.
- `cloth.png`: transparent three-times-resolution texture.
- `cloth.mci.json`: portable Rig 4 master with real bone-weighted deformation.
- `cloth.animatron.json`: importable Document 4 composition, four-second loop and zero tail.
- `build.py`: deterministic fixture rebuild using Pillow, with no network assets.

The texture's cuff and interior marks bend with the mesh rather than rotating as one rigid picture. The upper end stays pinned while the forearm changes angle. The fixture deliberately isolates the deformation feature from the family-scene visual benchmark.

Import the composition in the updated application, edit the forearm angle or sparse animation keys, save/reopen, and export. Retain the JSON master when making playback copies. Mesh weights and triangles are editable records in `cloth.mci.json`; this fixture does not imply a general mesh-painting workspace.

See `docs/mci-rig/deformation.md` for format limits, alpha/seam limitations, and evaluation details. Actual export and visual review evidence belongs with the completed application integration.
