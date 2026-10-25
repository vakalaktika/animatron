import type { StudioDoc } from "@/app/components/motion-studio/types";
import { normalizeDoc, type RawDoc } from "./migrate";
import { DOC_STORAGE_KEY } from "./persistence";
import { newId, STORAGE_KEY as LEGACY_PRESETS_KEY } from "../presets";

/**
 * Every composition the user has worked on, kept in the browser. The current
 * one autosaves into its slot as it changes; the others wait in the gallery.
 * Replaces the single autosave slot plus the "saved presets" list: both are
 * folded in the first time this store is read, so nothing is lost.
 */
export interface Project {
  id: string;
  doc: StudioDoc;
  /** ISO time of the last change. */
  updatedAt: string;
}

export interface ProjectStore {
  currentId: string | null;
  projects: Project[];
}

export const PROJECTS_KEY = "animatron.projects.v1";

const isDocLike = (v: unknown): v is RawDoc =>
  !!v && typeof v === "object" && Array.isArray((v as RawDoc).clips) && !!(v as RawDoc).stage;

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/** Builds the store from the pre-projects storage: the autosave slot and saved presets. */
function migrateLegacy(): ProjectStore {
  const projects: Project[] = [];
  const now = new Date().toISOString();
  const current = readJson(DOC_STORAGE_KEY);
  let currentId: string | null = null;
  if (isDocLike(current)) {
    currentId = newId();
    projects.push({ id: currentId, doc: normalizeDoc(current).doc, updatedAt: now });
  }
  const presets = readJson(LEGACY_PRESETS_KEY);
  if (Array.isArray(presets)) {
    for (const p of presets as { name?: unknown; savedAt?: unknown; doc?: unknown }[]) {
      if (!isDocLike(p.doc)) continue;
      const doc = normalizeDoc(p.doc).doc;
      projects.push({
        id: newId(),
        doc: typeof p.name === "string" && p.name ? { ...doc, name: p.name } : doc,
        updatedAt: typeof p.savedAt === "string" ? p.savedAt : now,
      });
    }
  }
  return { currentId, projects };
}

/** Reads the store, migrating older storage on first use. Never throws. */
export function loadProjects(): ProjectStore {
  if (typeof window === "undefined") return { currentId: null, projects: [] };
  const parsed = readJson(PROJECTS_KEY);
  if (!parsed || typeof parsed !== "object") return migrateLegacy();
  const store = parsed as Partial<ProjectStore>;
  const projects = (Array.isArray(store.projects) ? store.projects : [])
    .filter((p): p is Project => !!p && typeof p === "object" && typeof p.id === "string" && isDocLike(p.doc))
    .map((p) => ({ id: p.id, updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : new Date(0).toISOString(), doc: normalizeDoc(p.doc).doc }));
  const currentId = typeof store.currentId === "string" && projects.some((p) => p.id === store.currentId) ? store.currentId : null;
  return { currentId, projects };
}

/** Writes the store; returns a message when the browser refused (quota). */
export function saveProjects(store: ProjectStore): string | null {
  if (typeof window === "undefined") return null;
  try {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(store));
    // Mirror the current document into the legacy slot so older links into
    // the autosave (tests, bookmarks of the previous build) still see it.
    const current = store.projects.find((p) => p.id === store.currentId);
    if (current) window.localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify(current.doc));
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Could not save";
  }
}

/** Puts `doc` in the current project's slot (creating the slot when there is none). */
export function upsertCurrent(store: ProjectStore, doc: StudioDoc, now = new Date().toISOString()): ProjectStore {
  const id = store.currentId ?? newId();
  const exists = store.projects.some((p) => p.id === id);
  const projects = exists
    ? store.projects.map((p) => (p.id === id ? { ...p, doc, updatedAt: now } : p))
    : [...store.projects, { id, doc, updatedAt: now }];
  return { currentId: id, projects };
}

/** Adds a project and makes it current. */
export function addProject(store: ProjectStore, doc: StudioDoc, now = new Date().toISOString()): ProjectStore {
  const project = { id: newId(), doc, updatedAt: now };
  return { currentId: project.id, projects: [...store.projects, project] };
}

export function removeProject(store: ProjectStore, id: string): ProjectStore {
  const projects = store.projects.filter((p) => p.id !== id);
  const currentId = store.currentId === id ? (projects.length ? projects[projects.length - 1].id : null) : store.currentId;
  return { currentId, projects };
}

export function renameProject(store: ProjectStore, id: string, name: string): ProjectStore {
  return { ...store, projects: store.projects.map((p) => (p.id === id ? { ...p, doc: { ...p.doc, name } } : p)) };
}

export function duplicateProject(store: ProjectStore, id: string, now = new Date().toISOString()): ProjectStore {
  const source = store.projects.find((p) => p.id === id);
  if (!source) return store;
  return addProject(store, { ...source.doc, name: `${source.doc.name} copy` }, now);
}

/** Most recently edited first. */
export function recentFirst(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
