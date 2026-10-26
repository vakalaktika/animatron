"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import {
  cloudClient,
  cloudConfig,
  createShare,
  deleteRemoteProject,
  fetchShare,
  listRemoteProjects,
  pushProjects,
  sendSignInLink,
  shortShareUrl,
  signOut as endSession,
  userFromSession,
  type CloudUser,
} from "./cloud";
import { planSync } from "./cloudSync";
import type { Project, ProjectStore } from "./projects";
import type { RemoteProject } from "./cloud";

export interface SyncResult {
  pushed: number;
  /** Newer or new compositions to merge in (the caller merges into its latest store). */
  pull: RemoteProject[];
  /** Compositions deleted in the account after their last edit here. */
  remove: string[];
  /** Compositions with video or sound, which stay in this browser. */
  keptLocal: number;
  /** Compositions too big for the account, which stay in this browser. */
  tooBig: number;
}

export interface Cloud {
  /** A Supabase project is configured for this build. */
  enabled: boolean;
  user: CloudUser;
  /** A sign-in link went to this address and hasn't been used yet. */
  pendingEmail: string | null;
  syncing: boolean;
  /** Stores the composition and returns its short link. */
  shortLink: (doc: StudioDoc) => Promise<string>;
  openShare: (id: string) => Promise<StudioDoc | null>;
  sendLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Pushes what is newer here and reports what to bring in or remove; the caller applies that. */
  sync: (store: ProjectStore) => Promise<SyncResult>;
  /** Saves compositions; resolves to the ones too big for the account. */
  push: (projects: Project[]) => Promise<Project[]>;
  remove: (id: string, name: string) => Promise<void>;
}

const OFF = (): never => {
  throw new Error("The cloud isn't set up for this copy of the studio.");
};

/**
 * The studio's view of the cloud: who is signed in, kept current by the
 * client's auth events, and the operations the studio performs. Every
 * operation rejects with a message fit to show; the studio decides what to
 * do with results (which store to save, which document to reopen).
 */
export function useCloud(): Cloud {
  const config = useMemo(() => cloudConfig(), []);
  const [user, setUser] = useState<CloudUser>({ kind: "none" });
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!config) return;
    let live = true;
    let unsubscribe: (() => void) | null = null;
    void cloudClient(config).then((supabase) => {
      if (!live) return;
      // Fires once with the stored session (or the one a sign-in link brought back), then on every change.
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(userFromSession(session));
        if (session?.user.email && !session.user.is_anonymous) setPendingEmail(null);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, [config]);

  const withClient = useCallback(async () => (config ? cloudClient(config) : OFF()), [config]);

  const shortLink = useCallback(
    async (doc: StudioDoc) => shortShareUrl(await createShare(await withClient(), doc), window.location),
    [withClient],
  );
  const openShare = useCallback(async (id: string) => fetchShare(await withClient(), id), [withClient]);
  const sendLink = useCallback(
    async (email: string) => {
      await sendSignInLink(await withClient(), email, `${window.location.origin}${window.location.pathname}`);
      setPendingEmail(email.trim());
    },
    [withClient],
  );
  const signOut = useCallback(async () => endSession(await withClient()), [withClient]);
  const push = useCallback(async (projects: Project[]) => pushProjects(await withClient(), projects), [withClient]);
  const remove = useCallback(async (id: string, name: string) => deleteRemoteProject(await withClient(), id, name), [withClient]);

  const sync = useCallback(
    async (store: ProjectStore): Promise<SyncResult> => {
      const supabase = await withClient();
      setSyncing(true);
      try {
        const plan = planSync(store.projects, await listRemoteProjects(supabase));
        const tooBig = await pushProjects(supabase, plan.push);
        return { pushed: plan.push.length - tooBig.length, pull: plan.pull, remove: plan.remove, keptLocal: plan.keptLocal.length, tooBig: tooBig.length };
      } finally {
        setSyncing(false);
      }
    },
    [withClient],
  );

  // One object per change of state, so effects that depend on the cloud don't re-run every render.
  return useMemo(
    () => ({ enabled: config !== null, user, pendingEmail, syncing, shortLink, openShare, sendLink, signOut, sync, push, remove }),
    [config, user, pendingEmail, syncing, shortLink, openShare, sendLink, signOut, sync, push, remove],
  );
}
