# Animatron

A browser-based animation and motion design studio. Compose layers, edit SVG text, animate artwork, and export JSON, React code, or recordings.

Live app: https://vakalaktika.github.io/animatron/

## Development

Requires Node.js 20.9 or newer.

```sh
npm ci
npm run dev
```

The studio opens at http://localhost:3000. Documents and presets are saved in browser local storage; export JSON for portable backups. No account or server is required.

## Deployment

Push to `main` to build and deploy automatically using GitHub Actions. Repository Settings → Pages must use **GitHub Actions** as its source.

```sh
NEXT_PUBLIC_BASE_PATH=/animatron npm run build
```

The static site is emitted to `out/`. The workflow derives the base path from the repository name so scripts and self-hosted fonts resolve under the Pages URL.

## Origin

Extracted from the Motion Studio in `HovaLabs/the-a-team`, revision `6f8afe1`, preserving the standalone autosave and static image adaptations.
