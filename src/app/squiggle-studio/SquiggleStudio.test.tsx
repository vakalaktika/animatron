// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { SquiggleStudio } from "./SquiggleStudio";

vi.mock("next/navigation", () => ({
  usePathname: () => "/squiggle",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("SquiggleStudio", () => {
  it("mounts the controls and canvas with an empty starting state", () => {
    render(<SquiggleStudio />);

    // App bar chrome + a preset are present.
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cool" })).toBeInTheDocument();

    // The empty-canvas hint shows until something is drawn.
    expect(screen.getByText("Draw a squiggle here")).toBeInTheDocument();

    // Global actions start disabled because there are no strokes yet.
    expect(screen.getByRole("button", { name: "Export all SVGs" })).toBeDisabled();

    // The default rainbow seeds three colour swatches (the minimum).
    expect(screen.getAllByLabelText(/^Colour \d$/)).toHaveLength(3);
  });
});
