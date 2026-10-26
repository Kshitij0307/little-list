// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  act,
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
  vi.useRealTimers();
});

function returnToTab() {
  const visibility = vi.spyOn(document, "visibilityState", "get");
  visibility.mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
}

it("keeps task navigation available during a window-focus session check", async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const openTask = vi.fn();
  render(
    <SessionBoundary userId="owner-a">
      <button onClick={openTask}>Open task</button>
    </SessionBoundary>,
  );

  // The browser focuses the window before dispatching the click on a task.
  fireEvent.focus(window);
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open task" }));
  expect(openTask).toHaveBeenCalledOnce();
  await act(async () => finish(Response.json({ userId: "owner-a" })));
  expect(screen.getByRole("button", { name: "Open task" })).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
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
  returnToTab();
  expect(screen.getByRole("status").textContent).toContain(
    "A moment for your notebook.",
  );
  expect(notebook.hidden).toBe(true);
  expect(request).toHaveBeenCalledWith("/api/auth/session", {
    cache: "no-store",
    signal: expect.any(AbortSignal),
  });
  finish(Response.json({ userId: "owner-a" }));
  await waitFor(() => expect(notebook.hidden).toBe(false));
  expect(screen.queryByRole("status")).toBeNull();
});

it.each(["offline", "unavailable", "invalid-response"])(
  "keeps private content hidden and allows retry after %s",
  async (failure) => {
    const request = vi.fn();
    if (failure === "offline")
      request.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    else if (failure === "unavailable")
      request.mockResolvedValueOnce(
        Response.json({ error: "Unavailable" }, { status: 503 }),
      );
    else request.mockResolvedValueOnce(Response.json({ unexpected: true }));
    request.mockResolvedValue(Response.json({ userId: "owner-a" }));
    vi.stubGlobal("fetch", request);
    render(
      <SessionBoundary userId="owner-a">
        <input aria-label="Draft" defaultValue="Unsaved task" />
      </SessionBoundary>,
    );
    const draft = screen.getByLabelText("Draft");
    fireEvent.change(draft, { target: { value: "Keep this draft" } });
    returnToTab();
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(draft.parentElement!.hidden).toBe(true);
    fireEvent.click(retry);
    await waitFor(() => expect(draft.parentElement!.hidden).toBe(false));
    expect(screen.getByLabelText("Draft")).toBe(draft);
    expect((draft as HTMLInputElement).value).toBe("Keep this draft");
  },
);

it("offers retry for a stalled check and does not start overlapping checks", async () => {
  vi.useFakeTimers();
  const request = vi.fn(
    (_url: string, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options.signal!.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  );
  vi.stubGlobal("fetch", request);
  render(
    <SessionBoundary userId="owner-a">
      <p>Private task content</p>
    </SessionBoundary>,
  );
  returnToTab();
  fireEvent.focus(window);
  expect(request).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(10_000));
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  expect(screen.getByText("Private task content").parentElement!.hidden).toBe(
    true,
  );
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

it("masks a notebook restored from the browser back-forward cache until verification finishes", async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  render(
    <SessionBoundary userId="owner-a">
      <p>Private task content</p>
    </SessionBoundary>,
  );
  const notebook = screen.getByText("Private task content").parentElement!;
  fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
  expect(notebook.hidden).toBe(true);
  finish(Response.json({ userId: "owner-a" }));
  await waitFor(() => expect(notebook.hidden).toBe(false));
});
