# Mid-century Ink Rig 1 in Animatron

The shared skeletal-animation contract Animatron, Agent Torres and the Mid-century Ink generator exchange.

- `mci-rig-v1.md` — the contract (authoritative; keep in step with the other tools).
- `mci-rig-v1.schema.json` — JSON Schema for the file shape.
- `mci-rig-core.cjs` — the shared, dependency-free reference runtime. Animatron's engine (`src/app/components/motion-studio/engine/rig.ts`) is a TypeScript port; `rig.test.ts` checks it against this file.
- `example-character.mci.json` — the cross-tool fixture.
- `validate-rig.cjs` — `node docs/mci-rig/validate-rig.cjs file.mci.json` runs the structural checks on any rig, including one saved from Animatron.

In the studio, drop a `.mci.json` onto the canvas (or pick it with the picture tool). The rig arrives as a layer with its bones, bindings, slots, animations and metadata intact; "Save rig" writes them back out as `.mci.json`.
