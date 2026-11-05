# Plugin source and release workflow

`plugins/` contains reviewed **update overlays** for the existing private Mid-century Ink and Animatron Composer plugins. `SOURCE.json` identifies each exact backend plugin and inspected base release. Unchanged private style-reference images and identity authorities remain in those releases and are intentionally absent from this public repository. This preserves their privacy and authority; it does not substitute new references or discard existing files.

To work locally, retrieve that base release using Plugin Creator's source/archive tools, extract it into `plugins/<name>`, then overlay the tracked files from this repository. Existing plugin tests/helpers can then use the complete source. The resulting snapshot is ignored by Git apart from explicitly tracked, reviewed update files. Never add the private reference images to this repository.

After committing, pushing and opening the application PR, run `node scripts/package-pipeline.mjs`. It rejects uncommitted package inputs, writes versioned ZIP update overlays and SHA-256 provenance to `dist/`, and includes paths relative to each plugin root. Plugin Creator's guarded `update_plugin` overlays these files on the recorded current release and retains omitted assets. These archives update the existing plugins; they are not intended to create replacement plugin identities.

Read back the changed source after the update and verify the resulting version/release. Preserve existing personal scope and private audience. Updating a private plugin does not deploy the Animatron application. Rig 2 scenes require the application revision in the accompanying PR, run locally until application deployment is separately authorized.
