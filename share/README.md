# Animatron share pages

One page per short link made in [Animatron](../README.md), with the Open Graph card that chat apps show. The studio makes shares in Supabase; this service only reads them. See [docs/share-links.md](../docs/share-links.md) for what it does and how to set it up.

```sh
npm ci
SUPABASE_URL=… SUPABASE_ANON_KEY=… npm run dev     # http://localhost:3100
npm run typecheck && npm test
```
