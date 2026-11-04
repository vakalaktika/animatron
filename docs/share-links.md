# Short share links and link previews

The studio is a static site on GitHub Pages, and a share link used to carry
the whole composition in its hash: thousands of characters that no chat
app wants to show. Short links come from a small service in `share/`, a
Next.js app deployed on Vercel with Blob storage. With it configured,
*Share → Copy link* gives something like

    https://animatron-share.vercel.app/s/Ab3dEfGh9k

and pasting that anywhere shows a preview card: the composition's name, a
sentence about it, its frame size and length, and a picture of it. With
nothing configured, nothing changes: links stay long and everything stays
in the browser.

## What happens

1. *Copy link* draws one frame of the composition (two thirds of the way
   in, as the gallery tiles do) onto a 1200 × 630 dark card, right in the
   browser, and sends the card, the composition and its length to the
   service. The *What is it?* field under the button is the sentence the
   card and the page show; it is saved with the composition.
2. The service checks the shape and size of what it got (a composition up
   to 2 MB, a PNG up to 1.5 MB, nothing with video or sound) and keeps the
   three files under a fresh ten-character id. Nothing is ever overwritten.
3. `/s/<id>` is the share page: the card, the name, the sentence, *Add to
   my Compositions* and *Copy link*. Its `<head>` carries the Open Graph
   and Twitter tags that chat apps and social sites read.
4. *Add to my Compositions* opens the studio at `#s=<id>`; the studio
   fetches the composition from `/api/share/<id>` and adds it to the
   visitor's compositions, as a long link does. Long links keep working.

## Setting it up

1. Deploy `share/` to Vercel as its own project: **Add New → Project**,
   import the repository, set **Root Directory** to `share`. Framework
   Next.js, no other build settings.
2. **Storage → Create → Blob**, connect it to the project. This sets
   `BLOB_READ_WRITE_TOKEN` for you.
3. Environment variables on the project:
   - `STUDIO_URL`: where the studio lives, `https://vakalaktika.github.io/animatron/`
     (that is the default; set it if the studio moves).
   - `SHARE_URL` (optional): the public address of the service, if it has a
     custom domain. Otherwise the project's production URL is used.
   - `ALLOWED_ORIGINS` (optional): other sites allowed to make links from a
     browser, comma-separated. The studio's origin and `http://localhost:3000`
     are always allowed.
4. In the GitHub repository, **Settings → Secrets and variables → Actions →
   Variables**, add `SHARE_ORIGIN` with the service's address, e.g.
   `https://animatron-share.vercel.app`. The deploy workflow passes it to the
   build as `NEXT_PUBLIC_SHARE_ORIGIN`; the next push to `main` turns short
   links on.
5. Worth doing: a Vercel Firewall rate-limit rule on `/api/share` (say, 30
   requests a minute per IP). The service limits sizes and validates shapes
   but does not count requests itself.

Locally:

```sh
cd share && npm ci && STUDIO_URL=http://localhost:3000/ npm run dev   # :3100, files in share/.share-data
NEXT_PUBLIC_SHARE_ORIGIN=http://localhost:3100 npm run dev            # the studio, in another terminal
```

Without `BLOB_READ_WRITE_TOKEN` the service keeps shares in `share/.share-data/`
when not in production; in production it refuses to start without a store.

## Limits and notes

- A share is public to anyone with the link and cannot be listed or
  guessed (ten characters from a 58-letter alphabet). There is no UI to
  delete one; remove its folder from the Blob store to take it down.
- Compositions with video or sound can't be shared by link: the files live
  in the browser's media store. A JSON download carries them.
- The preview is one frame, not a loop. A chat app shows the card; opening
  the link in the studio plays the piece.
