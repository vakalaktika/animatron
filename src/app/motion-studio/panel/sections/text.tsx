"use client";

import type { ContainerShape, TextClip } from "@/app/components/motion-studio/types";
import { NumField, SelectField, TextField, ToggleField } from "../fields";
import type { PanelSection } from "../PanelGroup";
import { setter } from "./setter";

/** Radius and padding a shape starts with when picked; the user can tune after. */
const SHAPE_PRESET: Record<ContainerShape, Pick<TextClip["container"], "radius" | "padding">> = {
  none: { radius: 16, padding: { x: 28, y: 16 } },
  speech: { radius: 16, padding: { x: 28, y: 16 } },
  soft: { radius: 999, padding: { x: 32, y: 14 } },
  minimal: { radius: 4, padding: { x: 16, y: 8 } },
  thought: { radius: 28, padding: { x: 32, y: 20 } },
};

/** Typography, colour, and accent. */
export function textSection(clip: TextClip, onChange: (c: TextClip) => void, focusText = false): PanelSection {
  const set = setter(clip, onChange);
  return {
    id: "text",
    title: "Text",
    content: (
      <>
        <TextField label="Text" value={clip.text} onChange={(v) => set("text", v)} autoFocus={focusText} />
        <SelectField
          label="Font"
          value={clip.font}
          options={[
            { value: "sans", label: "Work Sans" },
            { value: "serif", label: "Gelasio (serif)" },
          ]}
          onChange={(v) => set("font", v)}
        />
        <NumField label="Font size" value={clip.fontSize} min={10} max={120} step={1} onChange={(v) => set("fontSize", v)} />
        <TextField label="Color" value={clip.color} onChange={(v) => set("color", v)} />
        <TextField label="Accent suffix" value={clip.accentSuffix} onChange={(v) => set("accentSuffix", v)} />
        <TextField label="Accent color" value={clip.accentColor} onChange={(v) => set("accentColor", v)} />
      </>
    ),
  };
}

/** Box shape, colours, padding, and the tail. */
export function containerSection(clip: TextClip, onChange: (c: TextClip) => void): PanelSection {
  const set = setter(clip, onChange);
  const { container, tail } = clip;
  const box = (patch: Partial<TextClip["container"]>) => set("container", { ...container, ...patch });
  const setTail = (patch: Partial<TextClip["tail"]>) => set("tail", { ...tail, ...patch });
  const boxed = container.shape !== "none";
  return {
    id: "container",
    title: "Container",
    content: (
      <>
        <SelectField
          label="Shape"
          value={container.shape}
          options={[
            { value: "none", label: "None (plain text)" },
            { value: "speech", label: "Speech bubble" },
            { value: "soft", label: "Soft pill" },
            { value: "minimal", label: "Minimal outline" },
            { value: "thought", label: "Thought cloud" },
          ]}
          onChange={(shape) => box({ shape, ...SHAPE_PRESET[shape] })}
        />
        {boxed && (
          <>
            <TextField label="Fill" value={container.fill} onChange={(v) => box({ fill: v })} />
            <TextField label="Stroke" value={container.stroke} onChange={(v) => box({ stroke: v })} />
            <div className="grid grid-cols-2 gap-4">
              <NumField label="Padding X" value={container.padding.x} min={0} max={120} step={1} onChange={(v) => box({ padding: { ...container.padding, x: v } })} />
              <NumField label="Padding Y" value={container.padding.y} min={0} max={120} step={1} onChange={(v) => box({ padding: { ...container.padding, y: v } })} />
            </div>
            <NumField label="Corner radius" value={container.radius} min={0} max={999} step={1} onChange={(v) => box({ radius: v })} />
            <SelectField
              label="Tail"
              value={tail.mode}
              options={[
                { value: "auto", label: "Auto (points at the parent)" },
                { value: "manual", label: "Manual (drag the handle on stage)" },
                { value: "none", label: "None" },
              ]}
              onChange={(mode) => setTail({ mode })}
            />
            {tail.mode === "manual" && (
              <>
                <SelectField
                  label="Tail side"
                  value={tail.side}
                  options={[
                    { value: "bottom", label: "Bottom" },
                    { value: "top", label: "Top" },
                    { value: "left", label: "Left" },
                    { value: "right", label: "Right" },
                  ]}
                  onChange={(side) => setTail({ side })}
                />
                <div className="grid grid-cols-2 gap-4">
                  <NumField label="Tail position" value={tail.position} min={0} max={600} step={1} onChange={(v) => setTail({ position: v })} />
                  <NumField label="Tail length" value={tail.length} min={0} max={200} step={1} onChange={(v) => setTail({ length: v })} />
                </div>
              </>
            )}
          </>
        )}
      </>
    ),
  };
}

/** How the text arrives, plus the rainbow rule. */
export function revealSection(clip: TextClip, onChange: (c: TextClip) => void): PanelSection {
  const set = setter(clip, onChange);
  return {
    id: "reveal",
    title: "Reveal",
    content: (
      <>
        <SelectField
          label="Mode"
          value={clip.reveal}
          options={[
            { value: "letters", label: "Letters unfold" },
            { value: "pop", label: "Pop in" },
            { value: "fade", label: "Fade in" },
          ]}
          onChange={(v) => set("reveal", v)}
        />
        {clip.reveal === "letters" && (
          <>
            <SelectField
              label="Unfold from"
              value={clip.direction}
              options={[
                { value: "center", label: "Center outward" },
                { value: "left", label: "Left to right" },
                { value: "right", label: "Right to left" },
              ]}
              onChange={(v) => set("direction", v)}
            />
            <NumField label="Letter stagger (s)" value={clip.letterStagger} min={0} max={0.3} step={0.005} onChange={(v) => set("letterStagger", v)} />
            <NumField label="Letter duration (s)" value={clip.letterDuration} min={0.05} max={2} onChange={(v) => set("letterDuration", v)} />
          </>
        )}
        {clip.reveal !== "letters" && (
          <NumField label="Duration (s)" value={clip.revealDuration} min={0.1} max={2} onChange={(v) => set("revealDuration", v)} />
        )}
        {clip.reveal === "pop" && (
          <NumField label="Overshoot" value={clip.overshoot} min={0} max={4} onChange={(v) => set("overshoot", v)} />
        )}
        <ToggleField label="Rainbow rule" value={clip.rule} onChange={(v) => set("rule", v)} />
        {clip.rule && (
          <>
            <NumField label="Rule delay (s)" value={clip.ruleDelay} min={0} max={3} onChange={(v) => set("ruleDelay", v)} />
            <NumField label="Rule duration (s)" value={clip.ruleDuration} min={0.1} max={3} onChange={(v) => set("ruleDuration", v)} />
            <NumField label="Rule width (px)" value={clip.ruleWidth} min={16} max={800} step={1} onChange={(v) => set("ruleWidth", v)} />
          </>
        )}
      </>
    ),
  };
}
