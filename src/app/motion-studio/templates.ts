import { DOC_VERSION, type RibbonClip, type SpriteClip, type StudioDoc, type TextClip } from "@/app/components/motion-studio/types";
import { DEFAULT_LINE_STYLE } from "@/app/components/motion-studio/engine/line";
import { arrivalTime } from "@/app/components/motion-studio/engine/ribbon";
import { makeShape } from "./lib/shapes";
import { PLAIN_TEXT_DEFAULTS } from "./lib/migrate";
import { BUILT_IN_PRESETS, FRAME_SIZES, makeRibbon, makeSvgSprite, makeText, ringPoints } from "./presets";

/** A ready-made composition in the gallery. */
export interface Template {
  label: string;
  /** One line under the thumbnail: what happens on screen. */
  blurb: string;
  make: () => StudioDoc;
}

// The Atomic Age palette as literal colours: a document has to stand on its
// own outside the app (JSON, share links, React handoff).
const PAPER = "#f7f5ee";
const CREAM = "#f6efe3";
const NIGHT = "#16283a";
const INK = "#2a241d";
const INK_MUTED = "#645e56";
const INK_ON_NIGHT = "#cbbda6";
const TEAL = "#186a63";
const RED = "#c33a26";
const GOLD = "#d69a2c";
const WARM_BANDS = [TEAL, GOLD, RED];

const [VIDEO, SQUARE, STORY, HERO] = FRAME_SIZES;

type Frame = { width: number; height: number };

function stage(frame: Frame, background = PAPER): StudioDoc["stage"] {
  return { width: frame.width, height: frame.height, background, transparent: false };
}

/** Plain text with the brand bits of `makeText` switched off. */
function words(over: Partial<TextClip>): TextClip {
  return makeText({ accentSuffix: "", rule: false, color: INK, ...over });
}

/** Text in a pill with no pointer: a button, a tag, a handle. */
function pill(fill: string, color: string, over: Partial<TextClip>): TextClip {
  return words({
    font: "sans",
    color,
    container: { shape: "soft", fill, stroke: fill, padding: { x: 32, y: 14 }, radius: 999 },
    tail: { ...PLAIN_TEXT_DEFAULTS.tail, mode: "none" },
    reveal: "pop",
    revealDuration: 0.5,
    overshoot: 1.4,
    ...over,
  });
}

/** A filled bar (a lower-third plate, a stripe): one rounded rect, sized by width and aspect. */
function bar(width: number, height: number, fill: string, over: Partial<SpriteClip>): SpriteClip {
  const aspect = height / width;
  const h = (100 * aspect).toFixed(2);
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${h}" width="100" height="${h}"><rect x="0" y="0" width="100" height="${h}" rx="1.2" fill="${fill}"/></svg>`;
  return makeSvgSprite(markup, "Bar", aspect, [], {
    name: "Bar",
    width,
    start: 0,
    duration: 0.7,
    ease: { name: "smoothOut" },
    scaleFrom: 1,
    fadeIn: 0,
    bank: 0,
    ...over,
  });
}

/** A comet chasing itself around a ring, to keep a corner alive. */
function cometLoop(over: Partial<RibbonClip>): RibbonClip {
  return makeRibbon({
    name: "Comet loop",
    points: ringPoints(90),
    loop: true,
    style: { ...DEFAULT_LINE_STYLE, motion: "comet", tail: 0.9 },
    duration: 2.4,
    ease: { name: "linear" },
    colors: WARM_BANDS.slice(),
    band: 6,
    ...over,
  });
}

/** A name and a role on a plate that slides in from the left, the way a broadcast caption does. */
export function lowerThirdTemplate(): StudioDoc {
  const plate = bar(620, 110, TEAL, { id: "third-plate", name: "Plate", x: 470, y: 880, path: [{ x: -760, y: 0 }, { x: 0, y: 0 }] });
  const stripe = bar(14, 110, RED, {
    id: "third-stripe",
    name: "Stripe",
    x: 146,
    y: 880,
    start: 0.25,
    duration: 0.5,
    path: [{ x: 0, y: -140 }, { x: 0, y: 0 }],
    ease: { name: "backOut" },
    fadeIn: 0.1,
  });
  const name = words({ id: "third-name", name: "Name", x: 470, y: 836, start: 0.45, text: "Your name", font: "serif", fontSize: 40, color: CREAM, direction: "left", letterStagger: 0.04, letterDuration: 0.4 });
  const role = words({ id: "third-role", name: "Role", x: 470, y: 892, start: 0.95, text: "What you do", font: "sans", fontSize: 22, color: CREAM, reveal: "fade", revealDuration: 0.5 });
  return { version: DOC_VERSION, name: "Lower third", stage: stage(VIDEO), clips: [plate, stripe, name, role] };
}

/** A big title pops in, a ribbon underlines it, a subtitle fades in below. */
export function titleCardTemplate(): StudioDoc {
  const title = words({ id: "title-main", name: "Title", x: 960, y: 380, start: 0.2, text: "Your title here", font: "serif", fontSize: 120, reveal: "pop", revealDuration: 0.7, overshoot: 1.3 });
  const underline = makeRibbon({
    id: "title-underline",
    name: "Underline",
    x: 560,
    y: 580,
    start: 0.7,
    points: [
      { x: 0, y: 0 },
      { x: 200, y: -14 },
      { x: 400, y: 8 },
      { x: 600, y: -10 },
      { x: 800, y: 0 },
    ],
    duration: 1.1,
    band: 8,
    colors: WARM_BANDS.slice(),
  });
  const subtitle = words({ id: "title-sub", name: "Subtitle", x: 960, y: 640, start: Number(arrivalTime(underline, 1).toFixed(2)), text: "A short line about it", font: "sans", fontSize: 32, color: INK_MUTED, reveal: "fade", revealDuration: 0.6 });
  return { version: DOC_VERSION, name: "Title card", stage: stage(VIDEO), clips: [title, underline, subtitle] };
}

/** A picture placeholder rises into a sun, a "New" tag pops, the name and a button follow. */
export function productRevealTemplate(): StudioDoc {
  const sun = makeShape("circle", GOLD, VIDEO, { id: "product-sun", name: "Sun", x: 640, y: 540, width: 560, duration: 0.9, scaleFrom: 0.2, fadeIn: 0 });
  const picture = makeShape("rounded", "#faf7f4", VIDEO, {
    id: "product-picture",
    name: "Picture",
    x: 640,
    y: 540,
    width: 340,
    start: 0.3,
    duration: 0.8,
    path: [{ x: 0, y: 90 }, { x: 0, y: 0 }],
    scaleFrom: 0.7,
  });
  const hint = words({ id: "product-hint", name: "Hint", parentId: picture.id, x: 0, y: -14, start: 0.7, text: "Drop a picture here", font: "sans", fontSize: 22, color: INK_MUTED, reveal: "fade", revealDuration: 0.5 });
  const tag = pill(RED, CREAM, { id: "product-tag", name: "Tag", x: 900, y: 290, start: 0.9, text: "New", fontSize: 24 });
  const name = words({ id: "product-name", name: "Name", x: 1380, y: 400, start: 1.0, text: "Product name", font: "serif", fontSize: 72, direction: "left", letterStagger: 0.04, letterDuration: 0.4 });
  const price = words({ id: "product-price", name: "Price", x: 1380, y: 510, start: 1.6, text: "From $19", font: "sans", fontSize: 32, color: TEAL, reveal: "fade", revealDuration: 0.5 });
  const button = pill(TEAL, CREAM, { id: "product-button", name: "Button", x: 1380, y: 600, start: 2.0, text: "Learn more", fontSize: 24 });
  return { version: DOC_VERSION, name: "Product reveal", stage: stage(VIDEO), clips: [sun, picture, hint, tag, name, price, button] };
}

/** Three points land one after another, each with a dot that slides in ahead of it. */
export function bulletBuildTemplate(): StudioDoc {
  const title = words({ id: "bullets-title", name: "Title", x: 960, y: 150, start: 0, text: "Three things to know", font: "serif", fontSize: 72, letterStagger: 0.03, letterDuration: 0.4 });
  // Text is anchored at its centre, so lines of a similar length keep their left edges in step.
  const lines = ["First, the big idea", "Then, why it matters", "Finally, what to do"];
  const rows = lines.flatMap((text, i) => {
    const y = 420 + i * 150;
    const start = 0.9 + i * 0.7;
    const dot = makeShape("circle", TEAL, VIDEO, {
      id: `bullets-dot-${i + 1}`,
      name: `Dot ${i + 1}`,
      x: 700,
      y,
      width: 30,
      start,
      duration: 0.5,
      path: [{ x: -80, y: 0 }, { x: 0, y: 0 }],
      ease: { name: "smoothOut" },
      scaleFrom: 1,
      fadeIn: 0.2,
    });
    const line = words({ id: `bullets-line-${i + 1}`, name: `Point ${i + 1}`, x: 1000, y: y - 26, start: start + 0.15, text, font: "sans", fontSize: 40, direction: "left", letterStagger: 0.025, letterDuration: 0.35 });
    return [dot, line];
  });
  return { version: DOC_VERSION, name: "Bullet build", stage: stage(VIDEO), clips: [title, ...rows] };
}

/** A warm sign-off: the thanks pop in, a line fades under them, a handle appears, two comets keep turning. */
export function thankYouTemplate(): StudioDoc {
  const thanks = words({ id: "thanks-title", name: "Thank you", x: 960, y: 320, start: 0.2, text: "Thank you", font: "serif", fontSize: 140, reveal: "pop", revealDuration: 0.7, overshoot: 1.3 });
  const line = words({ id: "thanks-line", name: "Line", x: 960, y: 540, start: 1.0, text: "See you next time", font: "sans", fontSize: 36, color: INK_MUTED, reveal: "fade", revealDuration: 0.6, rule: true, ruleDelay: 0.3, ruleDuration: 0.6, ruleWidth: 120 });
  const handle = pill(TEAL, CREAM, { id: "thanks-handle", name: "Handle", x: 960, y: 680, start: 1.7, text: "@yourname", fontSize: 28 });
  const loopA = cometLoop({ id: "thanks-loop-a", x: 1640, y: 230, start: 0.4 });
  const loopB = cometLoop({ id: "thanks-loop-b", x: 280, y: 860, start: 0.9, points: ringPoints(70), duration: 2.0 });
  return { version: DOC_VERSION, name: "Thank you", stage: stage(VIDEO), clips: [thanks, line, handle, loopA, loopB] };
}

/** A quotation on a night sky: the mark pops, two lines type out, the author fades in. */
export function quoteCardTemplate(): StudioDoc {
  const mark = words({ id: "quote-mark", name: "Quote mark", x: 540, y: 90, start: 0, text: "“", font: "serif", fontSize: 260, color: GOLD, reveal: "pop", revealDuration: 0.6, overshoot: 1.5 });
  const line1 = words({ id: "quote-line-1", name: "Line 1", x: 540, y: 400, start: 0.4, text: "Make something people", font: "serif", fontSize: 56, color: CREAM, direction: "left", letterStagger: 0.035, letterDuration: 0.4 });
  const line2 = words({ id: "quote-line-2", name: "Line 2", x: 540, y: 480, start: 1.0, text: "actually want to watch.", font: "serif", fontSize: 56, color: CREAM, direction: "left", letterStagger: 0.035, letterDuration: 0.4 });
  const author = words({ id: "quote-author", name: "Author", x: 540, y: 660, start: 2.0, text: "Your name", font: "sans", fontSize: 28, color: INK_ON_NIGHT, reveal: "fade", revealDuration: 0.6, rule: true, ruleDelay: 0.2, ruleDuration: 0.6, ruleWidth: 80 });
  return { version: DOC_VERSION, name: "Quote card", stage: stage(SQUARE, NIGHT), clips: [mark, line1, line2, author] };
}

/** A star spins in, the offer pops on top of it, the small print follows. */
export function saleBadgeTemplate(): StudioDoc {
  const star = makeShape("star", RED, SQUARE, {
    id: "sale-star",
    name: "Star",
    x: 540,
    y: 540,
    width: 900,
    duration: 0.9,
    path: [{ x: 0, y: -40, rotate: -90 }, { x: 0, y: 0 }],
    scaleFrom: 0.2,
    fadeIn: 0.1,
  });
  const offer = words({ id: "sale-offer", name: "Offer", x: 540, y: 410, start: 0.5, text: "50% off", font: "serif", fontSize: 110, color: CREAM, reveal: "pop", revealDuration: 0.6, overshoot: 1.5 });
  const when = pill(NIGHT, CREAM, { id: "sale-when", name: "When", x: 540, y: 575, start: 1.0, text: "This weekend only", fontSize: 26 });
  return { version: DOC_VERSION, name: "Sale badge", stage: stage(SQUARE), clips: [star, offer, when] };
}

/** Three dots bob in turn, forever: a loading screen. */
export function loaderDotsTemplate(): StudioDoc {
  const colors = [TEAL, GOLD, RED];
  const dots = colors.map((fill, i) =>
    makeShape("circle", fill, SQUARE, {
      id: `dots-${i + 1}`,
      name: `Dot ${i + 1}`,
      x: 360 + i * 180,
      y: 500,
      width: 110,
      start: i * 0.2,
      loop: true,
      duration: 1.2,
      ease: { name: "linear" },
      path: [
        { x: 0, y: -50, scale: 1.1 },
        { x: 22, y: 0 },
        { x: 0, y: 50, scale: 0.9 },
        { x: -22, y: 0 },
      ],
      scaleFrom: 1,
      fadeIn: 0,
    }),
  );
  const label = words({ id: "dots-label", name: "Label", x: 540, y: 660, start: 0.3, text: "Loading…", font: "sans", fontSize: 32, color: INK_MUTED, reveal: "fade", revealDuration: 0.5 });
  return { version: DOC_VERSION, name: "Loader dots", stage: stage(SQUARE), clips: [...dots, label] };
}

/** A story frame: a ribbon flourish, a headline, a sub-line, and a "swipe up" pill with an arrow. */
export function storyCaptionTemplate(): StudioDoc {
  const flourish = makeRibbon({
    id: "story-flourish",
    name: "Flourish",
    x: 120,
    y: 520,
    points: [
      { x: 0, y: 0 },
      { x: 220, y: -140 },
      { x: 440, y: 40 },
      { x: 660, y: -120 },
      { x: 840, y: 20 },
    ],
    duration: 1.6,
    band: 10,
    colors: WARM_BANDS.slice(),
  });
  const headline = words({ id: "story-headline", name: "Headline", x: 540, y: 640, start: 0.3, text: "Big news", font: "serif", fontSize: 120, letterStagger: 0.06, letterDuration: 0.5 });
  const sub = words({ id: "story-sub", name: "Sub-line", x: 540, y: 810, start: 1.2, text: "Tap to see what changed", font: "sans", fontSize: 40, color: INK_MUTED, reveal: "fade", revealDuration: 0.6 });
  const swipe = pill(TEAL, CREAM, { id: "story-swipe", name: "Swipe up", x: 540, y: 1560, start: 1.8, text: "Swipe up", fontSize: 36 });
  const arrow = makeShape("arrow", TEAL, STORY, {
    id: "story-arrow",
    name: "Arrow",
    x: 540,
    y: 1470,
    width: 70,
    rotation: -90,
    start: 2.0,
    duration: 0.6,
    path: [{ x: 0, y: 50 }, { x: 0, y: 0 }],
    scaleFrom: 0.6,
  });
  return { version: DOC_VERSION, name: "Story caption", stage: stage(STORY), clips: [flourish, headline, sub, swipe, arrow] };
}

/** A reel opener on a night sky: the hook pops, three shapes drop in, the tease fades in. */
export function reelHookTemplate(): StudioDoc {
  const hook = words({ id: "reel-hook", name: "Hook", x: 540, y: 700, start: 0.2, text: "Wait for it…", font: "serif", fontSize: 110, color: CREAM, reveal: "pop", revealDuration: 0.6, overshoot: 1.6 });
  const drops: [string, string, number, number][] = [
    ["star", GOLD, 300, 1150],
    ["circle", RED, 540, 1250],
    ["heart", CREAM, 780, 1150],
  ];
  const shapes = drops.map(([kind, fill, x, y], i) =>
    makeShape(kind as "star" | "circle" | "heart", fill, STORY, {
      id: `reel-shape-${i + 1}`,
      name: `Shape ${i + 1}`,
      x,
      y,
      width: 160,
      start: 0.9 + i * 0.2,
      duration: 0.8,
      path: [{ x: 0, y: -1000 }, { x: 0, y: 0 }],
      ease: { name: "backOut" },
      scaleFrom: 1,
      fadeIn: 0.15,
    }),
  );
  const tease = words({ id: "reel-tease", name: "Tease", x: 540, y: 1440, start: 2.0, text: "and then…", font: "sans", fontSize: 44, color: INK_ON_NIGHT, reveal: "fade", revealDuration: 0.6 });
  return { version: DOC_VERSION, name: "Reel hook", stage: stage(STORY, NIGHT), clips: [hook, ...shapes, tease] };
}

/** A site hero: a ribbon sweeps behind, the headline types out, a sub-line and a button follow. */
export function heroBandTemplate(): StudioDoc {
  const ribbon = makeRibbon({
    id: "hero-ribbon",
    name: "Ribbon",
    x: -120,
    y: 720,
    points: [
      { x: 0, y: 40 },
      { x: 320, y: -120 },
      { x: 640, y: 80 },
      { x: 960, y: -100 },
      { x: 1280, y: 60 },
      { x: 1700, y: -80 },
    ],
    duration: 2.2,
    band: 12,
    colors: WARM_BANDS.slice(),
  });
  const headline = words({ id: "hero-headline", name: "Headline", x: 720, y: 250, start: 0.3, text: "Make it move", font: "serif", fontSize: 104, letterStagger: 0.05, letterDuration: 0.5 });
  const sub = words({ id: "hero-sub", name: "Sub-line", x: 720, y: 395, start: 1.2, text: "Short animations for your site, made in the browser.", font: "sans", fontSize: 28, color: INK_MUTED, reveal: "fade", revealDuration: 0.6 });
  const button = pill(TEAL, CREAM, { id: "hero-button", name: "Button", x: 720, y: 480, start: 1.8, text: "Get started", fontSize: 24 });
  return { version: DOC_VERSION, name: "Hero band", stage: stage(HERO), clips: [ribbon, headline, sub, button] };
}

/** The starter templates, after the four originals: grouped by frame, video first. */
export const STARTER_TEMPLATES: Template[] = [
  { label: "Lower third", blurb: "A plate slides in with a name and a role.", make: lowerThirdTemplate },
  { label: "Title card", blurb: "A title pops in, a ribbon underlines it.", make: titleCardTemplate },
  { label: "Product reveal", blurb: "A picture rises into a sun; name, price and a button follow.", make: productRevealTemplate },
  { label: "Bullet build", blurb: "Three points land one after another.", make: bulletBuildTemplate },
  { label: "Thank you", blurb: "A sign-off with a handle and two comets.", make: thankYouTemplate },
  { label: "Quote card", blurb: "A quotation types out on a night sky.", make: quoteCardTemplate },
  { label: "Sale badge", blurb: "A star spins in with the offer on top.", make: saleBadgeTemplate },
  { label: "Loader dots", blurb: "Three dots bob in turn, forever.", make: loaderDotsTemplate },
  { label: "Story caption", blurb: "A flourish, a headline and a swipe-up pill.", make: storyCaptionTemplate },
  { label: "Reel hook", blurb: "A hook pops, three shapes drop in.", make: reelHookTemplate },
  { label: "Hero band", blurb: "A ribbon sweeps behind a headline and a button.", make: heroBandTemplate },
];

/** Everything the gallery offers: the originals, then the starters. */
export const TEMPLATES: Template[] = [...BUILT_IN_PRESETS, ...STARTER_TEMPLATES];

/** "1920 × 1080": the frame a document is set in, as the gallery's size chips name it. */
export function frameLabel(doc: Pick<StudioDoc, "stage">): string {
  return `${doc.stage.width} × ${doc.stage.height}`;
}
