// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SessionBoundary } from "../src/features/auth/components/session-boundary";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("hides the notebook while revalidating the account after returning to a tab", async () => {
  let finish!: (response: Response) => void;
  const request = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("fetch", request);
  render(
    <SessionBoundary userId="owner-a">
      <p>Private task content</p>
    </SessionBoundary>,
  );
  const notebook = screen.getByText("Private task content").parentElement!;
  expect(notebook.hidden).toBe(false);
  fireEvent.focus(window);
  expect(screen.getByRole("status").textContent).toBe("Checking your session…");
  expect(notebook.hidden).toBe(true);
  expect(request).toHaveBeenCalledWith("/api/auth/session", {
    cache: "no-store",
  });
  finish(Response.json({ userId: "owner-a" }));
  await waitFor(() => expect(notebook.hidden).toBe(false));
  expect(screen.queryByRole("status")).toBeNull();
});

it("removes session listeners when the notebook unmounts", () => {
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  const view = render(
    <SessionBoundary userId="owner-a">
      <p>Private task content</p>
    </SessionBoundary>,
  );
  view.unmount();
  fireEvent.focus(window);
  expect(request).not.toHaveBeenCalled();
});
