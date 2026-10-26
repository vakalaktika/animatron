"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import type { Cloud } from "./useCloud";
import { isStarterDoc } from "./cloudSync";
import { hasMedia } from "./mediaDoc";
import { saveProjects, upsertCurrent, type ProjectStore } from "./projects";

/** Seconds of quiet after an edit before the open composition goes up to the account. */
const PUSH_DEBOUNCE_MS = 3000;

const message = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong with your account.");

interface Options {
  cloud: Cloud;
  store: ProjectStore;
  storeRef: MutableRefObject<ProjectStore>;
  doc: StudioDoc;
  setStore: (store: ProjectStore) => void;
  replaceDoc: (doc: StudioDoc) => void;
  notify: (text: string, extra?: { sticky?: boolean }) => void;
}

function summary(pushed: number, pulled: number, keptLocal: number): string {
  const parts = [
    pushed > 0 && `${pushed} saved to your account`,
    pulled > 0 && `${pulled} brought in from it`,
  ].filter(Boolean);
  const head = parts.length > 0 ? `Synced: ${parts.join(", ")}.` : "Everything is in sync.";
  const kept = keptLocal > 0 ? ` ${keptLocal} with video or sound ${keptLocal === 1 ? "stays" : "stay"} in this browser.` : "";
  return head + kept;
}

/**
 * Keeps compositions in step with the signed-in account: a full sync right
 * after signing in (and on request), the open composition pushed a few
 * seconds after each edit, and deletions passed on. Returns the manual sync
 * and the delete hook for the gallery.
 */
export function useCloudSync({ cloud, store, storeRef, doc, setStore, replaceDoc, notify }: Options) {
  const signedIn = cloud.user.kind === "account";
  const userId = cloud.user.kind === "account" ? cloud.user.id : null;

  const syncNow = useCallback(
    async (manual: boolean) => {
      try {
        const before = upsertCurrent(storeRef.current, doc);
        const result = await cloud.sync(before);
        const err = saveProjects(result.store);
        setStore(result.store);
        if (err) notify(`Couldn't save to this browser: ${err}.`, { sticky: true });
        // A newer copy of the open composition came down: show it.
        const current = result.store.projects.find((p) => p.id === result.store.currentId);
        const was = before.projects.find((p) => p.id === before.currentId);
        if (current && was && current.updatedAt !== was.updatedAt) replaceDoc(current.doc);
        if (manual || result.pushed + result.pulled > 0) notify(summary(result.pushed, result.pulled, result.keptLocal));
      } catch (err) {
        notify(message(err), { sticky: manual });
      }
    },
    [cloud, doc, notify, replaceDoc, setStore, storeRef],
  );

  // Sync once for each account that signs in.
  const syncedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || syncedFor.current === userId) return;
    syncedFor.current = userId;
    void syncNow(false);
  }, [userId, syncNow]);

  // Push the open composition after edits settle (the autosave has run by then).
  const pushed = useRef(new Map<string, string>());
  const current = store.projects.find((p) => p.id === store.currentId);
  useEffect(() => {
    if (!signedIn || !current || hasMedia(current.doc) || isStarterDoc(current.doc) || pushed.current.get(current.id) === current.updatedAt) return;
    const timer = window.setTimeout(() => {
      cloud
        .push([current])
        .then(() => pushed.current.set(current.id, current.updatedAt))
        .catch((err: unknown) => notify(message(err)));
    }, PUSH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [signedIn, current, cloud, notify]);

  const removeRemote = useCallback(
    (id: string) => {
      if (!signedIn) return;
      cloud.remove(id).catch((err: unknown) => notify(message(err)));
    },
    [signedIn, cloud, notify],
  );

  return { syncNow, removeRemote };
}
