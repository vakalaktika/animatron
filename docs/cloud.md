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
  each edit, and deleting one deletes it from the account. *Sync now* runs a
  full sync on demand. Compositions with video or sound stay in the browser.

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
- Shares are never edited, only made and (by their owner) deleted; there is
  no UI to delete one yet.
