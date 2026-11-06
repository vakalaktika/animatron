---
name: compose-animatron
description: "Writes valid Animatron studio compositions (JSON) from a plain-language brief and validates them with the studio's own import and repair code, returning a .json file and a #share= link that opens the piece, and on request a short animatron-share.vercel.app/s/ link with its preview card, made the way the studio makes them. Can also render a frame of any composition as an image to check the layout, and place and animate Mid-century Ink rigged characters (.mci.json) the user supplies. Use when the user asks for an Animatron composition, animation, reel hook, lower third, title card, story or site hero \"for Animatron\" or \"for my studio\", or wants a brief turned into something to drop into vakalaktika.github.io/animatron, or asks for a short link to an Animatron composition, or wants a rigged character (.mci.json, Agent Torres, Mid-century Ink) posed or animated in a piece. Also trigger on the shortcut phrase \"Animatron: <brief>\" or \"Animatron this\" with an attached or clearly referenced subject, coordinating Mid-century Ink artwork and rig creation when needed."
---

# Compose for Animatron

The supporting application now has a drag-and-connect **Nodes** workspace. Read the human node workspace section of `references/motion-controls.md`; name controls clearly and keep graph, timeline, and canvas edits in the same Doc 4 / Rig 4 program. Node layout is optional editor metadata and does not animate artwork or establish live-site support.

## Editable controls and motion blocks

Read `references/motion-controls.md` for Document 4 / Rig 4 authoring. Use `scripts/motion-program.mjs` with an explicit supporting application checkout to add sparse controller tracks, reusable path/transform/oscillation blocks, persistent IK/aim constraints and directed socket attachments. Human canvas handles, timeline controls and optional relationship views edit the same saved program. The CLI validates actual evaluated intermediate times and writes an atomic complete file; stdout is a small report, never the composition payload. Preserve original artwork, identity records and all unaddressed tracks. This version does not establish that the deployed application supports the new contracts.

Plan anticipation, coordinated body movement, expressive holds and settling before choosing motion blocks. A target contact is evaluated throughout its interval, not merely at recorded poses. Select registered head-angle drawings for perspective; rotating a flat face is not a head turn. Distinguish full-strength contact locks, partial influence, unreachable targets and visual approval. Review loops for position and velocity continuity and deliver reduced-motion artwork. Raster bending requires the explicit mesh capability and an inspected fixture; never infer it from rigid rotation or these controls alone.

## Scene structure before animation

Read `references/scene-production.md` for illustrated animation. First declare action-specific independent parts, scene space/occluders, contact carriers and artwork facing. Do not call a sparse rigid gesture natural acting. Rebuild missing artwork before promising the action, or explicitly preserve the unmet requirement. Composer must run `scene-check.mjs` with the actual app evaluator on the stored scene plan; new masked masters use document3 and JSON-only handoff. Technical validity, fewer keys and successful export do not establish visual quality or user approval.

## Sparse object and part tweens

Read `references/tweening.md` for editable motion. Use `scripts/tween.mjs` to turn a compact seconds-based specification into independent object and bone tracks, validated by the target app before writing. Prefer two/few authored poses per part plus a curve instead of frame-by-frame JSON. Preserve supplied art and all unaddressed tracks. Native eased bone keys require Rig 3 and the updated application; use explicit `--repo` or a verified supporting revision. This private plugin update does not deploy the app. Keep discrete replacement drawings for true head angles, blinks and mouths; do not call a sliding flattened illustration articulated animation.

## Quick action: Animatron

Treat `Animatron: <brief>` as a request to complete an Animatron animation. Also accept `Animatron this` when the message includes an attachment or an unambiguous subject in context. These are natural-language shortcut phrases, not registered application slash commands or new UI controls. Questions about Animatron or quoted examples are not execution requests.

Use explicit user instructions first, then the referenced project's settings. For a new project with unspecified settings, choose Original / Classic graphic Mid-century Ink, an 8-second looping animation and a 1280×720 landscape stage. Illustrated scenes default to a complete composed setting with restrained motion; scene richness is independent of character treatment. Use Mid-century Ink's palette rules; preserve accepted palettes and identities for existing projects. An explicit Detailed choice overrides Original. Preserve the actual subject/action in an attachment or contextual reference and infer only modest motion consistent with the brief. Ask one short question only if there is no identifiable subject/action or a real identity conflict; routine visual choices do not need confirmation.

Complete the following within the available host capabilities:
1. Load Mid-century Ink and its selected treatment's required references. Reuse an appropriate supplied rig. If artwork or a rig is missing, use Mid-century Ink to create the character model, editable vector art, movement study, required views, versioned editable master (Rig 4 for persistent controls; legacy formats remain supported) and sparse motion. Do not ask the user to supply a rig for an invented subject merely because this composer does not draw. Preserve the editable master before slimming an output copy.
2. Feed the resulting actual `.mci.json` file into this composer's inspect/place workflow; read `references/rigs.md` and `references/schema.md`. Do not hand-edit the rig to bypass its creator or replace a named subject with the demo fixture.
3. Build the composition and validate using the studio importer, repair checks and share-hash round trip. Check duration and loop continuity separately: an 8-second animation cycle may coexist with the studio's final hold, and an importer PASS alone does not establish a seamless visual loop. Inspect key rendered moments when rendering is available, and report actual validation/rendering limits.
4. Deliver the importable composition and any newly created editable model/rig assets, plus a preview when successfully rendered. Include the opening `#share=` link when validation generated one within the size limit; otherwise deliver the composition file. Do not promise a video export without an available, verified renderer. Creating a public short-link page still requires an explicit request.

If Mid-century Ink, Node, network or rendering is unavailable, state the specific missing capability and finish the independent work that remains possible. Never claim a complete animation or verified playback when those steps were not performed. This shortcut does not authorize installation of dependencies beyond the existing workflow, publication, changing app/database code or changing character approval records.

## ChatGPT host integration

Resolve all bundled paths relative to this skill. Use the available execution environment for Node scripts and the current host's supported file display and saving workflow. This package supplies instructions, scripts and examples; it does not install a hosted MCP server, deploy Animatron, or grant access to a signed-in Animatron account.

Check Node, network and browser availability before promising validation or rendering. The validator downloads the studio source and dependencies on its first run. If access is blocked, do not claim PASS or working integration: deliver only clearly labeled unvalidated drafts when requested, with the outstanding checks. A schema description or a bundled example is not a substitute for the studio round-trip check. Do not claim current-main validation if running pinned/offline.

Use the installed Mid-century Ink plugin when asked to create or revise artwork or rigs, and then provide its actual output to this composer as an input. Compose does not redraw or alter a rig's identity. Reuse supplied rigs. Never treat the diagnostic fixture as an approved character. This installation alone does not add Claude's expanded Mid-century Ink animation tools to the installed Mid-century Ink plugin.

Short links publish the piece and optional preview to the configured service, so create them only when requested. Use configured public client credentials through the documented setup; never package secrets or infer an existing account connection. Do not change the studio app or a database as part of ordinary composition work.


Turn a brief ("a 1080×1920 reel hook with my name sliding up and a rainbow
ribbon entrance, 6 seconds") into a composition file that the Animatron studio
imports **unchanged**, plus a `#share=` link that opens it directly.

The studio repo (github.com/vakalaktika/animatron) is the source of truth.
This skill was built against the commit in `schema.lock.json`; the validator
always tests against the studio's current `main` and reports drift.

## Files in this skill

- `references/schema.md`: every field of the document and of text, sprite and ribbon clips, with full skeletons. **Read before writing a composition.**
- `references/recipes.md`: brief phrases mapped to fields (frames, safe areas, timing, entrances, ribbons, palettes).
- `references/rigs.md`: rigged characters: inspecting a rig, the placement and motion spec, timing. **Read before using a rig.**
- `references/share-links.md`: how `#share=` links are encoded, and how to set up, make and delete short links.
- `examples/`: worked compositions. `lower-third.json`, `title-card.json`, `reel-hook.json` are exported from the studio's own starter templates; `brief-reel-name-ribbon.json` answers the example brief above; `rig-wave.json` places the studio's fixture rig (`rigs/example-character.mci.json`) waving beside a greeting. `examples/README.md` explains each.
- `scripts/validate.mjs`: the check. `scripts/card.mjs`: draws a frame as the studio's 1200×630 preview card (studio renderer, headless Chrome). `scripts/rig.mjs`: inspects and places rigs with the studio's rig engine. `scripts/short-link.mjs`: short links. `scripts/refresh.mjs`: re-sync after the studio changes. `scripts/test/`: tests for short links against a fake Supabase.

## Workflow

1. **Read the brief for:** frame size, target length, each on-screen element
   and how it enters, text content, colours, mood. Fill gaps with the
   defaults in `recipes.md`. Ask a question only when content is missing and
   matters (e.g. "my name" with no name in the conversation); otherwise use a
   placeholder like `"Your name"` and say so.
2. **Pick the closest example** in `examples/` and read it with
   `references/schema.md`. Reuse its skeletons and change values.
3. **Write the composition** to a file named after the piece (e.g.
   `reel-hook-ed.json`), following these rules, which are the ones the
   studio's repair step enforces:
   - `version: 2`, a non-empty `name`, a full `stage`.
   - **Every field of every clip is present.** Repair fills in anything
     missing, and the validator counts that as a failure.
   - Ids are unique; `parentId` is `null` or an id in this file; each child
     comes directly after its parent in `clips`.
   - Pictures only as inline `data:image/` URLs or self-contained SVG
     markup. No video, no `audio`.
   - Rig layers only through `scripts/rig.mjs place` (see below), never
     written by hand.
   - Enum values exactly as listed in `schema.md` (easing, reveal, motion...).
   - Every keyframe carries an `ease`.
   - One line of text per text clip.
   - Duration uses the application evaluator: latest enabled clip end plus `timeline.tailSeconds`, default 1 s for legacy documents. For a precise scene loop with no extra hold, set `timeline: { "tailSeconds": 0 }` and make the animation itself last the requested duration. A tail changes presentation length; it does not truncate motion. Keep each animation's `loop` flag explicit.
4. **Validate** (needs Node 20.9+, git, and network on first run to clone the
   studio and install its dependencies into `~/.cache/animatron-composer`):

   ```sh
   node <this skill's directory>/scripts/validate.mjs path/to/piece.json
   ```

   It runs the gallery's `docFromJson`, the repair step, a strict lint, and
   the studio's `shareUrl` → `docFromHash` round trip, then prints the
   composition length. Fix every `x` line and re-run until `PASS`. Treat `!`
   lines as advice. On PASS the link is saved to `piece.share-link.txt`.
   Use `--repo <path>` to test against a local checkout as-is, `--pinned` for
   the locked commit, `--offline` to skip fetching.
5. **Check the length** against the target; adjust timing and re-validate if it's off. Inspect visual continuity and velocity/spacing continuity separately at the loop seam; matching endpoint images alone proves neither smoothness nor correct playback duration.
   **Look at it** when Chrome is available: `node <skill dir>/scripts/card.mjs
   piece.json --time <seconds>` draws that moment with the studio's own
   renderer to `piece.card.png`. Read the image and check for text running
   off the frame, overlaps, and anything hidden in the reel's UI zones. Try
   the moment everything has landed (`length − 1`). Fix and re-validate.
   Without Chrome, skip this and say the layout wasn't checked visually.
6. **Deliver:**
   - the `.json` file (send it as a file; it imports via *Compositions →
     Import JSON* or by dropping it on the list),
   - the `#share=` link from `piece.share-link.txt`, as a clickable link
     (never retype or edit it). If the piece is too big for a link, say so.
   - one or two lines on what happens on screen and when, and any
     placeholder to replace.

   Never hand over a composition that hasn't passed. If the validator can't
   run (no Node, no network), say so plainly, check the rules above by hand,
   and label the file unvalidated.

7. **Short link, only when asked.** If the user wants a short link (or a
   link with a share page), read `references/share-links.md`, then:

   ```sh
   node <this skill's directory>/scripts/short-link.mjs create path/to/piece.json
   ```

   It validates again, draws the preview card with the studio's renderer
   (`piece.card.png`; needs Chrome, Chromium, Edge or Brave), stores the
   piece and card with the studio's own `shareWithPreview()`, and prints and
   saves the link (`piece.short-link.txt`). Send the card image along with
   the link so the user sees what pasted links will show. First time: it needs the project URL and anon
   key (`short-link.mjs setup`); ask the user for them, they are public
   values. Mention that the link is public. Without a browser the link is
   made without a card; `short-link.mjs card <id> piece.json` adds it later,
   once (cards can't be changed after). If it
   says the project isn't reachable from here, don't look for another route:
   explain that short links have to be made on the user's own computer and
   give the `#share=` link. To remove one: `short-link.mjs delete <id>`.

## Illustrated scenes

Preserve the approved key-pose artwork and chosen Original/Detailed treatment supplied by Mid-century Ink. Richness of setting, character treatment, finish and motion complexity are independent choices. Do not simplify a complete illustrated room into a primitive rig demo. Use the artwork/rig from Mid-century Ink; Composer places and times it without redrawing identities. Rig 1 vector rigs remain supported. Rig 2 adds raster attachments and discrete registered replacement drawings when the target application supports it; validate through the actual app importer, including image budgets and SVG safety. See `references/rigs.md`.

Keep editable masters separate from optimized playback copies. Deliver the importable JSON even when no opening link fits. A validation PASS certifies the technical checks run, never visual fidelity or user approval. Compare actual rendered representative poses, intermediate contacts and replacement transitions at useful viewing size. A preview generated against local modified source must not be presented as verified behavior of the deployed app. Provide a reduced-motion still.

## Rigged characters

When the brief involves a character from a `.mci.json` rig, read
`references/rigs.md`. In short: `rig.mjs inspect` the rig (studio import,
roles, clips, presets), write a placement spec (where, how big, `wave`/`nod`
presets, motions as poses over time by bone role, which clip plays), run
`rig.mjs place spec.json --into piece.json`, validate, then render cards at
the key moments, because which way a rotation turns a limb depends on the
rig. Use supplied rigs or actual rigs created by Mid-century Ink for this request; the composer itself must not draw, re-rig or hand-edit them.
For a quick-action request without a rig, coordinate its creation through Mid-century Ink as described above. Ask for a missing existing character reference only when identity cannot be resolved. The bundled fixture is for demos only.

## When the validator reports drift

`schema DRIFT` means schema files changed since this skill's locked commit.
The PASS/FAIL is against the selected source checkout. A local `--repo` may include changes absent from the deployed studio; report that compatibility boundary and do not call it live verification.
Read the diff it prints, adapt the composition to any new or changed fields,
and tell the user the plugin's references are due a refresh: update
`references/*.md` from the diff, run `node scripts/refresh.mjs` (re-exports
the template examples, rewrites `schema.lock.json`, re-validates every
example), and bump the plugin version.

## Out of scope

Drawing or rigging characters (the Mid-century Ink tools do that), automatic
retargeting between different skeletons, arbitrary executable expressions,
automatic flattened-image separation, and changing the studio repository.
Use the explicit Document 4 attachment contract for scene-to-rig socket contacts;
legacy placement commands do not acquire this capability automatically.
