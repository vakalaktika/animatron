# Animatron

## What it is

A free, browser-only animation studio for short motion pieces: intros, loaders, social clips, site hero animations. One shared clock drives every layer, so everything is scrubbable, loopable and deterministic, and the same engine renders the editor, the thumbnails and the exported React component.

## Who it is for

People who want a short, polished animation without learning an animation tool: a founder making an intro, a designer sketching a loader, a developer who wants the result as code. They arrive knowing Keynote, Canva or Figma, and expect those conventions (click to select, drag to move, undo, arrow keys, templates).

## What makes it different

- Direct manipulation on the canvas: drag anything, drag the numbered dots to shape a path, and the playhead follows the point you are editing.
- Layers can ride other layers: text can sit on the tip of a ribbon as it draws itself in.
- Hand-drawn squiggles become ribbons, flight paths or pictures.
- Everything lives in the browser. No account, no server, nothing uploaded; compositions autosave locally and travel as a link or a JSON file.

## Surfaces

- `/` the studio (Operate mode): canvas, add rail, layers, settings, timeline. Desktop, phone portrait and phone landscape shells.
- `/squiggle` the Squiggle Studio (Operate mode): a drawing surface whose strokes are sent to the studio.

## Boundaries

- Keep the Atomic Age visual system (warm paper, teal primary, Fraunces / Jost / Work Sans). Brand lives in details, not decoration.
- Plain language in the interface. Units in the value box, never the label. No persistent manual text; help lives behind `?` and in tooltips.
- The engine's document model (`src/app/components/motion-studio/types.ts`) is the contract; the editor never adds fields the runtime cannot play.
- Nothing destructive without undo.
- Big files (video, sound) live in the browser's IndexedDB media store and are referenced by id; the JSON document stays small enough for localStorage and share links. A JSON download inlines them so the file stands on its own.
- One sound track per composition. Per-layer sound would need a mixer UI the product does not want yet.
- Templates are generic and built only from the clip types the studio already plays (text, shapes, ribbons), in the four offered frame sizes, with placeholder copy that is obviously meant to be replaced. No brand artwork.
