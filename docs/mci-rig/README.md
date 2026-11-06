# Mid-century Ink rig contracts

- [Rig 4: persistent controls, shared PNG parts and raster bending](mci-rig-v4.md) and [schema](mci-rig-v4.schema.json).
- [Rig 3: native sparse tweens](mci-rig-v3.md) and [schema](mci-rig-v3.schema.json).
- [Rig 2: raster attachments and replacement drawings](mci-rig-v2.md).
- [Rig 1: rigid vector skeletons](mci-rig-v1.md).

The updated application reads all four. Rig 3 requires an updated application revision; plugin installation does not deploy it. Existing contracts, SVG protections and image budgets remain enforced. Shared runtime and the application use matching timing functions.
# Mid-century Ink Rig 1 in Animatron

The shared skeletal-animation contract Animatron, Agent Torres and the Mid-century Ink generator exchange.

- `mci-rig-v1.md` — the contract (authoritative; keep in step with the other tools).
- `mci-rig-v1.schema.json` — JSON Schema for the file shape.
- `mci-rig-core.cjs` — the shared, dependency-free reference runtime. Animatron's engine (`src/app/components/motion-studio/engine/rig.ts`) is a TypeScript port; `rig.test.ts` checks it against this file.
- `example-character.mci.json` — the cross-tool fixture.
- `validate-rig.cjs` — `node docs/mci-rig/validate-rig.cjs file.mci.json` runs legacy Rig 1–3 structural checks. Use the application-backed controls CLI for Rig 4.

In the studio, drop a `.mci.json` onto the canvas (or pick it with the picture tool). The rig arrives as a layer with its bones, bindings, slots, animations and metadata intact; "Save rig" writes them back out as `.mci.json`.
