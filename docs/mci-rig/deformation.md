# Registered raster deformation in Rig 4

This is a small fixed-topology linear-blend skinning feature. It bends an existing, validated PNG attachment under bone influences. It is not automatic part separation, a general mesh editor, vector path deformation, or a change to SVG import permissions.

## Contract

Rig 4 may contain `meshes`, at most eight entries:

```json
{
  "id": "sleeve-mesh",
  "rasterId": "sleeve-paint",
  "vertices": [
    { "x": 40, "y": 80, "weights": [{ "boneId": "upper", "weight": 1 }] },
    { "x": 340, "y": 80, "weights": [{ "boneId": "forearm", "weight": 1 }] },
    { "x": 40, "y": 180, "weights": [{ "boneId": "upper", "weight": 1 }] }
  ],
  "triangles": [[0, 1, 2]]
}
```

`rasterId` names one existing `rasterAttachments` entry, whose `svgId` still identifies its registered bound group and paint order. A raster can be driven by only one mesh. Each mesh has 3–128 vertices, 1–256 triangles, and 1–4 positive bone influences per vertex. Vertex weights must total one within `1e-6`; duplicate bone influences are rejected. Triangle indices must name distinct existing vertices, and rest triangles must have nonzero area.

Vertex positions use the rig's rest-canvas coordinates and must lie inside the registered PNG rectangle. These same coordinates define the texture mapping. This first version has no independent UV editor. The PNG's dimensions, alpha, byte/pixel limits, structural checks, and data-URL requirements remain the existing raster contract. The rig's overall byte budget also remains in force.

## Evaluation and drawing

For each influence, transform the rest vertex by `posedBoneWorld × inverse(restBoneWorld)` and sum those positions using the stored weights. This cancels the rest transform and retains the original artwork at rest, including bones with rotated or offset rest frames. No previous-frame state is required.

The renderer replaces the registered raster's ordinary rigid group at the same paint position. Do not wrap the mesh in a second bound-bone transform: the skinned vertices already contain all bone-world transforms. Registered drawing visibility continues to apply to the entire mesh group.

Each triangle uses an affine transform of the same validated texture, clipped by a programmatically generated polygon. Images, use references, and clip paths created by this renderer are not accepted from imported SVG markup. A small 0.15 rest-pixel triangle overlap reduces internal antialias cracks. Keep important semitransparent marks away from shared triangle boundaries: overlapping semitransparent paint can accumulate alpha. Collapsed posed triangles are hidden, and extreme folds can still overlap or invert. Prepare and visually review the intended pose range.

## Editable proof

`examples/deformation-proof/cloth.mci.json` is a self-contained portable Rig 4 with 35 rest vertices, 48 triangles, a transparent painted cloth texture, and two influencing bones. Its four-second sparse animation bends the forearm, holds, and returns to rest. `cloth.animatron.json` places it in Document 4 with no automatic tail.

`cloth.svg` is the editable source illustration. `build.py` and Pillow rebuild its equivalent transparent PNG, fixed mesh, rig, and composition without network assets. This is a technical fixture, not an approved Mid-century Ink character/style reference.

Change the forearm angle or its sparse key timing through the rig editor. Mesh topology/weight records remain explicit and editable in the master JSON; any weight interface must write these same records and preserve normalization. Reopening/exporting must retain the mesh, original PNG, bindings, and animation.

## Verification boundaries

Focused tests cover non-rigid vertex movement, pinned and blended regions, rest registration, JSON round trip, affine maps, live pose/drawing visibility, collapsed triangles, unsafe image rejection, and malformed/budgeted geometry. Actual application export and useful-size frame review are separate release checks; unit tests alone do not establish seam quality, browser performance, or user approval.
