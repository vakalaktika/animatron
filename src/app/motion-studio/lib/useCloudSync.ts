"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import type { Cloud } from "./useCloud";
import { applyPull, isStarterDoc } from "./cloudSync";
import { hasMedia } from "./mediaDoc";
import { saveProjects, upsertCurrent, type ProjectStore } from "./projects";

/** Seconds of quiet after an edit before the open composition goes up to the account. */
const PUSH_DEBOUNCE_MS = 3000;

const message = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong with your account.");

interface Options {
  cloud: Cloud;
  store: ProjectStore;
  storeRef: MutableRefObject<ProjectStore>;
  /** The open document as edited right now (it reaches the store after the autosave delay). */
  docRef: MutableRefObject<StudioDoc>;
  setStore: (store: ProjectStore) => void;
  replaceDoc: (doc: StudioDoc) => void;
  /** The open composition was deleted on another device: close it here too (without touching the account). */
  closeCurrent: () => void;
  notify: (text: string, extra?: { sticky?: boolean }) => void;
}

function summary(pushed: number, pulled: number, removed: number, keptLocal: number, tooBig: number): string {
  const parts = [
    pushed > 0 && `${pushed} saved to your account`,
    pulled > 0 && `${pulled} brought in from it`,
    removed > 0 && `${removed} deleted on another device removed here`,
  ].filter(Boolean);
  const head = parts.length > 0 ? `Synced: ${parts.join(", ")}.` : "Everything is in sync.";
  const kept = keptLocal > 0 ? ` ${keptLocal} with video or sound ${keptLocal === 1 ? "stays" : "stay"} in this browser.` : "";
  const big = tooBig > 0 ? ` ${tooBig} too big for the account ${tooBig === 1 ? "stays" : "stay"} in this browser.` : "";
  return head + kept + big;
}

/**
 * Keeps compositions in step with the signed-in account: a full sync right
 * after signing in (and on request), the open composition pushed a few
 * seconds after each edit, and deletions passed on as tombstones. A sync
 * merges into the store as it is when the account answers, and leaves
 * alone anything edited while it was waiting.
 */
export function useCloudSync({ cloud, store, storeRef, docRef, setStore, replaceDoc, closeCurrent, notify }: Options) {
  const signedIn = cloud.user.kind === "account";
  const userId = cloud.user.kind === "account" ? cloud.user.id : null;

  const syncNow = useCallback(
    async (manual: boolean) => {
      try {
        const before = upsertCurrent(storeRef.current, docRef.current);
        const result = await cloud.sync(before);
        const latest = upsertCurrent(storeRef.current, docRef.current);
        const editedSince = (id: string) =>
          before.projects.find((p) => p.id === id)?.updatedAt !== latest.projects.find((p) => p.id === id)?.updatedAt;
        const pull = result.pull.filter((r) => !editedSince(r.id));
        const merged = applyPull(latest, pull, result.remove.filter((id) => !editedSince(id)));
        const err = saveProjects(merged.store);
        setStore(merged.store);
        if (err) notify(`Couldn't save to this browser: ${err}.`, { sticky: true });
        const current = pull.some((r) => r.id === merged.store.currentId) ? merged.store.projects.find((p) => p.id === merged.store.currentId) : undefined;
        if (current) replaceDoc(current.doc);
        if (merged.removedCurrent) closeCurrent();
        const pulled = pull.length - merged.skipped;
        const removed = result.remove.length;
        if (manual || result.pushed + pulled + removed > 0) notify(summary(result.pushed, pulled, removed, result.keptLocal, result.tooBig));
      } catch (err) {
        notify(message(err), { sticky: manual });
      }
    },
    [cloud, docRef, notify, replaceDoc, closeCurrent, setStore, storeRef],
  );

  // Sync once for each sign-in (signing out and back in syncs again).
  const syncedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!userId) {
      syncedFor.current = null;
      return;
    }
    if (syncedFor.current === userId) return;
    syncedFor.current = userId;
    void syncNow(false);
  }, [userId, syncNow]);

  // Push the open composition after edits settle (the autosave has run by
  // then). Each version is tried once: a failure waits for the next edit.
  const tried = useRef(new Map<string, string>());
  const current = store.projects.find((p) => p.id === store.currentId);
  useEffect(() => {
    if (!signedIn || !current || hasMedia(current.doc) || isStarterDoc(current.doc) || tried.current.get(current.id) === current.updatedAt) return;
    const timer = window.setTimeout(() => {
      tried.current.set(current.id, current.updatedAt);
      cloud
        .push([current])
        .then((tooBig) => {
          if (tooBig.length > 0) notify(`“${current.doc.name}” is too big for your account; it stays in this browser.`);
        })
        .catch((err: unknown) => notify(message(err)));
    }, PUSH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [signedIn, current, cloud, notify]);

  const removeRemote = useCallback(
    (id: string, name: string) => {
      if (!signedIn) return;
      cloud.remove(id, name).catch((err: unknown) => notify(message(err)));
    },
    [signedIn, cloud, notify],
  );

  return { syncNow, removeRemote };
}
