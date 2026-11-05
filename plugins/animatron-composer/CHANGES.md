## 0.6.0 — native sparse tween authoring

- Native Rig 3 eased part tracks replace dense sampled keys for ordinary transform motion; Rig 1/2 and legacy baking remain supported.
- Human endpoint/object and per-part editing use the application evaluator; Composer accepts compact independent object/bone tracks and validates before atomic file output.
- Preserve art, bindings, drawing states, identity records and unchanged tracks. Target the updated app checkout for Rig 3; updating this plugin alone does not deploy the app.

# Animatron Composer 0.5.0

- Large harness results travel through a private bounded regular file; synchronous result writes and process-status checks prevent truncated JSON or a success-looking payload from hiding failure.
- Revalidation removes stale success links after failed/oversized edits. Duration uses the application's evaluator, including explicit `timeline.tailSeconds` (legacy default one second).
- Renderer bundle fingerprints include actual source contents, including dirty and new local files; a local preview no longer silently reuses a stale HEAD-only bundle.
- Documented Rig 1/2 compatibility, illustrated scene handoff, independent visual review, explicit drawing states, and importable file delivery when links exceed the budget.
- No application deployment or public hosting is part of plugin installation. Rig 2 requires the upgraded application revision.
