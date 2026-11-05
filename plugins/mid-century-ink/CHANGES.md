# Mid-century Ink 1.7.1 — illustration fidelity correction

- Require actual generated artwork when demonstrating preservation of generated illustration quality. Rasterized code-drawn SVGs remain attachment fixtures, not evidence of Detailed style fidelity.
- Compare complete face construction, anatomy, hands and silhouette against the actual anchor before rigging; record visual shortcomings separately from structural PASS.
- Review generated clean plates, transparent extractions and registered head replacements for drift. Inspect rebuilt stills and joints, including foreground cuff/neck overlaps.
- Describe layered editability precisely: part poses, drawing replacement and timing are editable; internal painted strokes are not vector paths. Retain source art separately from playback derivatives.
- Existing Original/Detailed authorities, saved characters and approval records remain unchanged. The generated Sunroom glider candidate and application proof live in the owning Animatron PR.

# Mid-century Ink 1.7.0 — illustrated scene pipeline

- Art direction and a finished illustration precede rig finalization. Rich settings work in both Original and Detailed; construction volumes remain optional aids, not mandatory finished contours.
- Preserved existing treatment authorities, identity anchors and approval records. New scene characters remain invented, unapproved examples.
- Rig 2 supports validated embedded PNG attachments and registered held drawing changes. Rig 1 and parked drawing assets remain readable. No mesh deformation is claimed.
- Scene combination prefixes and retains raster registrations/drawing tracks; Rig 2 slimming preserves artwork and motion exactly instead of applying the legacy line simplifier.
- Corrected the packaged validator's shared-runtime path. Validation reports structure separately from browser image decoding and visual review.
- See `skills/mid-century-ink/references/illustrated-scene-production.md` and the versioned rig contract. Finished benchmark sources live in the owning Animatron PR under `examples/illustrated-scenes/`.

# Mid-century Ink 1.6.0: consolidation of Claude 1.5.0 and ChatGPT 1.3.14

## Files

| File | Change |
|---|---|
| `SKILL.md` | Rewritten as one shared core. From ChatGPT: treatment selection (Original default, Detailed only when chosen), Detailed anchors and face crops, whole-cast rule, continuity, reusable characters, lettering/palettes, core brief, prompt scaffold. From Claude: the full output-workflow list (3D, movement study, performance rigs, figures, gaits, walks with rolling feet, scenes, ropes, motion, slim), 3D-first and one-view-per-head defaults, Face construction. Reconciled: face rules now govern placement for both treatments (feature forms come from the treatment); the eye line turns with a deliberate head tilt; palette rule is ChatGPT's (keep accepted series palettes) instead of "always fresh"; host-specific tool rules moved to adapters. |
| `references/hosts/claude.md`, `references/hosts/chatgpt.md` | New host adapters (tools, image attachment, Node availability, Animatron hand-off). |
| `references/style-presets.md`, `detailed-*.md`, `detailed-target.json`, `character-continuity.md`, `lettering-and-palettes.md` | Added from ChatGPT, unchanged. |
| `references/style-guide.md` | ChatGPT version (treatment routing, character-specific noses, continuity checks). Claude's version had no content beyond it. |
| `references/svg-and-rigs.md` | ChatGPT version plus Claude's 3D-first step 0, treatment routing for vector inputs, and treatment-specific review inputs. |
| `references/3d-construction.md` | New section 7 "Treatments in 3D" (proportions, eyes, nose, hair, ink per treatment); `eye` mark documented; proportions line no longer assumes Original. |
| `scripts/figure.mjs` | New `eye` surface mark for Detailed faces: shaped light area, directed pupil kept inside the opening, tapered upper lid; foreshortens with the head. Existing marks unchanged. |
| `scripts/render.mjs` | View rigs record `metadata.treatment` (default `classic-graphic`). |
| `scripts/scene.mjs` | Refuses members drawn in different treatments; records the scene's treatment. |
| `scripts/slim.mjs` | Keeps `metadata.treatment`. |
| `examples/dot/dot-model.mjs`, `examples/pip/pip-model.mjs` | Marked `classic-graphic` and labeled as pipeline demos, not anchors. |
| `examples/scenes/leash/build-leash-roll.mjs` | Creates its output folder; comment no longer points to a SKILL.md section that does not exist. |
| `assets/detailed-primary-scene-v1.jpeg`, `detailed-selected-man.png`, `detailed-selected-older-woman.png`, `icon.svg` | Added from ChatGPT (hashes match `detailed-target.json`). |
| `assets/retired/` | Mockup 06 and party/hearth sources moved here with a README, so they cannot be mistaken for active anchors. |
| Rig 1 contract, schema, core, validator, fixture, design-system workflow | Byte-identical to both sources. Rig format/version unchanged. |
| Manifests | Claude `.claude-plugin/plugin.json` and ChatGPT `plugin.json`, `.codex-plugin/plugin.json`, `agents/openai.yaml` kept separate; both releases 1.6.0. |

## Validation

- All local Markdown links and asset paths resolve; 35 JSON files parse; every script passes `node --check`.
- All 25 bundled `.mci.json` rigs pass `validate-rig.cjs`.
- Dot and Pip turnarounds regenerated: every SVG byte-identical to 1.5.0; rigs differ only by `metadata.treatment`.
- Leash example run end to end: Dot 359.453, Pip 359.452 (same as 1.5.0), leash seam 0.00, slim 190,602 → 107,234 characters; all outputs validate.
- Detailed test bust (front, 30°, 60°, profile) rendered with the new `eye` marks; eyes foreshorten and track correctly. It is a mechanics test, not a style match to the primary scene.
- `scene.mjs` refuses a Detailed + Original cast and accepts a single-treatment cast.
- The Animatron studio's own rig import (through animatron-composer, offline cached studio) accepts a Detailed rig with `metadata.treatment` and the slim leash scene.

## Not verified

- No raster generation was run for either treatment; the ChatGPT image-tool path is unchanged guidance.
- A full Detailed character (body, hair groups, nose construction) has not been built and compared with the primary scene.
- Animatron app round trip in the browser (import, pose, playback, save/reopen, export) was not run; only the studio's import code was.
- The ChatGPT package was assembled from its 1.3.14 manifests but not installed in ChatGPT.
