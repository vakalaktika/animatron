import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const scripts = fileURLToPath(new URL("..", import.meta.url));
const repo = process.env.ANIMATRON_COMPOSER_REPO;
const run = (file) => spawnSync(process.execPath, [join(scripts, "validate.mjs"), file, "--repo", repo, "--offline"], { encoding: "utf8" });

test("validator honors zero tail, removes stale success links after invalid edits", { skip: !repo }, () => {
  const work = mkdtempSync(join(tmpdir(), "ac-validator-"));
  try {
    const doc = JSON.parse(readFileSync(join(scripts, "..", "examples", "title-card.json"), "utf8"));
    doc.timeline = { tailSeconds: 0 };
    const file = join(work, "scene.json");
    const link = join(work, "scene.share-link.txt");
    writeFileSync(file, JSON.stringify(doc));
    const valid = run(file);
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    assert.match(valid.stdout, /timeline tail 0\.00 s/);
    assert.ok(existsSync(link));
    writeFileSync(file, "{truncated");
    const invalid = run(file);
    assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
    assert.match(invalid.stdout, /FAIL/);
    assert.equal(existsSync(link), false);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
