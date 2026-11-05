# Animatron Composer 0.5.0

- Large harness results travel through a private bounded regular file; synchronous result writes and process-status checks prevent truncated JSON or a success-looking payload from hiding failure.
- Revalidation removes stale success links after failed/oversized edits. Duration uses the application's evaluator, including explicit `timeline.tailSeconds` (legacy default one second).
- Renderer bundle fingerprints include actual source contents, including dirty and new local files; a local preview no longer silently reuses a stale HEAD-only bundle.
- Documented Rig 1/2 compatibility, illustrated scene handoff, independent visual review, explicit drawing states, and importable file delivery when links exceed the budget.
- No application deployment or public hosting is part of plugin installation. Rig 2 requires the upgraded application revision.
