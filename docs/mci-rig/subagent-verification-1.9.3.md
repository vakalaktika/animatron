# Mid-century Ink 1.9.3 — subagent implementation verification

Validated 2026-11-12 in local Codex. Final package: **1.9.3**. The current private 1.9.2 release was read through Plugin Creator and its complete archive downloaded. Every one of its 141 files matched the installed cache byte for byte. This was the baseline, not a recreation.

## Scope and source changes

The shared SKILL.md, its entire “Delegate large jobs to subagents (a model per task)” section, and Workflow step 7 are unchanged. Step 7 already references the independent reviewer.

Exactly three package files changed:

- `skills/mid-century-ink/references/hosts/chatgpt.md`: correct authorization guidance; document actual model/effort overrides, fresh-context forks, concurrency, file ownership and independent rendered review. It follows the running interface rather than assuming universal Chat/Work/Codex capabilities.
- `plugin.json`: version only, 1.9.2 → 1.9.3.
- `.codex-plugin/plugin.json`: synchronized version only.

The other **138 files are byte-identical**, with no additions or deletions. All style/treatment rules, artwork references, character assets, scripts, approved examples and approval workflows remain unchanged. `file-comparison.json` inventories every before/after SHA-256; `release-changes.diff` shows the complete source delta.

The existing public Animatron repository deliberately tracks plugin update overlays and excludes full private snapshots. Its prior tracked manifest version is 1.9.0. This release PR tracks only the three overlay files plus this verification report; it does not backfill private artwork or alter its older shared core. The complete installable archive derives from the authenticated private 1.9.2 baseline plus the committed overlay.

## Actual runtime capability and assignments

Official documentation read: [OpenAI subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

Actual mechanism: `collaboration.spawn_agent`, with asynchronous coordination through followup_task/send_message. Seven active slots were offered including the lead. Five view workers were launched without waiting between spawns, before collecting their results. Each owned a different JSON master. No simultaneous writes to a shared output occurred. All workers used `fork_turns="none"` with explicit model/effort selections and complete briefs, file paths and actual visual references.

This local Codex runtime requires a direct request or applicable instructions explicitly requesting delegation. The user explicitly requested these workflows and tier choices. No special command was needed. `/subagents` is the documented CLI inspection command, not a prerequisite for spawning.

| Runtime-selectable override | Supported effort values in this session |
|---|---|
| `gpt-6-luna` | low, medium, high, xhigh, max |
| `gpt-6.1-terra`, `gpt-6.1-sol`, `gpt-6-astra`, `gpt-6-sol` | low, medium, high, xhigh, max, ultra |

These are this session's offered values, not a promise for every host/account. Fixed-model specialist roles are separate; general worker/default roles were used to honor explicit assignments.

| Task | Model actually assigned | Effort |
|---|---|---|
| Single illustration; lead treatment/brief/model/palette/assembly/repairs/final control | Existing parent session (exact runtime identifier not exposed) | Inherited |
| Front — `view_front` | gpt-6.1-terra | medium |
| Three-quarter — `view_threequarter` | gpt-6.1-terra | medium |
| Profile — `view_profile` | gpt-6.1-terra | medium |
| Three-quarter back — `view_threequarter_back` | gpt-6.1-terra | medium |
| Back — `view_back` | gpt-6.1-terra | medium |
| Mechanical validation — `mechanical_validation` | gpt-6-luna | low |
| Independent reviewer — `independent_visual_review` | gpt-6-astra | high |

The five selectable model names above are the complete override list offered by this session. Actual testing exercised Terra, Luna and Astra. No claim is made that the unexercised Sol overrides were launched.

## Tests and acceptance checklist

- [x] **A — single illustration stays inline.** Lead authored native SVG “First wind”, rendered a PNG and inspected the full illustration and face enlargement. **Zero subagents spawned** for this test. Both actual Original historical reference images were inspected before construction. This tests the native-vector illustration path, not image-generation fidelity.
- [x] **B — five independent views genuinely delegate.** Lead resolved Original / Classic graphic, invented temporary Nell, authored the provisional identity anchor, fixed palette, proportions, geometry, yaws, registration and static-output requirements. Five balanced-tier workers constructed separate real Rig 1 masters using the common model and authored contours. Each opened the actual historical pair and provisional anchor. The lead collected all files, derived their SVG/PNG previews, assembled the sheet and inspected every view at useful size. No saved Storymaker character was read, modified or published.
- [x] **C — independent reviewer works.** A strongest-tier agent that made none of the art opened the rendered sheet, all five individual PNGs and the actual historical references. It used Workflow step 7 and recorded file/view-specific defects and input hashes. It was not given working notes as a substitute for the renders.
- [x] **Lead confirms and corrects defects.** The lead independently saw the profile lip/chin and sleeve paint-order failures and oblique/rear arm join artifacts. Only temporary artwork was repaired. The same reviewer inspected corrected renders, found two small remaining joins, and rechecked those after repair. Final reported defects are resolved. Reviewed hashes identify every revision. A reviewer result is not user approval; all rig metadata remains draft.
- [x] **Original style preserved.** Final views retain the short angular bob, tiny dots, wedge nose, flat limited palette, slim tapered adult silhouette, selective fine contours and texture-free finish. Front/profile/rear facial visibility, head/eye/hem/sole registration and width changes were checked visually and structurally.

## Technical validation actually run

| Check | Result |
|---|---|
| Packaged `node --test scripts/test/*.mjs` | 6/6 pass (illustrated-scene and sparse regression tests) |
| Packaged JavaScript `node --check` | 28/28 pass |
| Packaged JSON parsing | 44/44 pass |
| Packaged `validate-rig.cjs` | 28 bundled + 5 delegated + 5 construction rigs = 38/38 pass |
| Final view repairs | All five revalidated after major repairs; final two altered rigs revalidated after minor repairs |
| `turnaround.mjs nell-model.mjs ... 0 45 90 135 180` | Pass; five construction views, rigs, sheet and guide generated separately |
| Actual delegated turnaround | Assembled from the five worker-produced masters, not substituted with the automatic construction sheet |
| View registration | Yaw set, 420×720 canvases, 15 consistent bone IDs/roles per view, inverse rest bindings and projected joint positions pass; landmarks and projected hem widths visually checked |
| Host correction regression | Failed against old unrestricted-delegation text; passed after correction and after final wording precision |
| Manifests | Both parse; identity/version/presentation agree; skill/icon paths exist; version 1.9.3 |
| Full/update ZIP integrity | CRC, entry inventories, safe contained paths and per-file SHA-256 match candidate; 141 full entries / 3 update entries |
| Unrelated content preservation | 138/141 package files identical; only allowed three changed; delegation and step 7 verbatim |

The evidence contains original audits and later focused checks. Final file comparison and final rendered hashes supersede the earlier intermediate hashes. The mechanical audit's filename-to-yaw reporting mistake was corrected; final mapping is by filename, not alphabetic list position.

## Limits and checks not applicable

No new animation, gait, clip, rope, control program or performance was authored. Motion visual/contact testing and slimming are therefore not applicable; unslimmed masters are retained. Existing packaged motion-related regression tests did run. Static rest poses do not establish safe extreme joint ranges or animation quality.

Raster image generation, a ChatGPT-host conversation rerun, plain Chat fallback, specialist fixed-role overrides, and destination Animatron import/pose/save/reopen/export were not tested. Native SVGs were rendered with Sharp/librsvg; this does not establish a browser importer round trip. No claim of 80% coverage or full application regression/build is made for this documentation-only plugin patch. The public repository's Pages workflow is main-only; this task does not merge or deploy the application.

The release package is a skills/instruction release; delegation decisions were exercised in this actual Codex session and are not a deterministic software guarantee across all future hosts. All user approval, audience and publication boundaries remain unchanged.

## Artifacts

The delivered full archive is `mid-century-ink-1.9.3-complete.zip`; the minimal overlay is `mid-century-ink-1.9.3-update.zip`. The delivered evidence includes editable masters, final and intermediate renders, original and corrected reviewer findings, model assignments, technical logs, file hashes and the complete source comparison. No test artwork is included inside the plugin package.

Private plugin publication, its read-back and PR/commit provenance are recorded in the delivered `publication.json` after the source commit and PR exist. Publication is separate from merging the PR or deploying Animatron.
