# Animatron

A browser-based animation and motion design studio. Compose layers, edit SVG text, animate artwork, paint rainbow ribbons and trails, and export JSON, React code, or recordings. The Squiggle Studio at `/squiggle` draws freehand rainbow squiggles and sends them to the Motion Studio as a ribbon, a Chippy flight, or still artwork.

Live app: https://vakalaktika.github.io/animatron/

## Development

Requires Node.js 20.9 or newer.

```sh
npm ci
npm run dev
```

The studio opens at http://localhost:3000. Documents, presets and squiggles are saved in browser local storage; export JSON for portable backups. No account or server is required.

```sh
npm run typecheck
npm test
```

Engine and editor logic is covered by Vitest; CI runs both before deploying.

## Deployment

Push to `main` to build and deploy automatically using GitHub Actions. Repository Settings → Pages must use **GitHub Actions** as its source.

```sh
NEXT_PUBLIC_BASE_PATH=/animatron npm run build
```

The static site is emitted to `out/`. The workflow derives the base path from the repository name so scripts and self-hosted fonts resolve under the Pages URL.

## Origin

Extracted from the Motion Studio in `HovaLabs/the-a-team`, revision `6f8afe1`, preserving the standalone autosave and static image adaptations. Ribbons, sprite trails, the rainbow engine and the Squiggle Studio were ported from `The-A-Team-Project/the-a-team` at `a09a88b` (October 2026), restyled to Animatron's own design system.
