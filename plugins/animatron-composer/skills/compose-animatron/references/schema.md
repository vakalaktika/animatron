# Animatron composition schema (document version 2)

Written from `src/app/components/motion-studio/types.ts` and the repair code in
`src/app/motion-studio/lib/migrate.ts` at the commit in `../schema.lock.json`.
If the validator reports drift, the repo wins over this file.

## The rule that matters most

The studio's repair step **fills in any missing field with a default**. The
validator counts a filled-in field as a change, so a file only passes when it
spells out **every field of every clip**. Start from the skeletons below (or
from `../examples/`) and change values; never leave fields out.

Key order doesn't matter. `undefined` never appears in JSON. Optional fields
(`rotation`, `opacity`, `keys`, `along`, `flow`, `description`, `audio`) may be
left out entirely; if present they must be well-formed.

## Document

```json
{
  "version": 2,
  "name": "Reel hook",
  "description": "One sentence for the share page (optional)",
  "stage": { "width": 1080, "height": 1920, "background": "#16283a", "transparent": false },
  "clips": [ ... ]
}
```

- `version`: always `2` (`DOC_VERSION`).
- `name`: non-empty (an empty name is replaced by the file name: a change).
- `stage.width` / `height`: whole pixels. Offered frames: 1920×1080 video,
  1080×1080 square post, 1080×1920 story/reel, 1440×900 site hero. Any other
  size also works ("custom").
- `stage.background`: any CSS colour. `transparent: true` drops it (for
  see-through WebM renders).
- `audio`: leave out. Sound lives in the browser's media store and can't travel.
- **Composition length is not stored.** It is the latest clip end plus a 1 s
  hold (`docDuration`). Tune clip timing so the last clip ends at
  `target − 1` seconds; the validator prints the length.
- **Paint order** is array order (later on top). Every clip must be followed
  directly by its own attached children (depth-first); repair reorders
  otherwise, which counts as a change. Put children right after their parent.

## Fields every clip has (ClipBase)

| Field | Meaning |
|---|---|
| `id` | Unique string. Use readable slugs (`"reel-name"`), never duplicates. |
| `type` | `text`, `sprite`, `ribbon`, `logo`, `lottie`, `rig` (rigs via `scripts/rig.mjs`). |
| `name` | Layer name shown in the studio. Non-empty. |
| `enabled` | `true` (false hides it and drops it from the length). |
| `start` | Seconds on the shared clock when it begins. Absolute, ≥ 0. |
| `x`, `y` | Anchor in stage px (root clip) or offset from the parent's anchor (attached clip). |
| `scale` | Multiplier, 1 = natural. |
| `parentId` | `null`, or the `id` of a clip in the same file (missing parent = repair warning). |
| `followRotation` | `false` usually; `true` makes it turn with its parent. |
| `rotation` | Optional, degrees clockwise. |
| `opacity` | Optional, 0..1. |
| `along` | Optional, only when the parent is a ribbon: `0..1` to sit at that point, `"front"` to ride the paint head. |
| `keys` | Optional keyframes, see below. |

### Keyframes (`keys`)

```json
"keys": {
  "y":       [ { "time": 0, "value": 900, "ease": { "name": "smoothOut" } }, { "time": 0.6, "value": 760, "ease": { "name": "smoothOut" } } ],
  "opacity": [ { "time": 0, "value": 0, "ease": { "name": "inOut" } },      { "time": 0.4, "value": 1, "ease": { "name": "inOut" } } ]
}
```

- Props: `x`, `y`, `scale`, `rotation`, `opacity` (ribbons: only `x`, `y`, `opacity`).
- `time` is seconds **after the clip's start**, 0..600, sorted, at least 0.005 apart.
- `value` is the property's actual value (stage px for a root clip's x/y), and
  while keyed the clip's own field is ignored. Holds the first value before
  the first key and the last after the last.
- **Always write `ease` on every key** (repair adds `{ "name": "inOut" }`
  where it's missing, which counts as a change).
- Keys extend the clip's length to its last key.

### Easing (`ease`)

`{ "name": N }` with N one of: `linear`, `smoothOut` (fast then soft),
`inOut`, `flight` (gentle swoop), `backOut` (overshoot), `anticipate`
(wind-up then overshoot), `snap` (almost all at once, long settle), or
`{ "name": "custom", "custom": [x1, y1, x2, y2] }` (CSS cubic-bezier).

## Text clip

Single line only; stack separate text clips for more lines. The anchor is the
**top centre** of the text (or of its box), or the tail tip when a bubble
tail shows. Fonts: `sans` = Work Sans 500, `serif` = Fraunces 600. Rough
width: `0.55 × fontSize × characters` (serif), `0.52 ×` (sans). Keep it
inside the frame with margin.

```json
{
  "id": "name", "type": "text", "name": "Name", "enabled": true,
  "start": 0.5, "x": 540, "y": 760, "scale": 1, "parentId": null, "followRotation": false,
  "text": "Your name", "font": "serif", "fontSize": 120, "color": "#f6efe3",
  "accentSuffix": "", "accentColor": "#C74028",
  "container": { "shape": "none", "fill": "#ffffff", "stroke": "rgba(0, 0, 0, 0.1)", "padding": { "x": 28, "y": 16 }, "radius": 16 },
  "tail": { "mode": "auto", "side": "bottom", "position": 38, "length": 15 },
  "reveal": "mask", "revealDuration": 0.8, "overshoot": 1.7,
  "letterStagger": 0.04, "letterDuration": 0.45, "direction": "center",
  "rule": false, "ruleDelay": 0.35, "ruleDuration": 0.6, "ruleWidth": 96
}
```

- `reveal` (the text entrance):
  - `letters`: glyphs rise one by one, ordered by `direction` (`center` outward, `left`, `right`); takes `letterStagger × (count−1) + letterDuration`.
  - `typewriter`: types left to right behind a blinking caret, `letterStagger` per glyph.
  - `blur`: comes into focus over `revealDuration`.
  - `mask`: **slides up from behind an invisible edge** over `revealDuration`.
  - `pop`: scales in with `overshoot` bounce (0 = none) over `revealDuration`.
  - `fade`: fades in over `revealDuration`.
- `accentSuffix`: an ending of `text` drawn in `accentColor` (e.g. `".ai"`); `""` for none.
- `container.shape`: `none` (plain text), `soft` (pill/box; radius 999 = pill), `speech`, `thought`, `minimal`. `fill`, `stroke`, `padding`, `radius` style it.
- `tail.mode`: `none` for a pill or tag; `auto` aims a bubble's pointer at its parent; `manual` uses `side` (`top|bottom|left|right`), `position`, `length`. Only drawn when the container isn't `none`.
- `rule`: an underline that draws in after `ruleDelay` for `ruleDuration`, `ruleWidth` px wide.
- `flow`: optional `true` bends the letters along the ribbon the clip is seated on (needs `parentId` = a ribbon and `along`). `x` then slides along the ribbon, `y` lifts off it (negative = above a left-to-right ribbon).

## Sprite clip (shapes, bars, pictures)

A picture that travels along `path` (waypoints relative to its anchor; it
lands on the last one). A shape is an SVG sprite. Exact shape markup (100-unit
box, aspect 1) is produced by `shapeSvg()` in `lib/shapes.ts`:

| kind | body inside the svg |
|---|---|
| circle | `<circle cx="50" cy="50" r="48" fill="F"/>` |
| square | `<rect x="2" y="2" width="96" height="96" fill="F"/>` |
| rounded | `<rect x="2" y="2" width="96" height="96" rx="22" fill="F"/>` |
| triangle | `<polygon points="50,3 97,95 3,95" fill="F"/>` |
| star | `<polygon points="50.0,4.0 61.8,35.8 95.7,37.2 69.0,58.2 78.2,90.8 50.0,72.0 21.8,90.8 31.0,58.2 4.3,37.2 38.2,35.8" fill="F"/>` |
| arrow | `<path d="M4 38h52V16l40 34-40 34V62H4z" fill="F"/>` (points right; `rotation: -90` points up) |
| heart | `<path d="M50 92 C20 70 4 54 4 34 4 20 15 10 28 10c9 0 17 5 22 13 5-8 13-13 22-13 13 0 24 10 24 24 0 20-16 36-46 58z" fill="F"/>` |
| blob | `<path d="M58 6c17 2 32 14 36 31 5 20-6 40-22 51-15 10-36 12-51 2C5 80-2 60 6 42 13 24 32 3 58 6z" fill="F"/>` |

Wrap as `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">BODY</svg>`.
A bar (lower-third plate) is `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 H" width="100" height="H"><rect x="0" y="0" width="100" height="H" rx="1.2" fill="F"/></svg>` with `H = 100 × height / width` to two decimals and `aspect = height / width`. Custom SVG is fine if it's self-contained: no scripts, event handlers, external links or `foreignObject`.

```json
{
  "id": "shape-star", "type": "sprite", "name": "Star", "enabled": true,
  "start": 0.9, "x": 300, "y": 1150, "scale": 1, "parentId": null, "followRotation": false,
  "source": { "kind": "svg", "markup": "<svg ...>...</svg>", "label": "Star", "aspect": 1, "textRuns": [] },
  "width": 160,
  "path": [ { "x": 0, "y": -1000 }, { "x": 0, "y": 0 } ],
  "duration": 0.8, "ease": { "name": "backOut" }, "loop": false,
  "bank": 0, "autoFlip": false, "scaleFrom": 1, "fadeIn": 0.15,
  "flap": { "hz": 3.3, "depth": 34 },
  "landing": { "squash": 0.1, "settleFlaps": 2, "foldAngle": -70, "foldDuration": 0.5 },
  "trail": {
    "enabled": false,
    "style": { "motion": "paint", "tail": 0.8, "hold": 2, "taper": 0.85, "fade": 0.8, "head": 0.35, "nib": 0, "core": false, "echo": 0, "glow": 0, "wiggle": 0, "colour": "fixed", "colourSpeed": 1, "accent": ["#c74028", "#e57b30", "#f9c958"] },
    "colors": ["#457a9d", "#59996a", "#7a5d86"], "band": 8, "fadeOut": 0, "offset": { "along": 0, "across": 0 }
  }
}
```

- `width`: rendered width in px (height = width × aspect).
- `path`: ≥ 2 waypoints, relative to `x, y`. Travels through them over `duration` with `ease`. A still picture: `[{0,0},{0,0}]`. Waypoint extras (all optional): `scale` (multiplier), `rotate` (degrees), `opacity` (0..1), `hold` (seconds paused there, adds to length), `time` (seconds of travel to reach it).
- `scaleFrom`: starting scale that grows to 1 over the travel; `fadeIn`: seconds of fade at the start (0 = pops in). Hidden before `start`.
- `bank`: 0..1 lean into the path; keep 0 for shapes and text-like art.
- `loop: true` with a closed path repeats forever (loaders).
- `flap` / `landing` only matter for Chippy; keep the values above.
- `trail.enabled: true` paints a rainbow line behind it as it travels (same `style` knobs as a ribbon).
- `source.kind` `image` needs `dataUrl` starting `data:image/` (web addresses are removed). Never `video`. `chippy` is the studio mascot (`{ "kind": "chippy" }`).

## Ribbon clip (the rainbow squiggle)

A centreline fanned into colour bands that paints itself in.

```json
{
  "id": "ribbon", "type": "ribbon", "name": "Ribbon", "enabled": true,
  "start": 0, "x": 60, "y": 1000, "scale": 1, "parentId": null, "followRotation": false,
  "points": [ { "x": 0, "y": 0 }, { "x": 240, "y": -160 }, { "x": 480, "y": 40 }, { "x": 720, "y": -140 }, { "x": 960, "y": 20 } ],
  "loop": false,
  "colors": ["#457a9d", "#7a5d86", "#59996a"], "band": 8,
  "duration": 2.4, "ease": { "name": "inOut" },
  "style": { "motion": "paint", "tail": 0.8, "hold": 2, "taper": 0.85, "fade": 0.8, "head": 1, "nib": 0, "core": false, "echo": 0, "glow": 0, "wiggle": 0, "colour": "fixed", "colourSpeed": 1, "accent": ["#c74028", "#e57b30", "#f9c958"] },
  "coat": { "colors": ["#c74028", "#e57b30", "#f9c958"], "every": 0, "duration": 5 }
}
```

- `points`: ≥ 2, relative to `x, y`, drawn as a smooth spline. Closed ring with `loop: true` (8 points around a circle read as round; see `ringPoints`).
- `colors`: one band each, in order across the stripe; `band`: px width of one band (total width = bands × band).
- `duration` / `ease`: how long the paint takes.
- `style.motion`: `paint` (draws in and stays), `comet` (only the last `tail` seconds stay lit), `erase` (paints, holds `hold` s, retracts), `pulse` (paints, then a highlight in `accent` runs along every `hold` s, forever), `pingpong` (lit stretch bounces forever), `dash` (marching dashes forever), `unfold` (grows from the middle).
- Other style knobs: `taper` 0..1 thins the trailing end, `fade` 0..1 fades it, `head` <1 pinches the head, `nib` thick-and-thin, `core` bright centre line, `echo` 0..3 trailing copies, `glow` 0..1, `wiggle` px braiding, `colour` (`fixed`, `along` blends into `accent`, `cycle` hue drifts, `chase` bands slide forever) at `colourSpeed`.
- `coat`: after painting in, a `paint` ribbon can sweep to `coat.colors` every `every` seconds (0 = never), each sweep taking `duration`. Adds `2 × every + duration` to its length.
- Forever motions (`pulse`, `pingpong`, `dash`, `colour: chase/cycle`, `loop: true`) make the composition loop; the length then covers one cycle.

## Logo, Lottie, rig

- `logo`: the A-Team logo rings build; brand-specific, avoid unless asked. Copy fields from `makeLogo()` in `presets.ts`.
- `lottie`: carries a whole Lottie JSON in `data`; only when the user supplies one. Fields: `label`, `data`, `width`, `speed`, `loop`.
- `rig`: a Mid-century Ink character: `rig` (the whole `.mci.json` asset), `animationId` (a clip id or `null`), `pose` (still pose deltas by bone id). Build these with `scripts/rig.mjs`; see `rigs.md`.

## Palettes used by the templates

Atomic Age (`templates.ts`): paper `#f7f5ee`, card `#faf7f4`, cream `#f6efe3`,
night `#16283a`, ink `#2a241d`, ink muted `#645e56`, ink on night `#cbbda6`,
teal `#186a63`, red `#c33a26`, gold `#d69a2c`. Warm ribbon bands: teal, gold, red.

Rainbow (`engine/rainbow.ts`): red `#c74028`, orange `#e57b30`, yellow `#f9c958`,
green `#59996a`, blue `#457a9d`, purple `#7a5d86`. Presets: cool (blue, green,
purple), warm (red, orange, yellow), full (all six in that order).


## Explicit timeline tail (illustrated-scene pipeline)

A composition may include `"timeline": { "tailSeconds": 0 }`. `tailSeconds` is a finite number from 0 through 60. Absent timeline metadata preserves the legacy one-second hold. Duration remains latest enabled clip end plus this tail; it does not crop a longer animation. For an exact 8-second loop, use an 8-second animation with `loop: true` and a zero tail. Verify both rendered continuity and spacing/velocity around the seam. Import, share, save and reopen must retain the field. Older applications may omit it and add the old hold; deliver the JSON and identify the required app revision.
