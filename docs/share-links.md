# Short share links and link previews

A share link used to carry the whole composition in its hash: thousands of
characters that no chat app wants to show. With the cloud configured
(`docs/cloud.md`), *Share → Copy link* stores a copy of the composition in
Supabase and copies a short link instead. This page is about the second
half: making that link show a preview card wherever it is pasted.

The preview comes from a small service in `share/`, a Next.js app deployed
on Vercel that only reads. With it configured, *Copy link* gives something
like

    https://animatron-share.vercel.app/s/Ab3dEfGh9k

and pasting that anywhere shows the composition's name, a sentence about
it, its frame size and length, and a picture of it. Without it, short links
still work: they open the studio directly (`…/animatron/?s=<id>`), with no
preview.

## What happens

1. *Copy link* draws one frame of the composition (two thirds of the way
   in, as the gallery tiles do) onto a 1200 × 630 dark card, right in the
   browser. The *What is it?* field under the button is the sentence the
   card and the page show; it is saved with the composition as
   `description`.
2. The studio stores the composition in the `shares` table with its length
   (as before, under the anonymous session's row-level rules) and uploads
   the card to the public `share-cards` bucket as `<id>.png`. Only the
   share's owner can add its card, and only once. A card that fails to
   upload is reported next to the link; the link still works.
3. `/s/<id>` on the service is the share page: the card, the name, the
   sentence, *Add to my Compositions* and *Copy link*. Its `<head>` carries
   the Open Graph and Twitter tags that chat apps and social sites read.
   The service reads one RPC, `get_share_meta`, which returns only what the
   page shows (never the document), and the card from the bucket.
   `/s/<id>/card.png` serves the card from the service's own domain.
4. *Add to my Compositions* opens the studio at `?s=<id>`; the studio
   fetches the composition through `get_share` and adds it to the visitor's
   compositions, as before. Long links keep working.

## Setting it up

The cloud must already be configured (`docs/cloud.md`). Then:

1. Run `supabase/migrations/20261104000000_share_pages.sql` in the SQL
   editor (or `supabase db push`). It adds the `duration` column, the
   `get_share_meta` function and the `share-cards` bucket with its insert
   policy.
2. Deploy `share/` to Vercel as its own project: **Add New → Project**,
   import the repository, set **Root Directory** to `share`. Framework
   Next.js, no other build settings.
3. Environment variables on the project:
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY`: the same project URL and anon
     key the studio uses. The service reads with the anon key only.
   - `STUDIO_URL`: where the studio lives,
     `https://vakalaktika.github.io/animatron/` (that is the default; set
     it if the studio moves).
   - `SHARE_URL` (optional): the public address of the service, if it has a
     custom domain. Otherwise the project's production URL is used.
4. In the GitHub repository, **Settings → Secrets and variables → Actions →
   Variables**, add `SHARE_ORIGIN` with the service's address, e.g.
   `https://animatron-share.vercel.app`. The deploy workflow passes it to the
   build as `NEXT_PUBLIC_SHARE_ORIGIN`; the next push to `main` makes
   *Copy link* hand out share-page links.

Locally:

```sh
cd share && npm ci && SUPABASE_URL=… SUPABASE_ANON_KEY=… STUDIO_URL=http://localhost:3000/ npm run dev   # :3100
NEXT_PUBLIC_SHARE_ORIGIN=http://localhost:3100 NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… npm run dev
```

## Limits and notes

- The service holds no data and takes no uploads; everything a link needs
  lives in the Supabase project, under the same limits as cloud save (50
  shares a session a day, 2 MB a composition, 1.5 MB a card).
- A share is public to anyone with the link and cannot be listed; both the
  meta RPC and the bucket need the exact id. There is no UI to delete one.
- Compositions with video or sound can't be shared by link: the files live
  in the browser's media store. A JSON download carries them.
- The preview is one frame, not a loop. A chat app shows the card; opening
  the link in the studio plays the piece.
