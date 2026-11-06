// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  UnsavedChangesProvider,
  useGuardedNavigation,
  useUnsavedChangesGuard,
} from "../src/components/unsaved-changes-provider";
import { TaskForm } from "../src/features/tasks/components/task-form";
import { createTaskSchema, makeTask } from "../src/features/tasks/domain/task";

const task = makeTask(
  createTaskSchema.parse({
    id: "be7f3440-3868-4e48-90fb-f2e8dbce5b26",
    title: "Read a chapter",
  }),
);

function NavigationHarness({ action }: { action: () => void }) {
  const [dirty, setDirty] = useState(true);
  const navigate = useGuardedNavigation();
  useUnsavedChangesGuard(dirty);
  return (
    <>
      <button onClick={() => navigate(action)}>Open another task</button>
      <button onClick={() => setDirty(false)}>Revert changes</button>
      <a href="/other">Notebook link</a>
      <a href="/other" target="_blank">
        Open in new tab
      </a>
    </>
  );
}

function NavigationButton({ action }: { action: () => void }) {
  const navigate = useGuardedNavigation();
  return <button onClick={() => navigate(action)}>Open another task</button>;
}

beforeEach(() => {
  window.history.replaceState({}, "", "/tasks/current");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("blocks in-app navigation until discarding is confirmed", () => {
  const action = vi.fn();
  render(
    <UnsavedChangesProvider>
      <NavigationHarness action={action} />
    </UnsavedChangesProvider>,
  );

  fireEvent.click(screen.getByText("Open another task"));
  expect(
    screen.getByRole("alertdialog", { name: "Leave without saving?" }),
  ).toBeTruthy();
  expect(action).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();

  fireEvent.click(screen.getByText("Open another task"));
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(action).toHaveBeenCalledOnce();
});

it("guards same-window links but leaves new tabs and reverted drafts alone", () => {
  const action = vi.fn();
  render(
    <UnsavedChangesProvider>
      <NavigationHarness action={action} />
    </UnsavedChangesProvider>,
  );

  fireEvent.click(screen.getByText("Open in new tab"));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  fireEvent.click(screen.getByText("Notebook link"));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

  fireEvent.click(screen.getByText("Revert changes"));
  fireEvent.click(screen.getByText("Open another task"));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(action).toHaveBeenCalledOnce();
});

it("clears its navigation guard after reverting or saving", async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  const action = vi.fn();
  render(
    <UnsavedChangesProvider>
      <TaskForm task={task} busy={false} onSave={onSave} />
      <NavigationButton action={action} />
    </UnsavedChangesProvider>,
  );

  const title = screen.getByLabelText("Task");
  fireEvent.change(title, { target: { value: "An edited chapter" } });
  fireEvent.click(screen.getByText("Open another task"));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  const unload = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(false);

  fireEvent.change(title, { target: { value: task.title } });
  fireEvent.click(screen.getByText("Open another task"));
  expect(action).toHaveBeenCalledOnce();

  fireEvent.change(title, { target: { value: "A saved chapter" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Save changes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true),
  );
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

it("keeps failed saves protected and restores cancelled browser history", async () => {
  const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
  const onSave = vi.fn().mockResolvedValue(false);
  render(
    <UnsavedChangesProvider>
      <TaskForm task={task} busy={false} onSave={onSave} />
    </UnsavedChangesProvider>,
  );

  fireEvent.change(screen.getByLabelText("Task"), {
    target: { value: "Unsaved after failure" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  const previousState = window.history.state;
  window.history.pushState({}, "", "/tasks/next");
  const nextState = window.history.state;
  fireEvent(window, new PopStateEvent("popstate", { state: previousState }));

  expect(go).toHaveBeenCalledWith(1);
  fireEvent(window, new PopStateEvent("popstate", { state: nextState }));
  expect(
    screen.getByRole("alertdialog", { name: "Leave without saving?" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(go).toHaveBeenCalledOnce();
});
