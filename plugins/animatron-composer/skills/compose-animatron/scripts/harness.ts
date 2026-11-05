/**
 * Runs inside an Animatron checkout (launched by validate.mjs / refresh.mjs
 * with `tsx --tsconfig <repo>/tsconfig.json`), so every import below is the
 * studio's own code at whatever commit the checkout is on. Nothing here
 * writes into the repo.
 *
 *   harness.ts check <studioUrl> <file.json>...   validate compositions
 *   harness.ts export <outDir>                    write worked examples from the repo's templates
 *   harness.ts constants                          print schema constants as JSON
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { DOC_VERSION, type Clip, type StudioDoc } from "@/app/components/motion-studio/types";
import { EASE_LABELS } from "@/app/components/motion-studio/engine/easing";
import { docDuration, loopsForever } from "@/app/components/motion-studio/engine/timing";
import { docFromJson } from "@/app/motion-studio/lib/importDoc";
import { docFromHash, shareUrl, SHARE_LIMIT, SHARE_PARAM } from "@/app/motion-studio/lib/share";
import { FRAME_SIZES } from "@/app/motion-studio/presets";
import { RIG_LIMITS, validateRig } from "@/app/components/motion-studio/engine/rig";
import { parseRigSvg } from "@/app/components/motion-studio/engine/rigSvg";
import { createRequire } from "node:module";

// The studio parses rig SVG with the browser's DOMParser; jsdom (the studio's
// own test environment) supplies it in Node.
{
  const { JSDOM } = createRequire(join(process.cwd(), "package.json"))("jsdom");
  (globalThis as { DOMParser?: unknown }).DOMParser = new JSDOM("").window.DOMParser;
}
import { STARTER_TEMPLATES, lowerThirdTemplate, titleCardTemplate, reelHookTemplate } from "@/app/motion-studio/templates";

// Enumerations the repair step does not police (an unknown value is kept and
// silently rendered as a fallback). Mirrors types.ts at the locked commit;
// a change to types.ts trips the drift check, which is the cue to update these.
const ENUMS = {
  ease: Object.keys(EASE_LABELS),
  reveal: ["letters", "typewriter", "blur", "mask", "pop", "fade"],
  direction: ["center", "left", "right"],
  font: ["sans", "serif"],
  containerShape: ["none", "speech", "soft", "minimal", "thought"],
  tailMode: ["auto", "manual", "none"],
  tailSide: ["top", "bottom", "left", "right"],
  lineMotion: ["paint", "comet", "erase", "pulse", "pingpong", "dash", "unfold"],
  lineColour: ["fixed", "along", "cycle", "chase"],
  clipType: ["logo", "sprite", "text", "lottie", "ribbon", "rig"],
  spriteSource: ["chippy", "image", "svg", "video"],
};

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** JSON as the file would hold it, with object keys sorted: key order and `undefined` never count as a change. */
function canon(v: unknown): Json {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .sort()
        .filter((k) => o[k] !== undefined)
        .map((k) => [k, canon(o[k])]),
    );
  }
  return v as Json;
}

/** Paths where `a` (what was written) and `b` (what the studio made of it) differ. */
function diff(a: Json, b: Json, path = "$", out: string[] = []): string[] {
  if (out.length >= 12) return out;
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  const isObj = (x: Json) => x !== null && typeof x === "object" && !Array.isArray(x);
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push(`${path}: ${a.length} items written, ${b.length} after repair`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${path}[${i}]`, out);
    return out;
  }
  if (isObj(a) && isObj(b)) {
    const ao = a as Record<string, Json>;
    const bo = b as Record<string, Json>;
    for (const k of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
      if (!(k in bo)) out.push(`${path}.${k}: removed by repair`);
      else if (!(k in ao)) out.push(`${path}.${k}: missing; repair filled in ${JSON.stringify(bo[k]).slice(0, 80)}`);
      else diff(ao[k], bo[k], `${path}.${k}`, out);
    }
    return out;
  }
  out.push(`${path}: wrote ${JSON.stringify(a)?.slice(0, 60)}, repair made it ${JSON.stringify(b)?.slice(0, 60)}`);
  return out;
}

function lint(doc: StudioDoc): { errors: string[]; notes: string[] } {
  const errors: string[] = [];
  const notes: string[] = [];
  const oneOf = (where: string, value: unknown, list: readonly string[]) => {
    if (!list.includes(value as string)) errors.push(`${where}: "${String(value)}" is not one of ${list.join(", ")}`);
  };
  const walkNumbers = (v: unknown, path: string) => {
    if (typeof v === "number" && !Number.isFinite(v)) errors.push(`${path}: not a finite number`);
    else if (Array.isArray(v)) v.forEach((x, i) => walkNumbers(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walkNumbers(x, `${path}.${k}`);
  };
  walkNumbers(doc, "$");

  if (doc.version !== DOC_VERSION) errors.push(`version: write ${DOC_VERSION} (the current document version), not ${doc.version}`);
  if (!doc.name || !doc.name.trim()) errors.push("name: give the composition a name");
  const s = doc.stage;
  if (!s || !Number.isInteger(s.width) || !Number.isInteger(s.height) || s.width <= 0 || s.height <= 0) errors.push("stage: width and height must be positive whole pixels");
  if (s && typeof s.background !== "string") errors.push("stage.background: a CSS colour string");
  if (s && typeof s.transparent !== "boolean") errors.push("stage.transparent: true or false");
  if (doc.audio) errors.push("audio: v1 compositions carry no sound (sound lives in the browser's media store and can't travel in JSON or links)");

  const ids = new Map<string, Clip>();
  for (const [i, c] of (Array.isArray(doc.clips) ? doc.clips : []).entries()) {
    const at = `clips[${i}] "${c.name ?? c.id}"`;
    if (!c.id) errors.push(`${at}: missing id`);
    else if (ids.has(c.id)) errors.push(`${at}: duplicate id "${c.id}"`);
    else ids.set(c.id, c);
    oneOf(`${at}.type`, c.type, ENUMS.clipType);
    if (typeof c.name !== "string" || !c.name) errors.push(`${at}: give every layer a name`);
    if (typeof c.enabled !== "boolean") errors.push(`${at}.enabled: true or false`);
    if (c.start < 0) errors.push(`${at}.start: can't be negative`);
    if (typeof c.scale !== "number") errors.push(`${at}.scale: required number (1 = natural size)`);
    for (const [prop, keys] of Object.entries(c.keys ?? {})) {
      for (const [k, key] of (keys ?? []).entries()) if (key.ease) oneOf(`${at}.keys.${prop}[${k}].ease.name`, key.ease.name, ENUMS.ease);
    }
    if (c.type === "rig") {
      // Import of a whole document only checks the rig's structure; the SVG
      // subset is checked where the layer is drawn. Check both here.
      const structure = validateRig(c.rig);
      if (!structure.ok) errors.push(`${at}.rig: ${structure.errors.join(" ")}`);
      else {
        const svg = parseRigSvg(c.rig);
        if (!svg.ok) errors.push(`${at}.rig.svg: ${svg.error}`);
      }
      if (c.animationId !== null && !c.rig?.animations?.some((x) => x.id === c.animationId)) errors.push(`${at}.animationId: "${c.animationId}" is not one of the rig's clips`);
      if (Buffer.byteLength(JSON.stringify(c.rig)) > RIG_LIMITS.jsonBytes) errors.push(`${at}.rig: over the studio's 4 MB rig limit`);
    }
    if (c.type === "text") {
      oneOf(`${at}.reveal`, c.reveal, ENUMS.reveal);
      oneOf(`${at}.direction`, c.direction, ENUMS.direction);
      oneOf(`${at}.font`, c.font, ENUMS.font);
      oneOf(`${at}.container.shape`, c.container?.shape, ENUMS.containerShape);
      oneOf(`${at}.tail.mode`, c.tail?.mode, ENUMS.tailMode);
      oneOf(`${at}.tail.side`, c.tail?.side, ENUMS.tailSide);
      if (typeof c.text !== "string") errors.push(`${at}.text: required string`);
      else if (c.text.includes("\n")) errors.push(`${at}.text: one line per text layer; stack separate layers for more lines`);
      if (c.accentSuffix && typeof c.text === "string" && !c.text.endsWith(c.accentSuffix)) notes.push(`${at}: accentSuffix "${c.accentSuffix}" isn't the end of the text, so nothing is accented`);
    }
    if (c.type === "sprite") {
      oneOf(`${at}.ease.name`, c.ease?.name, ENUMS.ease);
      oneOf(`${at}.source.kind`, c.source?.kind, ENUMS.spriteSource);
      oneOf(`${at}.trail.style.motion`, c.trail?.style?.motion, ENUMS.lineMotion);
      oneOf(`${at}.trail.style.colour`, c.trail?.style?.colour, ENUMS.lineColour);
      if (!Array.isArray(c.path) || c.path.length < 2) errors.push(`${at}.path: at least two waypoints (a still picture uses two at {0,0})`);
      if (c.source?.kind === "video") errors.push(`${at}: video lives in the browser's media store and can't travel in JSON or links`);
      if (c.source?.kind === "svg") {
        const m = String(c.source.markup ?? "");
        if (!/^<svg[\s>]/.test(m) || !m.includes('xmlns="http://www.w3.org/2000/svg"')) errors.push(`${at}.source.markup: a standalone <svg xmlns="http://www.w3.org/2000/svg" ...> element`);
        if (/<script|\son[a-z]+=|href="(?!#)|<foreignObject/i.test(m)) errors.push(`${at}.source.markup: no scripts, event handlers, external links or foreignObject`);
      }
    }
    if (c.type === "ribbon") {
      oneOf(`${at}.ease.name`, c.ease?.name, ENUMS.ease);
      oneOf(`${at}.style.motion`, c.style?.motion, ENUMS.lineMotion);
      oneOf(`${at}.style.colour`, c.style?.colour, ENUMS.lineColour);
      if (!Array.isArray(c.points) || c.points.length < 2) errors.push(`${at}.points: at least two points`);
      if (!Array.isArray(c.colors) || !c.colors.length) errors.push(`${at}.colors: at least one band colour`);
    }
  }
  for (const c of doc.clips) {
    if (c.along != null && (!c.parentId || ids.get(c.parentId)?.type !== "ribbon")) notes.push(`"${c.name}": along only works when the parent is a ribbon; it is ignored here`);
    if (c.type === "text" && c.flow && c.along == null) notes.push(`"${c.name}": flow needs a seat on a ribbon (along); it is ignored here`);
  }
  return { errors, notes };
}

function check(studioUrl: string, files: string[]): number {
  const url = new URL(studioUrl);
  let failed = 0;
  for (const file of files) {
    // A link from an older successful run must not survive a failed recheck
    // or an edit that now exceeds the link budget.
    const linkFile = file.replace(/\.json$/i, "") + ".share-link.txt";
    rmSync(linkFile, { force: true });
    const problems: string[] = [];
    const notes: string[] = [];
    let text = "";
    let link: string | null = null;
    let length: string | null = null;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      problems.push("can't read the file");
    }
    let written: unknown = null;
    if (!problems.length) {
      try {
        written = JSON.parse(text);
      } catch (e) {
        problems.push(`not valid JSON: ${(e as Error).message}`);
      }
    }
    const asDoc = written as Partial<StudioDoc> | null;
    if (written && !(typeof asDoc?.version === "number" && Array.isArray(asDoc.clips) && asDoc.stage)) {
      problems.push("not a composition: expected { version, name, stage, clips }");
    }
    if (!problems.length) {
      // 1. The Import JSON path, exactly as the gallery runs it.
      const imported = docFromJson(text, basename(file));
      if (!imported.ok) problems.push(`studio import refused it: ${imported.message}`);
      else {
        for (const w of imported.warnings) problems.push(`studio repair warned: ${w}`);
        for (const d of diff(canon(written), canon(imported.doc))) problems.push(`studio repair changed it: ${d}`);
        const l = lint(written as StudioDoc);
        problems.push(...l.errors);
        notes.push(...l.notes);
        // 2. The #share= link path: encode as the Share button does, open as a visitor's studio does.
        const share = shareUrl(imported.doc, { origin: url.origin, pathname: url.pathname });
        if (!share.ok) notes.push(`too large for a #share= link (over ${SHARE_LIMIT} characters); hand over the JSON file only`);
        else {
          const reopened = docFromHash(share.url.slice(share.url.indexOf("#")));
          if (!reopened) problems.push("the #share= link would not open");
          else {
            for (const d of diff(canon(written), canon(reopened))) problems.push(`opening the #share= link changed it: ${d}`);
            link = share.url;
          }
        }
        const seconds = docDuration(imported.doc);
        const forever = imported.doc.clips.some((c) => c.enabled && loopsForever(c));
        const timeline = (imported.doc as StudioDoc & { timeline?: { tailSeconds: number } }).timeline;
        const tail = timeline?.tailSeconds ?? 1;
        length = `${seconds.toFixed(2)} s (latest enabled layer ends at ${(seconds - tail).toFixed(2)} s, timeline tail ${tail.toFixed(2)} s)${forever ? "; some layers loop forever; an endpoint image match alone does not prove smooth motion" : ""}`;
      }
    }
    const pass = problems.length === 0;
    if (!pass) failed++;
    console.log(`${pass ? "PASS" : "FAIL"}  ${file}`);
    if (length) console.log(`  length: ${length}`);
    for (const p of problems) console.log(`  x ${p}`);
    for (const n of notes) console.log(`  ! ${n}`);
    if (pass && link) {
      const out = linkFile;
      writeFileSync(out, link + "\n");
      console.log(`  link: ${link.length} chars, saved to ${out}`);
    }
  }
  return failed;
}

function exportExamples(outDir: string) {
  mkdirSync(outDir, { recursive: true });
  const picks: [string, () => StudioDoc][] = [
    ["lower-third.json", lowerThirdTemplate],
    ["title-card.json", titleCardTemplate],
    ["reel-hook.json", reelHookTemplate],
  ];
  for (const [file, make] of picks) {
    writeFileSync(join(outDir, file), JSON.stringify(make(), null, 2) + "\n");
    console.log(`wrote ${join(outDir, file)}`);
  }
}

function constants() {
  console.log(
    JSON.stringify(
      {
        docVersion: DOC_VERSION,
        shareParam: SHARE_PARAM,
        shareLimit: SHARE_LIMIT,
        frameSizes: FRAME_SIZES.map(({ name, width, height }) => ({ name, width, height })),
        templates: STARTER_TEMPLATES.map((t) => t.label),
        enums: ENUMS,
      },
      null,
      2,
    ),
  );
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "check") process.exitCode = check(rest[0], rest.slice(1)) ? 1 : 0;
else if (cmd === "export") exportExamples(rest[0]);
else if (cmd === "constants") constants();
else {
  console.error("usage: harness.ts check <studioUrl> <file>... | export <dir> | constants");
  process.exit(2);
}
