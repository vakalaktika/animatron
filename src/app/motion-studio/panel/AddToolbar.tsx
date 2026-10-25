"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { Button } from "@/app/components/shared-components";
import { SHAPE_COLORS, SHAPES, type ShapeKind } from "../lib/shapes";
import { Dialog } from "../dialogs/Dialog";
import { BubbleIcon, ChevronLeftIcon, ImageIcon, PencilIcon, PlusIcon, RingsIcon, ShapesIcon, SquiggleIcon, TextIcon, WingIcon } from "./icons";

export type AddKind = "text" | "bubble" | "ribbon" | "chippy" | "logo";

interface Props {
  onAdd: (kind: AddKind) => void;
  onAddShape: (kind: ShapeKind, fill: string) => void;
  onImport: (file: File) => void;
  /** The pen is on: strokes on the canvas become ribbons or a picture's path. */
  drawing: boolean;
  onToggleDraw: () => void;
  /** rail — a vertical toolbar beside the stage; sheet — a floating + that opens a sheet. */
  layout: "rail" | "sheet";
}

interface Tool {
  id: AddKind | "shape" | "import" | "draw";
  label: string;
  hint: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const TOOLS: Tool[] = [
  { id: "text", label: "Text", hint: "A line of text that reveals itself", Icon: TextIcon },
  { id: "bubble", label: "Speech bubble", hint: "Text in a bubble that points at something", Icon: BubbleIcon },
  { id: "shape", label: "Shape", hint: "A circle, star, arrow and friends", Icon: ShapesIcon },
  { id: "import", label: "Picture or animation", hint: "PNG, JPG, SVG or a Lottie file", Icon: ImageIcon },
  { id: "ribbon", label: "Ribbon", hint: "A rainbow line that draws itself in", Icon: SquiggleIcon },
  { id: "draw", label: "Draw", hint: "Sketch on the canvas: a ribbon, or a path for the picture you picked (Esc to stop)", Icon: PencilIcon },
  { id: "chippy", label: "Chippy", hint: "The bird, flying along a path", Icon: WingIcon },
  { id: "logo", label: "Logo rings", hint: "Rings spring in and a letter traces", Icon: RingsIcon },
];

const ACCEPT = ".json,.svg,.png,.jpg,.jpeg,.webp,.gif";

/** The shapes, each drawn once as a small SVG tile. */
function ShapeTile({ kind, fill }: { kind: ShapeKind; fill: string }) {
  const body = (() => {
    switch (kind) {
      case "circle":
        return <circle cx="12" cy="12" r="9" />;
      case "square":
        return <rect x="3.5" y="3.5" width="17" height="17" />;
      case "rounded":
        return <rect x="3.5" y="3.5" width="17" height="17" rx="5" />;
      case "triangle":
        return <path d="M12 3.5 21 20.5H3z" />;
      case "star":
        return <path d="m12 3 2.6 5.8 6.4.6-4.8 4.2 1.5 6.2L12 16.6 6.3 19.8l1.5-6.2L3 9.4l6.4-.6z" />;
      case "arrow":
        return <path d="M3 9.5h10V6l8 6-8 6v-3.5H3z" />;
      case "heart":
        return <path d="M12 20.5C6 16 3 12.6 3 9a4.5 4.5 0 0 1 9-1.2A4.5 4.5 0 0 1 21 9c0 3.6-3 7-9 11.5z" />;
      case "blob":
        return <path d="M14 3.5c3.5.5 6.5 3 7.3 6.5 1 4-1.3 8-4.5 10.2-3 2-7.3 2.4-10.2.4C3.5 18.6 2 14.6 3.6 11c1.5-3.6 5.3-8 10.4-7.5z" />;
    }
  })();
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} fill={fill} aria-hidden="true">
      {body}
    </svg>
  );
}

function ShapePicker({ onPick }: { onPick: (kind: ShapeKind, fill: string) => void }) {
  const [fill, setFill] = useState(SHAPE_COLORS[0]);
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
        {SHAPE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={fill === c}
            aria-label={`Colour ${c}`}
            onClick={() => setFill(c)}
            className={`h-8 w-8 rounded-full border-2 transition-transform duration-150 ${fill === c ? "scale-110 border-ink" : "border-border-strong hover:scale-105"}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {SHAPES.map((s) => (
          <button
            key={s.kind}
            type="button"
            onClick={() => onPick(s.kind, fill)}
            className="flex flex-col items-center gap-1.5 rounded-md border border-hairline bg-surface px-2 py-3 text-ink-secondary transition-colors duration-150 hover:border-border-control hover:bg-surface-raised hover:text-ink"
          >
            <ShapeTile kind={s.kind} fill={fill} />
            <span className="font-sans text-[11px] font-semibold tracking-[0.02em]">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Everything that can be added to the canvas, always one click away. On
 * desktop a slim rail beside the stage with a tooltip per tool; on phones a
 * floating + that opens a sheet with the same list spelled out.
 */
export function AddToolbar({ onAdd, onAddShape, onImport, drawing, onToggleDraw, layout }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [shapesOpen, setShapesOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // The shapes popover on the rail closes on an outside click or Escape.
  useEffect(() => {
    if (!shapesOpen || layout !== "rail") return;
    const onDown = (e: PointerEvent) => {
      if (!railRef.current?.contains(e.target as Node)) setShapesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShapesOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [shapesOpen, layout]);

  const run = (tool: Tool) => {
    if (tool.id === "import") {
      fileRef.current?.click();
      return;
    }
    if (tool.id === "shape") {
      setShapesOpen(true);
      return;
    }
    if (tool.id === "draw") {
      onToggleDraw();
      setSheetOpen(false);
      return;
    }
    onAdd(tool.id);
    setSheetOpen(false);
  };

  const pickShape = (kind: ShapeKind, fill: string) => {
    onAddShape(kind, fill);
    setShapesOpen(false);
    setSheetOpen(false);
  };

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept={ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onImport(file);
        e.target.value = "";
        setSheetOpen(false);
      }}
    />
  );

  if (layout === "rail") {
    return (
      <div ref={railRef} className="relative flex flex-col items-center gap-0.5 rounded-lg border border-border-strong bg-surface-raised p-1 shadow-md">
        {TOOLS.map((tool) => {
          const content: ReactNode = (
            <>
              <tool.Icon />
              <span className="atm-tip pointer-events-none absolute top-1/2 left-full z-20 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-border-strong bg-surface-inverse px-2.5 py-1.5 text-[12px] text-ink-on-inverse opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="font-sans font-semibold tracking-[0.02em]">{tool.label}</span>
                <span className="ml-2 text-ink-on-inverse/70">{tool.hint}</span>
              </span>
            </>
          );
          const on = (tool.id === "shape" && shapesOpen) || (tool.id === "draw" && drawing);
          const cls = `group relative flex h-10 w-10 items-center justify-center rounded-md text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink ${
            on ? "bg-primary-soft text-primary" : ""
          }`;
          return (
            <button
              key={tool.id}
              type="button"
              aria-label={tool.label}
              aria-pressed={tool.id === "draw" ? drawing : undefined}
              aria-expanded={tool.id === "shape" ? shapesOpen : undefined}
              aria-haspopup={tool.id === "shape" ? "dialog" : undefined}
              onClick={() => run(tool)}
              className={cls}
            >
              {content}
            </button>
          );
        })}
        {fileInput}
        {shapesOpen && (
          <div
            role="dialog"
            aria-label="Add a shape"
            className="atm-pop absolute top-0 left-full z-30 ml-3 w-72 rounded-lg border border-border-strong bg-surface-raised p-4 shadow-lg"
          >
            <ShapePicker onPick={pickShape} />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Button
        size="md"
        onClick={() => setSheetOpen(true)}
        aria-label="Add to the canvas"
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        icon={<PlusIcon width={24} height={24} />}
        className="h-14 w-14 !rounded-full !px-0 shadow-lg"
      >
        {null}
      </Button>
      {fileInput}
      <Dialog open={sheetOpen} onClose={() => setSheetOpen(false)} title="Add to the canvas">
        {shapesOpen ? (
          <div className="flex flex-col gap-4">
            <Button size="xs" variant="outline" className="self-start" icon={<ChevronLeftIcon width={14} height={14} />} onClick={() => setShapesOpen(false)}>
              All items
            </Button>
            <ShapePicker onPick={pickShape} />
          </div>
        ) : (
          <ul className="flex flex-col">
            {TOOLS.map((tool) => {
              const inner = (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface text-ink-secondary">
                    <tool.Icon />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base text-ink">{tool.label}</span>
                    <span className="block text-sm text-ink-muted">{tool.hint}</span>
                  </span>
                </>
              );
              const cls = "flex min-h-14 w-full items-center gap-3 rounded-md px-2 text-left transition-colors duration-150 hover:bg-surface-sunken";
              return (
                <li key={tool.id}>
                  <button type="button" className={cls} aria-pressed={tool.id === "draw" ? drawing : undefined} onClick={() => run(tool)}>
                    {inner}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Dialog>
    </>
  );
}
