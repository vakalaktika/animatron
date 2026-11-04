# Share pages and link previews

Short links come from the Supabase project behind cloud save (see
[cloud.md](cloud.md)): *Share → Copy link* stores a copy of the composition
and the link names it by a ten-character id. On its own that link is
`…/animatron/?s=<id>`, which opens the studio and adds the piece to the
visitor's compositions, but shows nothing when pasted into a chat: GitHub
Pages can only serve the same static page for every link.

The share page service in `share/` fills that gap. It is a small Next.js app
on Vercel that reads the same Supabase project and serves one page per
share. With it set up, *Copy link* gives something like

    https://animatron-share.vercel.app/s/Ab3dEfGh9k

and pasting that anywhere shows a preview card: the composition's name, a
sentence about it, its frame size and length, and a picture of it.

There is one store (Supabase) and one kind of id. The service holds no data
and has no write endpoint; it only reads.

## What happens

1. *Copy link* draws one frame of the composition (two thirds of the way
   in, as the gallery tiles do) onto a 1200 × 630 dark card, right in the
   browser. The *What is it?* field under the button is the sentence the
   card and the page show; it is saved with the composition.
2. The studio stores the composition and its length in the `shares` table,
   then the card as `<id>.png` in the public `share-cards` bucket. Only the
   share's owner can add its card, and only once. If the card can't be
   saved, the link still works; the dialog says so and the page shows no
   picture.
3. The link handed out is `<share page>/s/<id>` when the studio is built
   with `NEXT_PUBLIC_SHARE_ORIGIN`, and the studio's own `?s=<id>` link
   when it isn't. Both lead to the same share.
4. `/s/<id>` reads what it shows through `get_share_meta(id)` (name,
   sentence, size, layer count, length; never the whole document) and
   serves the card from its own domain at `/s/<id>/card.png`. Its `<head>`
   carries the Open Graph and Twitter tags that chat apps and social sites
   read.
5. *Add to my Compositions* opens the studio at `?s=<id>`, which fetches
   the composition from Supabase as any short link does.

## Setting it up

Cloud save has to be set up first ([cloud.md](cloud.md)). Then:

1. Run `supabase/migrations/20261104000000_share_pages.sql` in the SQL
   editor (or `supabase db push`). It adds the length column, the
   `get_share_meta` function and the `share-cards` bucket with its policy.
2. Deploy `share/` to Vercel as its own project: **Add New → Project**,
   import the repository, set **Root Directory** to `share`. Framework
   Next.js, no other build settings.
3. Environment variables on the Vercel project:
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY`: the same public values the
     studio uses. Never the service-role key.
   - `STUDIO_URL`: where the studio lives, `https://vakalaktika.github.io/animatron/`
     (that is the default; set it if the studio moves).
   - `SHARE_URL` (optional): the service's public address, if it has a
     custom domain. Otherwise the project's production URL is used.
4. In the GitHub repository, **Settings → Secrets and variables → Actions →
   Variables**, add `SHARE_ORIGIN` with the service's address, e.g.
   `https://animatron-share.vercel.app`. The deploy workflow passes it to the
   build as `NEXT_PUBLIC_SHARE_ORIGIN`; the next push to `main` makes *Copy
   link* hand out share page links.

Locally, with a Supabase project (or `supabase start`):

```sh
cd share && npm ci && SUPABASE_URL=… SUPABASE_ANON_KEY=… STUDIO_URL=http://localhost:3000/ npm run dev   # :3100
NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… NEXT_PUBLIC_SHARE_ORIGIN=http://localhost:3100 npm run dev
```

## Limits and notes

- A share page is public to anyone with the link; shares can't be listed
  and the id can't reasonably be guessed (60 bits).
- The same limits as short links apply (see [cloud.md](cloud.md)): up to
  about 2 MB of composition, 50 links a day per session, nothing with video
  or sound.
- Shares made before the share page migration have no card or length: their
  page shows the size and sentence without a picture.
- The preview is one frame, not a loop. A chat app shows the card; opening
  the link in the studio plays the piece.
