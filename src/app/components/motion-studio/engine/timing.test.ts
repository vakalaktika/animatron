import { describe, expect, it } from "vitest";
import { docDuration } from "./timing";
import { normalizeDoc } from "@/app/motion-studio/lib/migrate";
import { welcomePreset } from "@/app/motion-studio/presets";

describe("explicit composition tail", () => {
  it("keeps the legacy one second tail, and allows a seamless loop without it", () => {
    const doc = welcomePreset();
    const legacy = docDuration(doc);
    expect(docDuration({ ...doc, timeline: { tailSeconds: 0 } })).toBe(legacy - 1);
    expect(docDuration({ ...doc, timeline: { tailSeconds: 2.5 } })).toBe(legacy + 1.5);
    expect(docDuration({ ...doc, timeline: { tailSeconds: 0 } }, 3)).toBe(legacy + 2);
  });

  it("preserves explicit tail through save and reopen", () => {
    const doc = { ...welcomePreset(), timeline: { tailSeconds: 0 } };
    const reopened = normalizeDoc(JSON.parse(JSON.stringify(doc)));
    expect(reopened.warnings).toEqual([]);
    expect(reopened.doc.timeline).toEqual({ tailSeconds: 0 });
    expect(docDuration(reopened.doc)).toBe(docDuration(doc));
  });

  it.each([-1, 61, NaN, Infinity, "0", null])("repairs an invalid tail %s visibly", (tailSeconds) => {
    const raw = { ...welcomePreset(), timeline: { tailSeconds } };
    const result = normalizeDoc(raw as never);
    expect(result.doc.timeline).toBeUndefined();
    expect(result.warnings).toContain("Invalid timeline tail; restored the default one second hold.");
    expect(Number.isFinite(docDuration(result.doc))).toBe(true);
  });
});
