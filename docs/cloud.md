# Cloud save and short links

The studio is a static site on GitHub Pages. Accounts, synced compositions
and short share links come from a [Supabase](https://supabase.com) project
that the browser talks to directly with the public anon key; every rule is
row-level security in `supabase/migrations/`. With no project configured the
cloud is off and nothing changes: share links carry the whole composition
and compositions stay in the browser.

## What it does

- **Short links.** *Share → Copy link* stores a copy of the composition and
  copies `…/animatron/?s=<id>`. Opening it adds that copy to the visitor's
  compositions, as a long link does. Making one needs no account: the studio
  starts an anonymous session for it. Compositions with video or sound can't
  be shared by link (the files live in the browser's media store).
- **Accounts.** *Compositions* offers an emailed sign-in link (no password).
  An anonymous session from making links is upgraded in place, so its links
  stay its own.
- **Sync.** Signed in, every composition syncs right away (newer edit wins,
  per composition), the open one is saved to the account a few seconds after
  each edit, and deleting one leaves a tombstone so every other device drops
  its copy on its next sync (unless it was edited after the deletion).
  *Sync now* runs a full sync on demand. Compositions with video or sound,
  and the untouched Welcome composition, stay in the browser.

## How it is protected

- Shares can't be listed. The table is readable only by its owner; anyone
  else opens a share through `get_share(id)`, which returns one document by
  its exact 10-character id.
- Each session can make 50 shares a day; an account holds up to 1000
  compositions. Anonymous sessions can make shares but can't keep
  compositions.
- The database decides which copy is newer: a save never stamps a time
  ahead of the server clock, and a save older than the stored copy is
  ignored, so a stale device can't overwrite newer work.
- Only composition-shaped documents are stored. Everything opened from a
  link or an account is repaired like any imported file, pictures must be
  carried inside the document (web addresses are dropped), and Lottie files
  play through lottie-web's light build, which never evaluates expressions.

## Setting it up

1. Create a Supabase project (free tier is fine).
2. Run `supabase/migrations/20261026000000_cloud.sql` in the SQL editor (or
   `supabase db push` with the CLI linked to the project).
3. **Authentication → Sign In / Providers**: keep *Email* on and turn on
   *Allow anonymous sign-ins*. Consider a CAPTCHA (Turnstile or hCaptcha)
   under *Attack Protection*, since anonymous sessions can create links.
4. **Authentication → URL Configuration**: set the *Site URL* to the studio,
   e.g. `https://<user>.github.io/animatron/`, and add it (plus
   `http://localhost:3000/` for development) to the redirect allow list. The
   sign-in email links back to the page it was requested from.
5. In the GitHub repository, **Settings → Secrets and variables → Actions →
   Variables**, add `SUPABASE_URL` (the project URL) and `SUPABASE_ANON_KEY`
   (the anon / publishable key). The deploy workflow passes them to the build.
6. Locally: `NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… npm run dev`.

Never put the service-role key anywhere in this repository or the build: the
anon key plus row-level security is the whole design.

## Limits

- A share holds up to about 2 MB of composition (pictures included); a
  synced composition up to about 5 MB. Larger ones are refused with a
  message, and a JSON download always works.
- Deleting a composition while offline doesn't reach the account; the next
  sync brings it back.
- Signing out keeps the compositions in this browser.
- Shares are never edited, only made and (by their owner) deleted; there is
  no UI to delete one yet.
