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

function mount() {
  const onNewBlank = vi.fn();
  const onNewFromTemplate = vi.fn();
  const project = { id: "p1", doc: { ...welcomePreset(), name: "My piece" }, updatedAt: new Date().toISOString() };
  const utils = render(
    <GalleryDialog
      open
      onClose={() => {}}
      projects={[project]}
      currentId="p1"
      onOpenProject={() => {}}
      onNewFromTemplate={onNewFromTemplate}
      onNewBlank={onNewBlank}
      onDuplicateProject={() => {}}
      onDeleteProject={() => {}}
      onRenameProject={() => {}}
      account={{ enabled: false, user: { kind: "none" }, pendingEmail: null, syncing: false, onSendLink: async () => {}, onSignOut: () => {}, onSync: () => {} }}
    />,
  );
  return { ...utils, onNewBlank, onNewFromTemplate };
}

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
    fireEvent.click(screen.getByRole("radio", { name: "Story / reel" }));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(onNewBlank).toHaveBeenCalledWith(1080, 1920);
  });

  it("names a saved composition's tile after it, not after what its preview draws", () => {
    mount();
    expect(screen.getByRole("button", { name: "Open My piece" })).toBeInTheDocument();
  });
});
