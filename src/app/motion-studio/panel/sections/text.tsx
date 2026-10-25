"use client";

import type { ContainerShape, TextClip } from "@/app/components/motion-studio/types";
import { ChipField, ColorField, MoreFields, NumField, SelectField, TextField, ToggleField } from "../fields";
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
        <TextField label="Text" value={clip.text} onChange={(v) => set("text", v)} autoFocus={focusText} placeholder="Type something" />
        <ChipField
          label="Font"
          value={clip.font}
          options={[
            { value: "sans", label: "Sans" },
            { value: "serif", label: "Serif" },
          ]}
          onChange={(v) => set("font", v)}
        />
        <NumField label="Font size" unit="px" value={clip.fontSize} min={10} max={160} step={1} onChange={(v) => set("fontSize", v)} />
        <ColorField label="Colour" value={clip.color} onChange={(v) => set("color", v)} />
        <MoreFields label="Highlighted ending">
          <TextField label="Ending to highlight" value={clip.accentSuffix} onChange={(v) => set("accentSuffix", v)} placeholder="e.g. .ai" />
          <ColorField label="Highlight colour" value={clip.accentColor} onChange={(v) => set("accentColor", v)} />
        </MoreFields>
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
    title: "Bubble",
    content: (
      <>
        <ChipField
          label="Shape"
          value={container.shape}
          options={[
            { value: "none", label: "None" },
            { value: "speech", label: "Speech" },
            { value: "soft", label: "Pill" },
            { value: "minimal", label: "Outline" },
            { value: "thought", label: "Thought" },
          ]}
          onChange={(shape) => box({ shape, ...SHAPE_PRESET[shape] })}
        />
        {boxed && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Fill" value={container.fill} onChange={(v) => box({ fill: v })} />
              <ColorField label="Outline" value={container.stroke} onChange={(v) => box({ stroke: v })} />
            </div>
            <SelectField
              label="Pointer"
              value={tail.mode}
              options={[
                { value: "auto", label: "Points at what it follows" },
                { value: "manual", label: "Where I drag it" },
                { value: "none", label: "No pointer" },
              ]}
              onChange={(mode) => setTail({ mode })}
            />
            <MoreFields>
              <div className="grid grid-cols-2 gap-4">
                <NumField label="Padding X" unit="px" value={container.padding.x} min={0} max={120} step={1} onChange={(v) => box({ padding: { ...container.padding, x: v } })} />
                <NumField label="Padding Y" unit="px" value={container.padding.y} min={0} max={120} step={1} onChange={(v) => box({ padding: { ...container.padding, y: v } })} />
              </div>
              <NumField label="Corner radius" unit="px" value={container.radius} min={0} max={999} step={1} onChange={(v) => box({ radius: v })} />
              {tail.mode === "manual" && (
                <>
                  <SelectField
                    label="Pointer side"
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
                    <NumField label="Pointer position" unit="px" value={tail.position} min={0} max={600} step={1} onChange={(v) => setTail({ position: v })} />
                    <NumField label="Pointer length" unit="px" value={tail.length} min={0} max={200} step={1} onChange={(v) => setTail({ length: v })} />
                  </div>
                </>
              )}
            </MoreFields>
          </>
        )}
      </>
    ),
  };
}

/** How the text arrives, plus the rainbow rule. */
export function revealSection(clip: TextClip, onChange: (c: TextClip) => void): PanelSection {
  const set = setter(clip, onChange);
  const hasMore = clip.reveal !== "fade" || clip.rule;
  return {
    id: "reveal",
    title: "Entrance",
    content: (
      <>
        <ChipField
          label="Appears by"
          value={clip.reveal}
          options={[
            { value: "letters", label: "Letter by letter" },
            { value: "pop", label: "Popping in" },
            { value: "fade", label: "Fading in" },
          ]}
          onChange={(v) => set("reveal", v)}
        />
        {clip.reveal === "letters" ? (
          <ChipField
            label="Starting from"
            value={clip.direction}
            options={[
              { value: "center", label: "Middle" },
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ]}
            onChange={(v) => set("direction", v)}
          />
        ) : (
          <NumField label="Takes" unit="s" value={clip.revealDuration} min={0.1} max={2} onChange={(v) => set("revealDuration", v)} />
        )}
        <ToggleField label="Rainbow underline" value={clip.rule} onChange={(v) => set("rule", v)} />
        {hasMore && (
        <MoreFields>
          {clip.reveal === "letters" && (
            <>
              <NumField label="Gap between letters" unit="s" value={clip.letterStagger} min={0} max={0.3} step={0.005} onChange={(v) => set("letterStagger", v)} />
              <NumField label="Each letter takes" unit="s" value={clip.letterDuration} min={0.05} max={2} onChange={(v) => set("letterDuration", v)} />
            </>
          )}
          {clip.reveal === "pop" && <NumField label="Bounce" value={clip.overshoot} min={0} max={4} onChange={(v) => set("overshoot", v)} />}
          {clip.rule && (
            <>
              <NumField label="Underline starts after" unit="s" value={clip.ruleDelay} min={0} max={3} onChange={(v) => set("ruleDelay", v)} />
              <NumField label="Underline takes" unit="s" value={clip.ruleDuration} min={0.1} max={3} onChange={(v) => set("ruleDuration", v)} />
              <NumField label="Underline width" unit="px" value={clip.ruleWidth} min={16} max={800} step={1} onChange={(v) => set("ruleWidth", v)} />
            </>
          )}
        </MoreFields>
        )}
      </>
    ),
  };
}
