# Animatron share pages

Link previews for compositions shared from [Animatron](../README.md): `/s/<id>` is the page behind a short link, with the Open Graph tags chat apps read. It only reads from the studio's Supabase project (one RPC and the public card bucket) and stores nothing. See [docs/share-links.md](../docs/share-links.md) for what it does and how to set it up.

```sh
npm ci
SUPABASE_URL=… SUPABASE_ANON_KEY=… npm run dev     # http://localhost:3100
npm run typecheck && npm test
```
