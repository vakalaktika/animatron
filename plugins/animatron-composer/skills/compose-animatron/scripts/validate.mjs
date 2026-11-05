#!/usr/bin/env node
// Checks Animatron compositions with the studio's own import, repair and
// share-link code, and reports schema drift since the plugin was built.
//
//   node validate.mjs piece.json [more.json ...] [--repo <checkout>] [--ref <git ref> | --pinned] [--offline] [--studio-url <url>]
//
// PASS means: the gallery's Import JSON accepts the file with no warnings,
// repair changes nothing, and a #share= link made from it reopens to the same
// composition. On PASS the link is written next to the file as
// <name>.share-link.txt. Exit code 1 if any file fails.
import { driftReport, ensureRepo, parseArgs, runHarness } from "./lib.mjs";

const opts = parseArgs(process.argv.slice(2));
if (opts.help || !opts.files.length) {
  console.log("usage: node validate.mjs <composition.json>... [--repo <checkout>] [--ref <ref> | --pinned] [--offline] [--studio-url <url>]");
  process.exit(opts.help ? 0 : 2);
}

try {
  const repo = ensureRepo(opts);
  const drift = driftReport(repo);
  for (const line of drift.lines) console.log(line);
  console.log("");
  const { status } = runHarness(repo, ["check", opts.studioUrl, ...opts.files]);
  if (drift.changed.length) console.log("\nNote: schema files changed since the plugin's locked commit; a PASS above is against the selected checkout, which may differ from the deployed application. Refresh the skill before release.");
  process.exit(status);
} catch (e) {
  console.error(`validate: ${e.message}`);
  process.exit(2);
}
