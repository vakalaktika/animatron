# Editable node examples

- `family.nodes.animatron.json`: finished Detailed family scene with its existing target/IK/grip program and saved graph organization.
- `bedtime.nodes.animatron.json`: Original bedtime scene with saved graph organization. Its legacy skeletal/drawing tracks remain editable in the existing timeline/rig controls; the graph exposes its registered structure without converting those tracks.

Rebuild with `node scripts/build-node-examples.mjs`. The builder uses the actual app importer/evaluator and checks unchanged artwork/motion at nine times, then writes `validation.json`. Layout metadata never alters animation. These are reorganized editable masters of the prior benchmarks, not new natural-acting claims or new identity approvals.

Original rendered previews remain at `../motion-pipeline/illustrated/preview.mp4` and `../motion-pipeline/original-preview.mp4`; their source artwork and rigs stay alongside those files. Import the masters into the supporting 0.4.0 app checkout and choose **Nodes**. Public deployed-viewer support is not assumed.

`qa/` contains actual browser screenshots and results. `scripts/qa-node-editor.mjs` regenerates its edited QA composition locally; that diagnostic copy is not a finished performance deliverable.
