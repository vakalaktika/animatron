"use client";

import { useState, type FormEvent } from "react";
import { Button, TextInput } from "@/app/components/shared-components";
import type { CloudUser } from "../lib/cloud";

export interface AccountControls {
  /** A Supabase project is configured; without one the strip isn't shown. */
  enabled: boolean;
  user: CloudUser;
  /** Where the last sign-in link went, until it is used. */
  pendingEmail: string | null;
  syncing: boolean;
  onSendLink: (email: string) => Promise<void>;
  onSignOut: () => void;
  onSync: () => void;
}

/**
 * The account line at the top of Compositions. Signed out (or only holding
 * the anonymous session a share link made), it offers an emailed sign-in
 * link; signed in, it names the account, syncs on request and signs out.
 */
export function AccountStrip({ enabled, user, pendingEmail, syncing, onSendLink, onSignOut, onSync }: AccountControls) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!enabled) return null;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await onSendLink(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the link.");
    } finally {
      setSending(false);
    }
  };

  if (user.kind === "account") {
    return (
      <section aria-label="Your account" className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-surface px-4 py-3">
        <p className="min-w-0 flex-1 text-sm text-ink">
          Saved to your account as <strong className="font-semibold">{user.email}</strong>. Compositions with video or sound stay in this browser.
        </p>
        <Button size="xs" variant="outline" disabled={syncing} onClick={onSync}>
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
        <Button size="xs" variant="outline" onClick={onSignOut}>
          Sign out
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="account-title" className="mb-6 rounded-lg border border-hairline bg-surface px-4 py-3">
      <h3 id="account-title" className="text-sm font-semibold text-ink">
        Keep your compositions in an account
      </h3>
      <p className="mt-0.5 text-sm text-ink-muted">
        {pendingEmail
          ? `We sent a sign-in link to ${pendingEmail}. Open it in this browser to finish.`
          : "They sync to every browser you sign in on. No password: we email you a link."}
      </p>
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => void submit(e)}>
        <label className="min-w-0 flex-1 basis-56">
          <span className="mb-1 block atm-label">Email</span>
          <TextInput
            variant="compact"
            type="email"
            autoComplete="email"
            required
            className="w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <Button size="xs" type="submit" disabled={sending || email.trim() === ""}>
          {sending ? "Sending…" : pendingEmail ? "Send another link" : "Email me a sign-in link"}
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-2 rounded-md bg-error-soft px-3 py-2 text-sm text-ink">
          {error}
        </p>
      )}
    </section>
  );
}
