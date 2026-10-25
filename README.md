# Animatron

A free, browser-based animation studio. Add text, speech bubbles, shapes, pictures, Lottie files and rainbow ribbons to a canvas; fly things along hand-shaped paths; then share a link, record a video, or take the composition away as JSON or React code. The Squiggle Studio at `/squiggle` draws freehand squiggles and sends them to the canvas as a ribbon, a flight path, or a picture.

Live app: https://vakalaktika.github.io/animatron/

## How it works

- **Add** anything from the rail beside the canvas (or the floating **+** on a phone): text, a speech bubble, a shape, a picture or Lottie, a ribbon, a hand-drawn squiggle, Chippy, the logo rings.
- **Edit** by picking it: drag it on the canvas (it snaps to the centre and to other layers; hold Alt to skip), drag the numbered dots to reshape a path, or change it in the panel on the right. Every panel leads with the basics and tucks the fine-tuning under *Fine-tune*.
- **Undo** anything with ⌘Z / Ctrl+Z. Arrow keys nudge, Delete removes, ⌘D duplicates, ⌘C / ⌘V copy and paste. Press **?** for the full list.
- **Compositions** keeps every piece you work on in this browser, with live thumbnails, plus the templates and a blank canvas in any frame.
- **Resize and turn** anything with the corner handles and the turn handle above it; shift-click to pick several layers and move or delete them together. Drag the right end of a timeline bar to make a clip longer or shorter.
- **Draw** with the pen in the add bar: a line on the canvas becomes a ribbon where you drew it, or the flight path of the picture you picked first.
- **Share** copies a link that carries the whole composition, renders an MP4, GIF or see-through WebM frame by frame in the browser (no screen capture, keeps going in a background tab, carries the sound track), downloads JSON with any video and sound inside it, or shows the React component for developers.
- **Video and sound**: drop in an MP4 or MOV as a backdrop or a travelling picture (it seeks frame-exact in renders); add one music or voice-over track that plays in the preview and is encoded into MP4 and WebM renders.
- **Pace**: every move picks from seven easing curves with live previews, or a custom two-handle bezier.
- **First-run tour**: three stops on the first visit, replayable from Help.

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
