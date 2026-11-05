# Illustrated scene pipeline

Source audit: 2026-11-04, Animatron baseline `0998d30`, Mid-century Ink backend release `pluginrel_6aec0bed0654819181bf277b9ad75164` (1.6.0), Composer `pluginrel_6aec0e82ecf88191837a64a3a451ceae` (0.4.4). Owning editable plugin inventories were checked against the installed packages before copying them into `plugins/`. These source snapshots preserve the original manifests, artwork authorities and identity records. This branch becomes the reviewable source for the upgrades; packaged updates must trace to its commit and PR.

## Audit and architecture

| Capability | Existing implementation | Change and ownership |
| --- | --- | --- |
| Artwork | Rig 1 accepts a restricted inline SVG, semantic direct-child groups, paths and curves; finished contours need not follow projected primitives. | MCI: illustration first; retain volumes as construction aids. Separate treatment, setting richness, finish and motion choices. |
| Skeletons | Parent/local affine bone frames, rest bindings, joint limits, CCD IK, slots, baked linear/hold tracks, default poses, per-view rigs. | Reuse this engine for rigid illustrated attachments. No replacement renderer or deformation framework. |
| Sprites | Inline images, SVG and built-in characters already work as independent clips. | App: Rig 2 explicitly extends the rig contract to attach validated PNG parts to existing SVG groups and bones. |
| Layering | Document clips and SVG group order provide paint order; bindings wrap groups in bone transforms. | Preserve group order and original transforms. Plan contact and foreground overlaps before rigging. |
| Masking | Rig SVG is deliberately restricted; arbitrary SVG filters, scripts, external references and masking features are not an illustration escape hatch. | Preserve protections. Author window/bird occlusion with foreground shapes or separated artwork. No general masking feature claimed. |
| Replacements | Existing tools move alternate head/eye drawings off canvas. | App: explicit registered drawing sets and held drawing keys; keep legacy parking rigs playable. |
| Deformation | Rigid bones and articulated splits; no skinned mesh. | No mesh bending claimed or introduced. Add only for a demonstrated future need with editable fixture and round-trip proof. |
| Motion | One shared clock; rigs, clip hierarchy, travel paths, keyframes, easing, IK and baked gait/contact tools. | Reuse; head perspective changes require drawings; props share the hand's bone frame. |
| Camera | Stage framing, clip transforms and hierarchy can compose restrained movement. | No dedicated camera/depth system added. Use grouped transforms/parallax sparingly. |
| Timing | Composition ends one second after latest enabled clip; looping clips restart independently. | App: optional `timeline.tailSeconds` (0–60) makes the tail explicit; absent remains one second. Looping benchmarks use zero tail. |
| Sharing | Self-contained compressed hash up to 60,000 characters; optional hosted short links. | Keep importable JSON even over link budget; do not upload assets as an implicit part of making examples. |
| Exports | Shared React stage and clock produce SVG/HTML snapshots, GIF, MP4/WebM and generated React code. | Test new artwork through the same stage and export path. Retain masters separately from optimized playback copies. |
| Reduced motion | Main editor avoids autoplay when system preference requests less motion; gallery hover previews did not consult that preference. | App: make gallery previews respect reduced motion, verify explicit Play remains possible. |
| Composer validation | Studio import/repair/share harness; stdout RESULT can exceed process buffers and terminate before draining; reported duration cannot ignore the automatic tail. | Composer: bounded result files, subprocess failure checks, honest repaired/lost-content errors and actual engine timing. |

The corgi weakness is primarily artwork/workflow: primitive volume projection was treated as final illustration. A new renderer would not repair its silhouettes, faces, clothing or staging. Rig 2 addresses an actual format gap while authored contours, poses and complete settings address visual quality.

## Acceptance checklist

- [x] Locate actual current source and preserve compatibility boundaries.
- [x] Record architecture, performance/security constraints and implementation ownership.
- [x] Art-first MCI workflow and reusable environment/prop/contact guidance; preserve distinct authorities and approval records.
- [x] Rig 2 raster attachments and explicit replacement drawings, safe budgets, Rig 1 regression tests.
- [x] Explicit zero-tail loop timing with legacy default and invalid-value tests.
- [x] Composer large-result, failure and duration regression checks.
- [x] Two finished, self-contained illustrated editable scenes, with stills, rigs, compositions and rendered previews.
- [x] Inspect representative frames, head/blink transitions, hand/plane contact, layer order and visual/motion loop seams separately.
- [x] Import → pose/edit → save → reopen → export evidence, reduced-motion behavior and old-format/security regressions.
- [ ] Versioned packages, changelogs, source commit and PR; no application publication/deployment.

## Migration, security and resource constraints

Rig 1 remains readable with unchanged transforms and parked replacements. New fields belong to explicit Rig 2, not a silent reinterpretation of Rig 1. Existing composition version 2 remains compatible; older readers ignore `timeline`, so a zero-tail scene on an old deployed application acquires its legacy one-second tail. New Rig 2 files require this upgraded app; opening URLs must identify this limitation until deployment is approved.

Embedded PNGs require payload validation, finite placement, bounded decoded dimensions and aggregate resource limits; external URLs and SVG `<image>` markup remain forbidden in rig SVG. Do not weaken the SVG allowlist to permit arbitrary raster imports. Raster attachment editing is rigid affine posing, not pixel painting or mesh deformation. A flattened illustration needs supervised separation, concealed-area reconstruction and useful-size seam review before rigging.

Keep editable vector/rig masters. Any optimized copy must preserve sampled transforms, drawing states, timing and visible artwork. Technical validation and visual inspection are separate evidence; neither grants user approval or creates identity records.

## Evidence and access

Dependencies installed using the repository lockfile. Timeline tests first reproduced seven failures, then passed all eight after implementation. Reduced-motion clock tests reproduced two failures before correction; the injected image-node budget test reproduced a failure before enforcing the unchanged total element limit. Independent review found and fixed the whole-document 4 MB bypass and scene-combination loss of Rig 2 fields.

Final verification:

| Check | Actual result |
| --- | --- |
| `npm test` with selective V8 coverage | 48 files, **596 tests pass**. Measured new rig/timing/clock/preview surface: 88.85% statements, 83.45% branches, 100% functions, 96.89% lines. This is scoped coverage, not an assertion about whole-repository coverage. |
| `npm run build` | PASS, Next 16.4.5 production static build, TypeScript and precache generation. |
| Composer capture/cache/rig/validator tests | **9 pass**; large result transport, nonzero status, edited-source cache, invalid SVG/import, placement, zero tail and stale link removal. |
| Composer fake short-link tests, browser disabled | **11 pass, 3 preview-card tests skipped**. Fake backend only; no production shares created. Card auto-install was interrupted when unavailable in the restricted test environment; video/still exports were separately verified in the app harness. |
| MCI scene/slim/packaged validator tests | **2 pass**; Rig 2 fields/IDs/visibility preserved, source immutable, optimizer preserve-only, packaged validator path corrected. |
| Legacy/new MCI examples | **27 rigs pass** shared structural validation. |
| Finished benchmark fixtures | **6 pass**: rigid contact across 193 samples, explicit drawing states, window bounds, raster payloads, save/reopen, positional and velocity loop continuity checked separately. |
| Composer on three finished compositions | All **PASS**; exactly 8.00 seconds, 0.00 tail; two vector URLs fit (26,010 / 24,749 characters), layered URL exceeds 60,000 budget and has no link. |
| Actual app rendering/export | Three **8-second MP4s**, native-size representative PNG frames; Chrome **156.0.8078.80**. PNG parts decoded and rendered with alpha and registration. |
| Built app browser journey | **PASS**: layered JSON import → drawing change → bone pose → autosave → reload → Save rig/Download JSON; preserved two PNG attachments, drawing key, pose, zero tail. Reduced-motion project arrival stayed paused; explicit Play remains available. No page exceptions. Screenshots inspected at 1440×1000 and 390×844. |
| Dependency audit | Final clean installation reports **0 vulnerabilities**. Updated vulnerable Next/Sharp and pinned browser tooling. Lockfile includes platform-native optional packages after npm's incremental-cache omission was reproduced and repaired. |

The local Node 24.6 runtime completed tests/builds but npm warns that current jsdom's supported engines are Node 22.22.2+, 24.15+ or 26+. Use a supported runtime for new developer environments; CI's current Node 22 line is suitable. No global configuration or credentials were changed.

Visual observations, exact files, renderer qualifications and missing-reference limitations are recorded in `examples/illustrated-scenes/README.md`. Private full plugin snapshots are local only; the public PR carries reviewed update overlays, while unchanged private reference art remains in existing plugin releases.

Task attachments are absent from the conversation payload. The bundled Detailed primary paper-airplane reference and adult crops are available and were viewed directly by the artwork worker; Original historical reference images were also inspected. Direct comparison with the requested bicycle and bedtime attachments remains blocked; no substitute image becomes a new style authority.
