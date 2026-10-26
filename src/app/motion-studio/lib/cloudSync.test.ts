import type { StudioDoc } from "@/app/components/motion-studio/types";
import { normalizeDoc, type RawDoc } from "./migrate";
import { welcomePreset } from "../presets";
import { applyPull, isStarterDoc, planSync } from "./cloudSync";
import type { Project } from "./projects";

const doc = (name: string, over: Partial<StudioDoc> = {}): StudioDoc => ({
  version: 2,
  name,
  stage: { width: 100, height: 100, background: "#fff", transparent: false },
  clips: [],
  ...over,
});
const local = (id: string, updatedAt: string, over: Partial<StudioDoc> = {}): Project => ({ id, doc: doc(id, over), updatedAt });
const remote = (id: string, updatedAt: string, d: unknown = doc(`${id} (cloud)`)) => ({ id, name: id, doc: d, deleted: false, updatedAt });
const tombstone = (id: string, updatedAt: string) => ({ id, name: id, doc: null, deleted: true, updatedAt });

describe("planSync", () => {
  test("newer wins on each side; new ones go both ways", () => {
    const plan = planSync(
      [local("a", "2026-10-02T00:00:00Z"), local("b", "2026-10-01T00:00:00Z"), local("c", "2026-10-01T00:00:00Z")],
      [remote("a", "2026-10-01T00:00:00Z"), remote("b", "2026-10-03T00:00:00Z"), remote("d", "2026-10-01T00:00:00Z")],
    );
    expect(plan.push.map((p) => p.id)).toEqual(["a", "c"]);
    expect(plan.pull.map((p) => p.id)).toEqual(["b", "d"]);
  });

  test("the same edit time is already in sync", () => {
    const plan = planSync([local("a", "2026-10-02T00:00:00Z")], [remote("a", "2026-10-02T00:00:00Z")]);
    expect(plan.push).toEqual([]);
    expect(plan.pull).toEqual([]);
  });

  test("compositions with sound or video stay in this browser", () => {
    const withSound = local("s", "2026-10-02T00:00:00Z", { audio: { mediaId: "m", name: "song", length: 3, offset: 0, trimStart: 0, volume: 1, fadeOut: 0 } });
    const plan = planSync([withSound], []);
    expect(plan.push).toEqual([]);
    expect(plan.keptLocal.map((p) => p.id)).toEqual(["s"]);
  });
});

describe("deletions", () => {
  test("a deletion elsewhere removes the local copy unless it was edited after the deletion", () => {
    const plan = planSync(
      [local("old", "2026-10-01T00:00:00Z"), local("edited", "2026-10-09T00:00:00Z")],
      [tombstone("old", "2026-10-05T00:00:00Z"), tombstone("edited", "2026-10-05T00:00:00Z"), tombstone("never-here", "2026-10-05T00:00:00Z")],
    );
    expect(plan.remove).toEqual(["old"]);
    expect(plan.pull).toEqual([]);
    // Edited after the deletion: it goes back up.
    expect(plan.push.map((p) => p.id)).toEqual(["edited"]);
  });

  test("removal spares the open composition and says so", () => {
    const store = { currentId: "open", projects: [local("open", "2026-10-01T00:00:00Z"), local("other", "2026-10-01T00:00:00Z")] };
    const { store: next, removedCurrent } = applyPull(store, [], ["open", "other"]);
    expect(next.projects.map((p) => p.id)).toEqual(["open"]);
    expect(removedCurrent).toBe(true);
  });
});

describe("the starter composition", () => {
  test("an untouched Welcome, as stored and reloaded, is never pushed; an edited one is", () => {
    const stored = normalizeDoc(JSON.parse(JSON.stringify(welcomePreset())) as RawDoc).doc;
    expect(isStarterDoc(stored)).toBe(true);
    const edited = { ...stored, name: "My take on Welcome" };
    expect(isStarterDoc(edited)).toBe(false);
    const plan = planSync([{ id: "w", doc: stored, updatedAt: "2026-10-02T00:00:00Z" }, { id: "e", doc: edited, updatedAt: "2026-10-02T00:00:00Z" }], []);
    expect(plan.push.map((p) => p.id)).toEqual(["e"]);
  });
});

describe("applyPull", () => {
  test("replaces older copies, adds new ones, and skips what isn't a composition", () => {
    const store = { currentId: "a", projects: [local("a", "2026-10-01T00:00:00Z"), local("b", "2026-10-01T00:00:00Z")] };
    const { store: next, skipped } = applyPull(store, [remote("a", "2026-10-05T00:00:00Z"), remote("z", "2026-10-05T00:00:00Z"), remote("bad", "2026-10-05T00:00:00Z", { nope: true })]);
    expect(next.projects.map((p) => [p.id, p.doc.name])).toEqual([["a", "a (cloud)"], ["b", "b"], ["z", "z (cloud)"]]);
    expect(next.projects[0].updatedAt).toBe("2026-10-05T00:00:00Z");
    expect(next.currentId).toBe("a");
    expect(skipped).toBe(1);
  });
});
