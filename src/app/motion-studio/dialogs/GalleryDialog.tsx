"use client";

import { useRef, useState, type DragEvent } from "react";
import type { StudioDoc } from "@/app/components/motion-studio/types";
import { Button, Select } from "@/app/components/shared-components";
import { newId } from "../lib/id";
import { inFolder, recentFirst, type Folder, type Project } from "../lib/projects";
import { FRAME_SIZES } from "../presets";
import { frameIndex, frameLabel, TEMPLATES } from "../templates";
import { ChipField } from "../panel/fields";
import { MiniPreview } from "../panel/MiniPreview";
import { DuplicateIcon, FolderIcon, PlusIcon, TrashIcon, UploadIcon } from "../panel/icons";
import { AccountStrip, type AccountControls } from "./AccountStrip";
import { Dialog } from "./Dialog";
import { downloadText } from "../export/recorder";

interface Props {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  folders: Folder[];
  currentId: string | null;
  onOpenProject: (id: string) => void;
  /** New compositions are filed in the folder being looked at (null: unfiled). */
  onNewFromTemplate: (doc: StudioDoc, folderId: string | null) => void;
  onNewBlank: (width: number, height: number, folderId: string | null) => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  /** Signing in and syncing, when the cloud is set up. */
  account: AccountControls;
  /** JSON files chosen or dropped; each becomes a composition in the folder. */
  onImportFiles: (files: File[], folderId: string | null) => void;
  onAddFolder: (id: string, name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveProject: (id: string, folderId: string | null) => void;
}

/** Which compositions are showing: every one, the unfiled ones, or a folder. */
type View = "all" | "unfiled" | `folder:${string}`;
const folderOf = (view: View): string | null => (view.startsWith("folder:") ? view.slice("folder:".length) : null);
const NO_FOLDER = "";
const isJsonFile = (file: File) => /\.json$/i.test(file.name) || file.type === "application/json";

/** Size chips: every frame by its plain name, plus all of them. */
const ALL_SIZES = "All sizes";
const SIZE_OPTIONS = [ALL_SIZES, ...FRAME_SIZES.map((f) => f.name)].map((value) => ({ value, label: value }));

/** Each template with the frame it is set in, read once from a throwaway copy. */
const CATALOG = TEMPLATES.map((t) => {
  const doc = t.make();
  return { ...t, frame: frameLabel(doc.stage), frameIndex: frameIndex(doc) };
});

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
  account,
  onImportFiles,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveProject,
  folders,
}: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [size, setSize] = useState(ALL_SIZES);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(false);
  const [naming, setNaming] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // A folder that was deleted elsewhere falls back to showing everything.
  const [wantedView, setView] = useState<View>("all");
  const view: View = wantedView.startsWith("folder:") && !folders.some((f) => f.id === folderOf(wantedView)) ? "all" : wantedView;
  const viewFolderId = folderOf(view);
  const viewFolder = folders.find((f) => f.id === viewFolderId) ?? null;
  const shown = view === "all" ? projects : inFolder(projects, viewFolderId);
  const recent = recentFirst(shown);
  const sizeIndex = FRAME_SIZES.findIndex((f) => f.name === size);
  const templates = sizeIndex < 0 ? CATALOG : CATALOG.filter((t) => t.frameIndex === sizeIndex);
  const viewOptions: { value: View; label: string }[] = [
    { value: "all", label: "All" },
    ...(folders.length ? [{ value: "unfiled" as const, label: "Unfiled" }] : []),
    ...folders.map((f) => ({ value: `folder:${f.id}` as const, label: f.name })),
  ];

  const createFolder = (name: string) => {
    const id = newId();
    onAddFolder(id, name);
    setView(`folder:${id}`);
    setNaming(false);
  };

  const importFiles = (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []).filter(isJsonFile);
    if (files.length) onImportFiles(files, viewFolderId);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    importFiles(e.dataTransfer.files);
  };

  /** Picking a size also points the blank canvas at it. */
  const pickSize = (next: string) => {
    setSize(next);
    const i = FRAME_SIZES.findIndex((f) => f.name === next);
    if (i >= 0) setFrame(i);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Compositions" description="Start from a template or pick up where you left off." size="full">
      <AccountStrip {...account} />
      <section aria-labelledby="gallery-templates">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h3 id="gallery-templates" className="atm-section-label">
            Start something new
          </h3>
          <ChipField label="Size" value={size} options={SIZE_OPTIONS} onChange={pickSize} />
        </div>
        <p className="sr-only" aria-live="polite">
          {templates.length} {templates.length === 1 ? "template" : "templates"}
        </p>
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
                      {frameLabel(f)}
                    </option>
                  ))}
                </Select>
                <Button size="xs" onClick={() => onNewBlank(FRAME_SIZES[frame].width, FRAME_SIZES[frame].height, viewFolderId)}>
                  Create
                </Button>
              </div>
            </div>
          </li>
          {templates.map((template) => {
            const key = `template:${template.label}`;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={`${TILE} h-full`}
                  onMouseEnter={() => setHover(key)}
                  onMouseLeave={() => setHover((h) => (h === key ? null : h))}
                  onFocus={() => setHover(key)}
                  onBlur={() => setHover((h) => (h === key ? null : h))}
                  onClick={() => onNewFromTemplate(template.make(), viewFolderId)}
                >
                  <TemplateThumb make={template.make} active={hover === key} />
                  <span className="flex flex-col gap-0.5 border-t border-hairline p-3">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{template.label}</span>
                      <span className="shrink-0 text-[11px] text-ink-muted">{template.frame}</span>
                    </span>
                    <span className="text-xs leading-4 text-ink-muted">{template.blurb}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="gallery-projects"
        className={`mt-8 rounded-lg transition-[box-shadow] duration-200 ${dragging ? "shadow-[0_0_0_2px_var(--primary)]" : ""}`}
        onDragOver={(e) => {
          if (!Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h3 id="gallery-projects" className="atm-section-label">
            Your compositions {projects.length > 0 && <span className="text-ink-muted">· {projects.length}</span>}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                importFiles(e.currentTarget.files);
                e.currentTarget.value = "";
              }}
            />
            <Button size="xs" variant="outline" icon={<UploadIcon width={14} height={14} />} onClick={() => fileRef.current?.click()}>
              Import JSON
            </Button>
            {naming ? (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  createFolder(new FormData(e.currentTarget).get("name")?.toString() ?? "");
                }}
              >
                <input
                  name="name"
                  aria-label="New folder name"
                  autoFocus
                  defaultValue="New folder"
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setNaming(false);
                  }}
                  className="h-7 w-40 rounded-sm border border-border-control bg-surface px-2 text-sm text-ink focus:border-primary focus:outline-none"
                />
                <Button size="xs" type="submit">
                  Create
                </Button>
                <Button size="xs" variant="outline" type="button" onClick={() => setNaming(false)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <Button size="xs" variant="outline" icon={<FolderIcon width={14} height={14} />} onClick={() => setNaming(true)}>
                New folder
              </Button>
            )}
          </div>
        </div>
        {folders.length > 0 && (
          <div className="mb-3">
            <ChipField label="Show" value={view} options={viewOptions} onChange={(v) => { setView(v); setConfirmDeleteFolder(false); }} />
          </div>
        )}
        {viewFolder && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-hairline bg-surface px-3 py-2">
            <FolderIcon width={16} height={16} className="text-ink-secondary" />
            <input
              aria-label="Folder name"
              key={viewFolder.id + viewFolder.name}
              defaultValue={viewFolder.name}
              className="min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 text-sm font-semibold text-ink hover:border-hairline focus:border-primary focus:outline-none"
              onBlur={(e) => {
                const name = e.currentTarget.value.trim();
                if (name && name !== viewFolder.name) onRenameFolder(viewFolder.id, name);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
            <span className="text-xs text-ink-muted">
              {shown.length} {shown.length === 1 ? "composition" : "compositions"}
            </span>
            {confirmDeleteFolder ? (
              <span className="flex items-center gap-1">
                <span className="text-xs text-ink-muted">Compositions stay, unfiled.</span>
                <Button size="xs" variant="danger" onClick={() => { onDeleteFolder(viewFolder.id); setView("all"); setConfirmDeleteFolder(false); }}>
                  Delete folder
                </Button>
                <Button size="xs" variant="outline" onClick={() => setConfirmDeleteFolder(false)}>
                  Keep
                </Button>
              </span>
            ) : (
              <Button size="xs" variant="outline" onClick={() => setConfirmDeleteFolder(true)}>
                Delete folder
              </Button>
            )}
          </div>
        )}
        {recent.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-control p-6 text-center text-sm text-ink-muted">
            {projects.length === 0
              ? "Nothing saved yet. Everything you make here is kept in this browser and shows up in this list. Drop a JSON file here to bring one in."
              : viewFolder
                ? `Nothing in “${viewFolder.name}” yet. Pick a folder on a composition's tile to file it here, or drop a JSON file.`
                : "Everything is filed in a folder."}
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
                    disabled={!!project.recoveryJson}
                    className="w-full text-left"
                    onMouseEnter={() => setHover(project.id)}
                    onMouseLeave={() => setHover((h) => (h === project.id ? null : h))}
                    onFocus={() => setHover(project.id)}
                    onBlur={() => setHover((h) => (h === project.id ? null : h))}
                    onClick={() => onOpenProject(project.id)}
                  >
                    <span className="sr-only">Open {project.doc.name}</span>
                    {project.recoveryJson?<span className="flex min-h-24 items-center justify-center p-3 text-sm text-ink-muted">Needs a supporting app</span>:<MiniPreview doc={project.doc} active={hover === project.id} />}
                  </button>
                  {project.recoveryJson&&<div className="p-2"><p className="atm-help">Original data preserved. {project.recoveryReason}</p><Button size="xs" variant="outline" onClick={()=>downloadText(project.recoveryJson!,`${project.doc.name.replace(/[^a-z0-9]+/gi,"-")}.recovery.json`,"application/json")}>Download original JSON</Button></div>}
                  <div className="flex items-center gap-1 border-t border-hairline py-2 pr-1 pl-3">
                    <div className="min-w-0 flex-1">
                      <input
                        aria-label={`Name of ${project.doc.name}`}
                        disabled={!!project.recoveryJson}
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
                          disabled={!!project.recoveryJson}
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
                  {folders.length > 0 && (
                    <div className="flex items-center gap-2 border-t border-hairline px-3 py-1.5">
                      <FolderIcon width={14} height={14} className="shrink-0 text-ink-muted" />
                      <Select
                        variant="compact"
                        aria-label={`Folder of ${project.doc.name}`}
                        className="w-full"
                        value={project.folderId ?? NO_FOLDER}
                        onChange={(e) => onMoveProject(project.id, e.target.value || null)}
                      >
                        <option value={NO_FOLDER}>No folder</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
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
