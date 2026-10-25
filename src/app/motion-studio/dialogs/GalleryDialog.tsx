"use client";

import { useState } from "react";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { Button, Select } from "@/app/components/shared-components";
import { recentFirst, type Project } from "../lib/projects";
import { BUILT_IN_PRESETS, FRAME_SIZES } from "../presets";
import { MiniPreview } from "../panel/MiniPreview";
import { DuplicateIcon, PlusIcon, TrashIcon } from "../panel/icons";
import { Dialog } from "./Dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  currentId: string | null;
  onOpenProject: (id: string) => void;
  onNewFromTemplate: (doc: StudioDoc) => void;
  onNewBlank: (width: number, height: number) => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
}

const TEMPLATE_BLURB: Record<string, string> = {
  Welcome: "A ribbon draws in, the title rides its tip, a comet loops.",
  "Ribbon ride": "A wave ribbon with a rider that lands and a loop.",
  "End cap": "Rings spring in, the bird arrives, a bubble speaks.",
  "Chippy loader": "A tidy loop for a loading screen.",
};

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const TILE =
  "group relative flex w-full flex-col overflow-hidden rounded-lg border border-hairline bg-surface text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border-control hover:shadow-md focus-visible:border-border-control";

/**
 * Where compositions start and live: ready-made templates with live
 * previews, a blank canvas in any frame, and every project saved in this
 * browser, newest first. Opening anything here leaves the current project
 * safely in the list.
 */
export function GalleryDialog({
  open,
  onClose,
  projects,
  currentId,
  onOpenProject,
  onNewFromTemplate,
  onNewBlank,
  onDuplicateProject,
  onDeleteProject,
  onRenameProject,
}: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const recent = recentFirst(projects);

  return (
    <Dialog open={open} onClose={onClose} title="Compositions" description="Start from a template or pick up where you left off." size="full">
      <section aria-labelledby="gallery-templates">
        <h3 id="gallery-templates" className="atm-section-label mb-3">
          Start something new
        </h3>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <li>
            <div className={`${TILE} h-full justify-between border-dashed border-border-control`}>
              <div className="flex aspect-video items-center justify-center text-ink-secondary">
                <PlusIcon width={28} height={28} />
              </div>
              <div className="flex flex-col gap-2 border-t border-hairline p-3">
                <span className="text-sm font-semibold text-ink">Blank canvas</span>
                <Select variant="compact" aria-label="Frame size" className="w-full" value={frame} onChange={(e) => setFrame(Number(e.target.value))}>
                  {FRAME_SIZES.map((f, i) => (
                    <option key={f.label} value={i}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                <Button size="xs" onClick={() => onNewBlank(FRAME_SIZES[frame].width, FRAME_SIZES[frame].height)}>
                  Create
                </Button>
              </div>
            </div>
          </li>
          {BUILT_IN_PRESETS.map((preset) => {
            const key = `template:${preset.label}`;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={TILE}
                  onMouseEnter={() => setHover(key)}
                  onMouseLeave={() => setHover((h) => (h === key ? null : h))}
                  onFocus={() => setHover(key)}
                  onBlur={() => setHover((h) => (h === key ? null : h))}
                  onClick={() => onNewFromTemplate(preset.make())}
                >
                  <TemplateThumb make={preset.make} active={hover === key} />
                  <span className="flex flex-col gap-0.5 border-t border-hairline p-3">
                    <span className="text-sm font-semibold text-ink">{preset.label}</span>
                    <span className="text-xs leading-4 text-ink-muted">{TEMPLATE_BLURB[preset.label] ?? "A ready-made composition."}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="gallery-projects" className="mt-8">
        <h3 id="gallery-projects" className="atm-section-label mb-3">
          Your compositions {recent.length > 0 && <span className="text-ink-muted">· {recent.length}</span>}
        </h3>
        {recent.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-control p-6 text-center text-sm text-ink-muted">
            Nothing saved yet. Everything you make here is kept in this browser and shows up in this list.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {recent.map((project) => {
              const current = project.id === currentId;
              const deleting = confirmDelete === project.id;
              return (
                <li key={project.id} className={`${TILE} ${current ? "border-primary" : ""}`}>
                  <button
                    type="button"
                    className="w-full text-left"
                    aria-label={`Open ${project.doc.name}`}
                    onMouseEnter={() => setHover(project.id)}
                    onMouseLeave={() => setHover((h) => (h === project.id ? null : h))}
                    onFocus={() => setHover(project.id)}
                    onBlur={() => setHover((h) => (h === project.id ? null : h))}
                    onClick={() => onOpenProject(project.id)}
                  >
                    <MiniPreview doc={project.doc} active={hover === project.id} />
                  </button>
                  <div className="flex items-center gap-1 border-t border-hairline py-2 pr-1 pl-3">
                    <div className="min-w-0 flex-1">
                      <input
                        aria-label={`Name of ${project.doc.name}`}
                        className="w-full truncate rounded-sm border border-transparent bg-transparent px-1 -mx-1 text-sm font-semibold text-ink hover:border-hairline focus:border-primary focus:outline-none"
                        defaultValue={project.doc.name}
                        key={project.doc.name}
                        onBlur={(e) => {
                          const name = e.currentTarget.value.trim();
                          if (name && name !== project.doc.name) onRenameProject(project.id, name);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                      />
                      <p className="truncate text-xs text-ink-muted">
                        {current ? "Open now" : `Edited ${when(project.updatedAt)}`} · {project.doc.clips.length} {project.doc.clips.length === 1 ? "layer" : "layers"}
                      </p>
                    </div>
                    {deleting ? (
                      <span className="flex items-center gap-1">
                        <Button size="xs" variant="danger" onClick={() => onDeleteProject(project.id)}>
                          Delete
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => setConfirmDelete(null)}>
                          Keep
                        </Button>
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label={`Duplicate ${project.doc.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-sunken hover:text-ink pointer-coarse:h-11 pointer-coarse:w-11"
                          onClick={() => onDuplicateProject(project.id)}
                        >
                          <DuplicateIcon width={16} height={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${project.doc.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-sunken hover:text-error pointer-coarse:h-11 pointer-coarse:w-11"
                          onClick={() => setConfirmDelete(project.id)}
                        >
                          <TrashIcon width={16} height={16} />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Dialog>
  );
}

/** Builds the template once per tile so its preview clock has a stable document. */
function TemplateThumb({ make, active }: { make: () => StudioDoc; active: boolean }) {
  const [doc] = useState(make);
  return <MiniPreview doc={doc} active={active} />;
}
