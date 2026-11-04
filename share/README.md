# Animatron share service

Short links and link previews for compositions made in [Animatron](../README.md). The studio is a static site; this is the one server it talks to. See [docs/share-links.md](../docs/share-links.md) for what it does and how to set it up.

```sh
npm ci
BLOB_READ_WRITE_TOKEN=… npm run dev     # http://localhost:3100
npm run typecheck && npm test
```
