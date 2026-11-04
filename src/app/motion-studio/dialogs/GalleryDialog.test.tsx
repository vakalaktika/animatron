// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { FRAME_SIZES, welcomePreset } from "../presets";
import { TEMPLATES } from "../templates";
import { GalleryDialog } from "./GalleryDialog";

// jsdom has no modal dialogs or ResizeObserver; the gallery needs both to mount.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  class StubResizeObserver {
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  window.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;
});

function mount(extra: Partial<Parameters<typeof GalleryDialog>[0]> = {}) {
  const handlers = {
    onNewBlank: vi.fn(),
    onNewFromTemplate: vi.fn(),
    onImportFiles: vi.fn(),
    onAddFolder: vi.fn(),
    onRenameFolder: vi.fn(),
    onDeleteFolder: vi.fn(),
    onMoveProject: vi.fn(),
  };
  const project = { id: "p1", doc: { ...welcomePreset(), name: "My piece" }, updatedAt: new Date().toISOString() };
  const utils = render(
    <GalleryDialog
      open
      onClose={() => {}}
      projects={[project]}
      folders={[]}
      currentId="p1"
      onOpenProject={() => {}}
      onDuplicateProject={() => {}}
      onDeleteProject={() => {}}
      onRenameProject={() => {}}
      {...handlers}
      {...extra}
    />,
  );
  return { ...utils, ...handlers };
}

const FOLDERS = [
  { id: "f1", name: "Logos" },
  { id: "f2", name: "Pitches" },
];
const filed = (id: string, name: string, folderId: string | null) => ({ id, doc: { ...welcomePreset(), name }, updatedAt: new Date().toISOString(), folderId });

/** The template tiles' names, in order (the blank-canvas tile has no button-title span). */
const tileLabels = () =>
  within(screen.getByRole("region", { name: "Start something new" }))
    .getAllByRole("listitem")
    .map((li) => li.querySelector("button > span > span > span.text-sm")?.textContent ?? "")
    .filter((label) => label !== "");

describe("GalleryDialog templates", () => {
  it("shows every template under All sizes, each with its frame", () => {
    mount();
    expect(tileLabels()).toEqual(TEMPLATES.map((t) => t.label));
    expect(screen.getAllByText("1920 × 1080").length).toBeGreaterThan(1);
  });

  it.each(FRAME_SIZES.map((f, i) => [f.name, i] as const))("filters to the %s frame and points the blank canvas at it", (name, i) => {
    mount();
    fireEvent.click(screen.getByRole("radio", { name }));
    const expected = TEMPLATES.filter((t) => {
      const { width, height } = t.make().stage;
      return width === FRAME_SIZES[i].width && height === FRAME_SIZES[i].height;
    }).map((t) => t.label);
    expect(expected.length).toBeGreaterThan(0);
    expect(tileLabels()).toEqual(expected);
    expect(screen.getByRole("combobox", { name: "Frame size" })).toHaveValue(String(i));
    expect(screen.getByText(`${expected.length} ${expected.length === 1 ? "template" : "templates"}`)).toBeInTheDocument();
  });

  it("goes back to every template on All sizes without moving the blank canvas", () => {
    mount();
    fireEvent.click(screen.getByRole("radio", { name: "Site hero" }));
    fireEvent.click(screen.getByRole("radio", { name: "All sizes" }));
    expect(tileLabels()).toEqual(TEMPLATES.map((t) => t.label));
    expect(screen.getByRole("combobox", { name: "Frame size" })).toHaveValue("3");
  });

  it("moves between size chips with the arrow keys as one tab stop", () => {
    mount();
    const chips = screen.getAllByRole("radio");
    expect(chips.map((c) => c.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    fireEvent.keyDown(chips[0], { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Video" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Video" }).tabIndex).toBe(0);
    fireEvent.keyDown(screen.getByRole("radio", { name: "Video" }), { key: "ArrowLeft" });
    expect(screen.getByRole("radio", { name: "All sizes" })).toHaveAttribute("aria-checked", "true");
  });

  it("opens a fresh copy of a template and a blank canvas in the chosen frame", () => {
    const { onNewFromTemplate, onNewBlank } = mount();
    fireEvent.click(screen.getByRole("button", { name: /^Sale badge/ }));
    expect(onNewFromTemplate).toHaveBeenCalledTimes(1);
    expect(onNewFromTemplate.mock.calls[0][0].name).toBe("Sale badge");
    expect(onNewFromTemplate.mock.calls[0][1]).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Story / reel" }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(onNewBlank).toHaveBeenCalledWith(1080, 1920, null);
  });

  it("names a saved composition's tile after it, not after what its preview draws", () => {
    mount();
    expect(screen.getByRole("button", { name: "Open My piece" })).toBeInTheDocument();
  });
});

describe("GalleryDialog folders and import", () => {
  const projects = [filed("p1", "Mark", "f1"), filed("p2", "Deck", "f2"), filed("p3", "Loose", null)];

  it("shows every composition, then only a folder's, and new work lands in that folder", () => {
    const { onNewBlank, onNewFromTemplate } = mount({ projects, folders: FOLDERS });
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(3);
    fireEvent.click(screen.getByRole("radio", { name: "Logos" }));
    expect(screen.getAllByRole("button", { name: /^Open / }).map((b) => b.textContent)).toEqual(["Open Mark"]);
    expect(screen.getByRole("textbox", { name: "Folder name" })).toHaveValue("Logos");
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(onNewBlank).toHaveBeenLastCalledWith(1920, 1080, "f1");
    fireEvent.click(screen.getByRole("button", { name: /^Sale badge/ }));
    expect(onNewFromTemplate.mock.calls[0][1]).toBe("f1");
    fireEvent.click(screen.getByRole("radio", { name: "Unfiled" }));
    expect(screen.getAllByRole("button", { name: /^Open / }).map((b) => b.textContent)).toEqual(["Open Loose"]);
  });

  it("makes a folder from the name typed and jumps into it", () => {
    const { onAddFolder } = mount({ projects, folders: FOLDERS });
    fireEvent.click(screen.getByRole("button", { name: "New folder" }));
    const input = screen.getByRole("textbox", { name: "New folder name" });
    fireEvent.change(input, { target: { value: "Clients" } });
    fireEvent.submit(input.closest("form")!);
    expect(onAddFolder).toHaveBeenCalledTimes(1);
    expect(onAddFolder.mock.calls[0][1]).toBe("Clients");
  });

  it("renames and deletes the folder being looked at, after a confirmation", () => {
    const { onRenameFolder, onDeleteFolder } = mount({ projects, folders: FOLDERS });
    fireEvent.click(screen.getByRole("radio", { name: "Pitches" }));
    const name = screen.getByRole("textbox", { name: "Folder name" });
    fireEvent.change(name, { target: { value: "Investor pitches" } });
    fireEvent.blur(name);
    expect(onRenameFolder).toHaveBeenCalledWith("f2", "Investor pitches");
    fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));
    expect(onDeleteFolder).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));
    expect(onDeleteFolder).toHaveBeenCalledWith("f2");
  });

  it("files a composition from its tile", () => {
    const { onMoveProject } = mount({ projects, folders: FOLDERS });
    const select = screen.getByRole("combobox", { name: "Folder of Loose" });
    expect(select).toHaveValue("");
    fireEvent.change(select, { target: { value: "f1" } });
    expect(onMoveProject).toHaveBeenCalledWith("p3", "f1");
    fireEvent.change(screen.getByRole("combobox", { name: "Folder of Mark" }), { target: { value: "" } });
    expect(onMoveProject).toHaveBeenCalledWith("p1", null);
  });

  it("hides the folder controls on tiles until there is a folder", () => {
    mount();
    expect(screen.queryByRole("combobox", { name: /^Folder of/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "All" })).not.toBeInTheDocument();
  });

  it("imports the JSON files chosen or dropped into the folder being looked at", () => {
    const { onImportFiles } = mount({ projects, folders: FOLDERS });
    fireEvent.click(screen.getByRole("radio", { name: "Logos" }));
    const json = new File(["{}"], "mark.studio.json", { type: "application/json" });
    const png = new File([""], "mark.png", { type: "image/png" });
    const section = screen.getByRole("region", { name: /Your compositions/ });
    fireEvent.drop(section, { dataTransfer: { files: [json, png], items: [{ kind: "file" }] } });
    expect(onImportFiles).toHaveBeenCalledWith([json], "f1");
    const input = document.querySelector<HTMLInputElement>("input[type=file][accept='.json,application/json']")!;
    fireEvent.change(input, { target: { files: [json] } });
    expect(onImportFiles).toHaveBeenLastCalledWith([json], "f1");
    expect(onImportFiles).toHaveBeenCalledTimes(2);
  });
});
