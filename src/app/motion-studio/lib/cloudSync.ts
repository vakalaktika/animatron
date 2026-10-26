import type { StudioDoc } from "@/app/components/motion-studio/types";
import { welcomePreset } from "../presets";
import { normalizeDoc, type RawDoc } from "./migrate";
import { hasMedia } from "./mediaDoc";
import type { RemoteProject } from "./cloud";
import type { Project, ProjectStore } from "./projects";

/**
 * What a sync does, decided from the two lists alone: newer wins, by the
 * time each side was last edited. A composition with video or sound stays
 * in this browser (the files live in the browser's media store, not in the
 * document), so it is never pushed and is reported instead; nor is the
 * untouched Welcome composition.
 */
export interface SyncPlan {
  push: Project[];
  pull: RemoteProject[];
  /** Local compositions that can't go up because of their media. */
  keptLocal: Project[];
}

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

/** JSON with object keys sorted, so two equal documents compare equal however they were built. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v,
  );
}

let starter: string | null = null;

/**
 * The untouched Welcome composition every new browser starts with. It is
 * never pushed: otherwise each browser that signs in adds another copy of
 * it to the account.
 */
export function isStarterDoc(doc: StudioDoc): boolean {
  starter ??= canonical(normalizeDoc(welcomePreset()).doc);
  return canonical(doc) === starter;
}

export function planSync(local: Project[], remote: RemoteProject[]): SyncPlan {
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const localById = new Map(local.map((p) => [p.id, p]));
  const keptLocal = local.filter((p) => hasMedia(p.doc));
  const push = local.filter((p) => {
    if (hasMedia(p.doc) || isStarterDoc(p.doc)) return false;
    const there = remoteById.get(p.id);
    return !there || time(p.updatedAt) > time(there.updatedAt);
  });
  const pull = remote.filter((r) => {
    const here = localById.get(r.id);
    return !here || time(r.updatedAt) > time(here.updatedAt);
  });
  return { push, pull, keptLocal };
}

/**
 * The store with pulled compositions merged in, each repaired like an opened
 * file; ones that don't read as a composition are skipped and counted. The
 * open composition is replaced too when the account has a newer copy; the
 * caller reloads it.
 */
export function applyPull(store: ProjectStore, pulled: RemoteProject[]): { store: ProjectStore; skipped: number } {
  let skipped = 0;
  const incoming: Project[] = [];
  for (const r of pulled) {
    const raw = r.doc as Partial<RawDoc> | null;
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.clips) || !raw.stage) {
      skipped++;
      continue;
    }
    incoming.push({ id: r.id, doc: normalizeDoc(raw as RawDoc).doc, updatedAt: r.updatedAt });
  }
  const byId = new Map(incoming.map((p) => [p.id, p]));
  const merged = store.projects.map((p) => byId.get(p.id) ?? p);
  const added = incoming.filter((p) => !store.projects.some((q) => q.id === p.id));
  return { store: { ...store, projects: [...merged, ...added] }, skipped };
}
