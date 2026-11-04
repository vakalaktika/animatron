// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountStrip, type AccountControls } from "./AccountStrip";

const controls = (over: Partial<AccountControls> = {}): AccountControls => ({
  enabled: true,
  user: { kind: "none" },
  pendingEmail: null,
  syncing: false,
  onSendLink: vi.fn(async () => {}),
  onSignOut: vi.fn(),
  onSync: vi.fn(),
  ...over,
});

describe("AccountStrip", () => {
  test("shows nothing when the cloud isn't set up", () => {
    const { container } = render(<AccountStrip {...controls({ enabled: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("signed out: emails a sign-in link", async () => {
    const c = controls();
    render(<AccountStrip {...c} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "ed@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    await waitFor(() => expect(c.onSendLink).toHaveBeenCalledWith("ed@example.com"));
  });

  test("a failed send is announced", async () => {
    render(<AccountStrip {...controls({ onSendLink: async () => Promise.reject(new Error("Email rate limit exceeded")) })} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "ed@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email rate limit exceeded");
  });

  test("after sending, says where the link went", () => {
    render(<AccountStrip {...controls({ pendingEmail: "ed@example.com" })} />);
    expect(screen.getByText(/We sent a sign-in link to ed@example.com/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send another link" })).toBeInTheDocument();
  });

  test("an anonymous session (from making a link) still reads as signed out", () => {
    render(<AccountStrip {...controls({ user: { kind: "anonymous", id: "u" } })} />);
    expect(screen.getByRole("heading", { name: "Keep your compositions in an account" })).toBeInTheDocument();
  });

  test("signed in: names the account, syncs and signs out", () => {
    const c = controls({ user: { kind: "account", id: "u", email: "ed@example.com" } });
    render(<AccountStrip {...c} />);
    expect(screen.getByRole("region", { name: "Your account" })).toHaveTextContent("ed@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(c.onSync).toHaveBeenCalled();
    expect(c.onSignOut).toHaveBeenCalled();
  });
});
