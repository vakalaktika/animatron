// @vitest-environment jsdom
import { BUILT_IN_PRESETS, STORAGE_KEY as LEGACY_PRESETS_KEY, welcomePreset } from "../presets";
import { DOC_STORAGE_KEY } from "./persistence";
import { planSync } from "./cloudSync";
import {
  addFolder,
  addProject,
  duplicateProject,
  EMPTY_STORE,
  fileProject,
  inFolder,
  loadProjects,
  moveProject,
  PROJECTS_KEY,
  recentFirst,
  removeFolder,
  removeProject,
  renameFolder,
  renameProject,
  saveProjects,
  upsertCurrent,
} from "./projects";

describe("projects store", () => {
  afterEach(() => window.localStorage.clear());

  it("does not duplicate a new-format illustrated master into the unsupported legacy autosave slot",()=>{
    window.localStorage.setItem(DOC_STORAGE_KEY,JSON.stringify(welcomePreset()));
    const legacy=window.localStorage.getItem(DOC_STORAGE_KEY);
    const store=addProject(EMPTY_STORE,{...welcomePreset(),version:4,name:"Illustrated master"});
    expect(saveProjects(store)).toBeNull();
    expect(loadProjects().projects[0].doc.name).toBe("Illustrated master");
    expect(window.localStorage.getItem(DOC_STORAGE_KEY)).toBe(legacy);
  });

  it("starts empty on a fresh browser", () => {
    expect(loadProjects()).toEqual(EMPTY_STORE);
  });
  it("retains an unsupported saved composition for recovery while opening other projects",()=>{
    const future={...welcomePreset(),version:5,name:"Future master"};
    window.localStorage.setItem(PROJECTS_KEY,JSON.stringify({currentId:"future",folders:[],projects:[{id:"future",doc:future,updatedAt:"2026-11-05"}]}));
    const store=loadProjects();
    expect(store.projects).toHaveLength(1);
    expect(store.projects[0]).toHaveProperty("recoveryJson",JSON.stringify(future));
    expect(store.currentId).toBeNull();
    expect(planSync(store.projects,[]).push).toEqual([]);
    expect(saveProjects(store)).toBeNull();
    expect(loadProjects().projects[0]).toHaveProperty("recoveryJson",JSON.stringify(future));
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
    const store = addProject(EMPTY_STORE, welcomePreset(), "2026-05-01T00:00:00.000Z");
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
    const a = upsertCurrent(EMPTY_STORE, welcomePreset(), "t1");
    expect(a.projects).toHaveLength(1);
    expect(a.currentId).toBe(a.projects[0].id);
    const b = upsertCurrent(a, { ...welcomePreset(), name: "Renamed" }, "t2");
    expect(b.projects).toHaveLength(1);
    expect(b.projects[0]).toMatchObject({ updatedAt: "t2", doc: { name: "Renamed" } });
  });

  it("removing the current project falls back to the latest remaining one", () => {
    let store = addProject(EMPTY_STORE, welcomePreset(), "t1");
    const first = store.currentId!;
    store = addProject(store, { ...welcomePreset(), name: "Second" }, "t2");
    store = removeProject(store, store.currentId!);
    expect(store.currentId).toBe(first);
    store = removeProject(store, first);
    expect(store).toEqual(EMPTY_STORE);
  });

  it("reads a store saved before folders existed", () => {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify({ currentId: "a", projects: [{ id: "a", updatedAt: "t", doc: welcomePreset() }] }));
    const store = loadProjects();
    expect(store.folders).toEqual([]);
    expect(store.projects[0].folderId).toBeNull();
    expect(store.currentId).toBe("a");
  });

  it("files compositions in folders and unfiles them when the folder goes", () => {
    let store = addFolder(EMPTY_STORE, "  Client work ", "f1");
    store = addFolder(store, "client work");
    expect(store.folders.map((f) => f.name)).toEqual(["Client work", "client work 2"]);
    store = addProject(store, welcomePreset(), "t1", "f1");
    const inside = store.currentId!;
    store = addProject(store, { ...welcomePreset(), name: "Loose" }, "t2", "nope");
    expect(store.projects.map((p) => p.folderId)).toEqual(["f1", null]);
    expect(inFolder(store.projects, "f1").map((p) => p.id)).toEqual([inside]);
    expect(inFolder(store.projects, null).map((p) => p.doc.name)).toEqual(["Loose"]);

    store = moveProject(store, store.currentId!, "f1");
    expect(inFolder(store.projects, "f1")).toHaveLength(2);
    store = moveProject(store, inside, null);
    expect(inFolder(store.projects, null).map((p) => p.id)).toEqual([inside]);

    store = renameFolder(store, "f1", "Pitches");
    expect(store.folders[0].name).toBe("Pitches");
    expect(saveProjects(store)).toBeNull();
    expect(loadProjects()).toEqual(store);

    store = removeFolder(store, "f1");
    expect(store.folders.map((f) => f.name)).toEqual(["client work 2"]);
    expect(store.projects.every((p) => p.folderId === null)).toBe(true);
    expect(store.projects).toHaveLength(2);
  });

  it("duplicates into the original's folder and files imports without opening them", () => {
    let store = addFolder(EMPTY_STORE, "Logos", "f1");
    store = addProject(store, welcomePreset(), "t1", "f1");
    const original = store.currentId!;
    store = duplicateProject(store, original, "t2");
    expect(inFolder(store.projects, "f1")).toHaveLength(2);
    store = fileProject(store, { ...welcomePreset(), name: "Imported" }, "f1", "t3");
    expect(store.currentId).not.toBe(store.projects[2].id);
    expect(store.projects[2]).toMatchObject({ folderId: "f1", doc: { name: "Imported" } });
  });

  it("keeps the edit time when the open document is saved unchanged", () => {
    const doc = welcomePreset();
    const store = addProject(EMPTY_STORE, doc, "2026-01-01T00:00:00.000Z");
    expect(upsertCurrent(store, doc, "2026-05-05T00:00:00.000Z").projects[0].updatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(upsertCurrent(store, { ...doc }, "2026-05-05T00:00:00.000Z").projects[0].updatedAt).toBe("2026-05-05T00:00:00.000Z");
  });

  it("does not activate a recovery placeholder when deleting the current project", () => {
    const store = addProject(EMPTY_STORE, welcomePreset());
    const recovered = { id: "future", doc: welcomePreset(), updatedAt: "", recoveryJson: "original" };
    expect(removeProject({ ...store, projects: [...store.projects, recovered] }, store.currentId!).currentId).toBeNull();
  });

  it("renames, duplicates and sorts by recency", () => {
    let store = addProject(EMPTY_STORE, welcomePreset(), "2026-01-01T00:00:00.000Z");
    const id = store.currentId!;
    store = renameProject(store, id, "Intro", "2026-01-15T00:00:00.000Z");
    // A rename is an edit: it moves the project's edit time.
    expect(store.projects[0].updatedAt).toBe("2026-01-15T00:00:00.000Z");
    store = duplicateProject(store, id, "2026-02-01T00:00:00.000Z");
    expect(store.projects.map((p) => p.doc.name)).toEqual(["Intro", "Intro copy"]);
    expect(recentFirst(store.projects)[0].doc.name).toBe("Intro copy");
  });
});
