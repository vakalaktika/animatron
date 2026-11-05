import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runHarness } from "../lib.mjs";

test("large legal rig results survive capture, and failure status is preserved", () => {
  const work = mkdtempSync(join(tmpdir(), "ac-capture-test-"));
  const previous = process.env.ANIMATRON_COMPOSER_CACHE;
  try {
    // No npm/network required for this transport regression: the fixture is JS.
    const loader = join(work, "noop.mjs");
    writeFileSync(loader, "");
    writeFileSync(join(work, "tsx-loader-path.txt"), loader);
    process.env.ANIMATRON_COMPOSER_CACHE = work;
    for (const status of [0, 7]) {
      const result = runHarness(work, [String(status)], { script: "test/output-fixture.mjs", capture: true });
      assert.equal(result.status, status);
      assert.ok(result.stdout.endsWith("\n"));
      const payload = JSON.parse(result.stdout.slice("RESULT ".length));
      assert.equal(payload.payload.length, 5 * 1024 * 1024);
    }
  } finally {
    if (previous === undefined) delete process.env.ANIMATRON_COMPOSER_CACHE;
    else process.env.ANIMATRON_COMPOSER_CACHE = previous;
    rmSync(work, { recursive: true, force: true });
  }
});
