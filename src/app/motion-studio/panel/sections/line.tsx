"use client";

import { DEFAULT_LINE_STYLE } from "@/app/components/motion-studio/engine/line";
import type { Clip, LineColour, LineMotion, LineStyle, RibbonClip, SpriteClip } from "@/app/components/motion-studio/types";
import { Button } from "@/app/components/shared-components";
import { MoreFields, NumField, SelectField, ToggleField } from "../fields";
import { PaletteField } from "./palette";
import type { PanelSection } from "../PanelGroup";

/**
 * Ready-made combinations of the line knobs. Picking one sets every listed
 * field at once; the rest keep their values, so a look can be chosen and then
 * nudged. Order is the menu order; `name` is the look's label key.
 */
export const LINE_LOOKS: { name: string; patch: Partial<LineStyle> }[] = [
  { name: "paint", patch: { motion: "paint", nib: 0, core: false, echo: 0, wiggle: 0, colour: "fixed" } },
  { name: "comet", patch: { motion: "comet", taper: 0.85, fade: 0.8, nib: 0, core: false, echo: 0, wiggle: 0, glow: 0, colour: "fixed" } },
  { name: "neon", patch: { motion: "comet", taper: 1, fade: 1, core: true, glow: 0.8, nib: 0, echo: 0, wiggle: 0, colour: "fixed" } },
  { name: "eraser", patch: { motion: "erase", taper: 0.6, fade: 0.5, nib: 0, echo: 0, wiggle: 0 } },
  { name: "pulse", patch: { motion: "pulse", tail: 0.18, hold: 3, taper: 0.7, fade: 0.9, nib: 0, echo: 0, wiggle: 0 } },
  { name: "pingpong", patch: { motion: "pingpong", tail: 0.25, taper: 0.8, fade: 0.8, nib: 0, echo: 0, wiggle: 0 } },
  { name: "dash", patch: { motion: "dash", tail: 0.06, taper: 0.5, fade: 0.6, nib: 0, echo: 0, wiggle: 0 } },
  { name: "unfold", patch: { motion: "unfold", nib: 0, echo: 0, wiggle: 0 } },
  { name: "chase", patch: { motion: "paint", colour: "chase", colourSpeed: 1, nib: 0, echo: 0, wiggle: 0 } },
  { name: "braid", patch: { motion: "comet", wiggle: 18, taper: 0.6, fade: 0.7, nib: 0, echo: 0, core: false } },
  { name: "calligraphy", patch: { motion: "paint", nib: 0.8, echo: 0, wiggle: 0, core: false } },
  { name: "calligraphyComet", patch: { motion: "comet", nib: 0.8, taper: 0.7, fade: 0.8, echo: 0, wiggle: 0, core: false, glow: 0, colour: "fixed" } },
  { name: "echo", patch: { motion: "comet", echo: 2, taper: 0.8, fade: 0.8, nib: 0, wiggle: 0 } },
];

/** English labels for every knob, keyed the same way as upstream's i18n keys. */
const LABELS: Record<string, string> = {
  title: "Line style",
  look: "Look",
  "looks.paint": "Paint in and stay",
  "looks.comet": "Comet",
  "looks.neon": "Neon comet",
  "looks.eraser": "Draw, hold, erase",
  "looks.pulse": "Pulse along it",
  "looks.pingpong": "Ping-pong",
  "looks.dash": "Dash flow",
  "looks.unfold": "Unfold from the middle",
  "looks.chase": "Colour chase",
  "looks.braid": "Braided comet",
  "looks.calligraphy": "Calligraphy",
  "looks.calligraphyComet": "Calligraphy comet",
  "looks.echo": "Echoing comet",
  "looks.custom": "Custom",
  motion: "Motion",
  "motions.paint": "Paint in and stay",
  "motions.comet": "Comet: only the tail stays lit",
  "motions.erase": "Paint, hold, then erase",
  "motions.pulse": "Paint, then pulses run along it",
  "motions.pingpong": "Ping-pong end to end",
  "motions.dash": "Dashes march along it",
  "motions.unfold": "Unfold from the middle",
  "tail.comet": "Tail length",
  "tail.pulse": "Pulse length",
  "tail.pingpong": "Lit length",
  "tail.dash": "Dash length",
  "hold.erase": "Hold before erasing",
  "hold.pulse": "Time between pulses",
  taper: "Taper the trailing end",
  fade: "Fade the trailing end",
  headSprite: "Width at the picture",
  headRibbon: "Width at the tip",
  nib: "Pen nib (thick and thin)",
  core: "Bright core line",
  glow: "Glow",
  wiggle: "Braid",
  echo: "Echo copies",
  colour: "Colour",
  "colours.fixed": "Own colours",
  "colours.along": "Blend into the second palette",
  "colours.cycle": "Hue drifts over time",
  "colours.chase": "Bands slide along the line",
  colourSpeed: "Colour speed",
  accent: "Second palette",
  "accents.cool": "Cool",
  "accents.warm": "Warm",
  "accents.full": "Full rainbow",
  "accents.custom": "Custom",
  reset: "Back to plain paint",
};
const label = (key: string) => LABELS[key] ?? key;

const MOTIONS: LineMotion[] = ["paint", "comet", "erase", "pulse", "pingpong", "dash", "unfold"];
const COLOURS: LineColour[] = ["fixed", "along", "cycle", "chase"];

/** Which look the style matches (every field of the look's patch equal), or "custom". */
export function lookFor(style: LineStyle): string {
  const match = LINE_LOOKS.find((l) => (Object.keys(l.patch) as (keyof LineStyle)[]).every((k) => l.patch[k] === style[k]));
  return match?.name ?? "custom";
}

/* Motions with a tail / hold knob (its label key is the motion). */
const HAS_TAIL: LineMotion[] = ["comet", "pulse", "pingpong", "dash"];
const HAS_HOLD: LineMotion[] = ["erase", "pulse"];

/** The style and a setter for whichever clip carries the line. */
function lineOf(clip: RibbonClip | SpriteClip, onChange: (c: Clip) => void) {
  if (clip.type === "ribbon") {
    return { style: clip.style, set: (patch: Partial<LineStyle>) => onChange({ ...clip, style: { ...clip.style, ...patch } }) };
  }
  return {
    style: clip.trail.style,
    set: (patch: Partial<LineStyle>) => onChange({ ...clip, trail: { ...clip.trail, style: { ...clip.trail.style, ...patch } } }),
  };
}

/** How the line is lit and shaped: look presets, then every knob. Shared by ribbons and sprite trails. */
export function lineSection(clip: RibbonClip | SpriteClip, onChange: (c: Clip) => void): PanelSection {
  const { style, set } = lineOf(clip, onChange);
  const look = lookFor(style);
  const lookOptions = [...LINE_LOOKS.map((l) => l.name), ...(look === "custom" ? ["custom"] : [])].map((name) => ({
    value: name,
    label: label(`looks.${name}`),
  }));
  const shaped = style.motion !== "paint" && style.motion !== "unfold";
  const tailLabel = HAS_TAIL.includes(style.motion) ? label(`tail.${style.motion}`) : null;
  const holdLabel = HAS_HOLD.includes(style.motion) ? label(`hold.${style.motion}`) : null;
  const needsAccent = style.motion === "pulse" || style.colour === "along";
  return {
    id: "line",
    title: label("title"),
    content: (
      <>
        <SelectField
          label={label("look")}
          value={look}
          options={lookOptions}
          onChange={(name) => {
            const next = LINE_LOOKS.find((l) => l.name === name);
            if (next) set(next.patch);
          }}
        />
        <MoreFields>
          <SelectField
            label={label("motion")}
            value={style.motion}
            options={MOTIONS.map((m) => ({ value: m, label: label(`motions.${m}`) }))}
            onChange={(motion) => set({ motion })}
          />
          {tailLabel && (
            <NumField
              label={tailLabel}
              value={style.tail}
              min={style.motion === "comet" ? 0.1 : 0.02}
              max={style.motion === "comet" ? 5 : style.motion === "dash" ? 0.5 : 1}
              step={style.motion === "comet" ? 0.1 : 0.01}
              onChange={(v) => set({ tail: v })}
              unit={style.motion === "comet" ? "s" : undefined}
            />
          )}
          {holdLabel && <NumField label={holdLabel} unit="s" value={style.hold} min={0.1} max={30} step={0.1} onChange={(v) => set({ hold: v })} />}
          {shaped && (
            <>
              <NumField label={label("taper")} value={style.taper} min={0} max={1} step={0.05} onChange={(v) => set({ taper: v })} />
              <NumField label={label("fade")} value={style.fade} min={0} max={1} step={0.05} onChange={(v) => set({ fade: v })} />
            </>
          )}
          {style.motion !== "unfold" && (
            <NumField
              label={label(clip.type === "sprite" ? "headSprite" : "headRibbon")}
              value={style.head}
              min={0.05}
              max={1}
              step={0.05}
              onChange={(v) => set({ head: v })}
            />
          )}
          <NumField label={label("nib")} value={style.nib} min={0} max={1} step={0.05} onChange={(v) => set({ nib: v })} />
          <ToggleField label={label("core")} value={style.core} onChange={(v) => set({ core: v })} />
          <NumField label={label("glow")} value={style.glow} min={0} max={1} step={0.05} onChange={(v) => set({ glow: v })} />
          <NumField label={label("wiggle")} unit="px" value={style.wiggle} min={0} max={60} step={1} onChange={(v) => set({ wiggle: v })} />
          <NumField label={label("echo")} value={style.echo} min={0} max={3} step={1} onChange={(v) => set({ echo: v })} />
          <SelectField
            label={label("colour")}
            value={style.colour}
            options={COLOURS.map((c) => ({ value: c, label: label(`colours.${c}`) }))}
            onChange={(colour) => set({ colour })}
          />
          {(style.colour === "cycle" || style.colour === "chase") && (
            <NumField label={label("colourSpeed")} value={style.colourSpeed} min={0.1} max={5} step={0.1} onChange={(v) => set({ colourSpeed: v })} />
          )}
          {needsAccent && <PaletteField label={label("accent")} colors={style.accent} onChange={(accent) => set({ accent })} />}
          {look === "custom" && (
            <Button variant="outline" size="xs" onClick={() => set({ ...DEFAULT_LINE_STYLE, accent: style.accent })}>
              {label("reset")}
            </Button>
          )}
        </MoreFields>
      </>
    ),
  };
}
