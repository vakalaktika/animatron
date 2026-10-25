// @vitest-environment jsdom
import { BUILT_IN_PRESETS, STORAGE_KEY as LEGACY_PRESETS_KEY, welcomePreset } from "../presets";
import { DOC_STORAGE_KEY } from "./persistence";
import {
  addProject,
  duplicateProject,
  loadProjects,
  PROJECTS_KEY,
  recentFirst,
  removeProject,
  renameProject,
  saveProjects,
  upsertCurrent,
} from "./projects";

describe("projects store", () => {
  afterEach(() => window.localStorage.clear());

  it("starts empty on a fresh browser", () => {
    expect(loadProjects()).toEqual({ currentId: null, projects: [] });
  });

  it("folds the old autosave slot and saved presets in on first read", () => {
    const working = { ...welcomePreset(), name: "My work" };
    window.localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify(working));
    window.localStorage.setItem(
      LEGACY_PRESETS_KEY,
      JSON.stringify([{ name: "Loader tweak", savedAt: "2026-01-02T00:00:00.000Z", doc: BUILT_IN_PRESETS[3].make() }]),
    );
    const store = loadProjects();
    expect(store.projects).toHaveLength(2);
    expect(store.projects.map((p) => p.doc.name)).toEqual(["My work", "Loader tweak"]);
    expect(store.currentId).toBe(store.projects[0].id);
    expect(store.projects[1].updatedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("round-trips and mirrors the current document into the legacy slot", () => {
    const store = addProject({ currentId: null, projects: [] }, welcomePreset(), "2026-05-01T00:00:00.000Z");
    expect(saveProjects(store)).toBeNull();
    expect(loadProjects()).toEqual(store);
    const mirror = JSON.parse(window.localStorage.getItem(DOC_STORAGE_KEY) ?? "null") as { name: string };
    expect(mirror.name).toBe("Welcome");
  });

  it("drops junk entries and a dangling current id", () => {
    window.localStorage.setItem(
      PROJECTS_KEY,
      JSON.stringify({ currentId: "gone", projects: [{ id: "ok", updatedAt: "x", doc: welcomePreset() }, { id: 3 }, null, { id: "bad", doc: {} }] }),
    );
    const store = loadProjects();
    expect(store.projects.map((p) => p.id)).toEqual(["ok"]);
    expect(store.currentId).toBeNull();
  });

  it("upsertCurrent creates a slot the first time and updates it afterwards", () => {
    const a = upsertCurrent({ currentId: null, projects: [] }, welcomePreset(), "t1");
    expect(a.projects).toHaveLength(1);
    expect(a.currentId).toBe(a.projects[0].id);
    const b = upsertCurrent(a, { ...welcomePreset(), name: "Renamed" }, "t2");
    expect(b.projects).toHaveLength(1);
    expect(b.projects[0]).toMatchObject({ updatedAt: "t2", doc: { name: "Renamed" } });
  });

  it("removing the current project falls back to the latest remaining one", () => {
    let store = addProject({ currentId: null, projects: [] }, welcomePreset(), "t1");
    const first = store.currentId!;
    store = addProject(store, { ...welcomePreset(), name: "Second" }, "t2");
    store = removeProject(store, store.currentId!);
    expect(store.currentId).toBe(first);
    store = removeProject(store, first);
    expect(store).toEqual({ currentId: null, projects: [] });
  });

  it("renames, duplicates and sorts by recency", () => {
    let store = addProject({ currentId: null, projects: [] }, welcomePreset(), "2026-01-01T00:00:00.000Z");
    const id = store.currentId!;
    store = renameProject(store, id, "Intro");
    store = duplicateProject(store, id, "2026-02-01T00:00:00.000Z");
    expect(store.projects.map((p) => p.doc.name)).toEqual(["Intro", "Intro copy"]);
    expect(recentFirst(store.projects)[0].doc.name).toBe("Intro copy");
  });
});
