import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rendererSourceStamp } from "../card.mjs";

test("renderer cache follows edited and newly created app source without a commit", () => {
  const work = mkdtempSync(join(tmpdir(), "ac-card-cache-"));
  try {
    mkdirSync(join(work, "src"));
    writeFileSync(join(work, "src", "view.tsx"), "first");
    const first = rendererSourceStamp(work);
    assert.equal(rendererSourceStamp(work), first);
    writeFileSync(join(work, "src", "view.tsx"), "second");
    const second = rendererSourceStamp(work);
    assert.notEqual(second, first);
    writeFileSync(join(work, "src", "attachment.ts"), "new renderer support");
    assert.notEqual(rendererSourceStamp(work), second);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
