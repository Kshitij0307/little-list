// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  TasksProvider,
  useTaskContext,
} from "../src/features/tasks/hooks/tasks-provider";
import { createTaskSchema, makeTask } from "../src/features/tasks/domain/task";

import { TaskDetail } from "../src/features/tasks/components/task-detail";
import { SubtaskSection } from "../src/features/tasks/components/subtask-section";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const gateway = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
vi.mock("../src/features/tasks/client/task-gateway", () => ({
  createGateway: () => gateway,
}));
const task = makeTask(
  createTaskSchema.parse({
    id: "be7f3440-3868-4e48-90fb-f2e8dbce5b26",
    title: "Read a chapter",
  }),
);
function Page() {
  const {
    tasks,
    loading,
    error,
    update,
    undoAction,
    undo,
    create,
    listFilters,
    setListFilters,
  } = useTaskContext();
  return (
    <>
      <span>{loading ? "Loading" : (tasks[0]?.title ?? "Empty")}</span>
      <span>{error}</span>
      <span>{undoAction?.label}</span>
      <span>Filter: {listFilters.query}</span>
      <button onClick={() => void update(task.id, { title: "Edited title" })}>
        Edit
      </button>
      <button onClick={() => void undo()}>Undo</button>
      <button onClick={() => void create("New task")}>Create</button>
      <button
        onClick={() =>
          setListFilters((filters) => ({ ...filters, query: "chapter" }))
        }
      >
        Filter
      </button>
    </>
  );
}
function Notebook() {
  const [page, setPage] = useState(0);
  return (
    <TasksProvider mode="local">
      <button onClick={() => setPage((current) => current + 1)}>
        Navigate
      </button>
      <Page key={page} />
    </TasksProvider>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  gateway.list.mockResolvedValue([task]);
});
afterEach(cleanup);

it("keeps subtask counts and sorted status rows scoped to the current parent", async () => {
  const child = {
    ...task,
    id: "d2e80888-53ec-419d-aea0-54beb67d77b3",
    parent_id: task.id,
    title: "Plain step",
  };
  const starred = {
    ...child,
    id: crypto.randomUUID(),
    title: "Starred step",
    starred: true,
  };
  const done = {
    ...child,
    id: crypto.randomUUID(),
    title: "Finished step",
    status: "done" as const,
  };
  const deleted = {
    ...child,
    id: crypto.randomUUID(),
    title: "Deleted step",
    deleted_at: new Date().toISOString(),
  };
  const unrelated = {
    ...child,
    id: crypto.randomUUID(),
    parent_id: null,
    title: "Unrelated task",
  };
  gateway.list.mockResolvedValue([
    task,
    child,
    starred,
    done,
    deleted,
    unrelated,
  ]);
  render(
    <TasksProvider mode="local">
      <SubtaskSection taskId={task.id} onOpenTask={vi.fn()} />
    </TasksProvider>,
  );
  await screen.findByRole("tab", { name: "Todo 2" });
  expect(screen.getByText("1/3 done")).toBeTruthy();
  const panel = screen.getByRole("tabpanel");
  const rows = within(panel).getAllByRole("listitem");
  expect(rows[0].textContent).toContain("Starred step");
  expect(rows[1].textContent).toContain("Plain step");
  expect(within(panel).queryByText("Deleted step")).toBeNull();
  expect(within(panel).queryByText("Unrelated task")).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Done 1" }));
  expect(within(panel).getAllByRole("listitem")).toHaveLength(1);
  expect(within(panel).getByText("Finished step")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "In progress 0" }));
  expect(within(panel).getByText("No in progress subtasks.")).toBeTruthy();
});

describe("persistent notebook state", () => {
  it("preserves tasks, filters and undo while route content remounts without reloading", async () => {
    gateway.update
      .mockResolvedValueOnce({ ...task, title: "Edited title" })
      .mockResolvedValueOnce(task);
    render(<Notebook />);
    await screen.findByText(task.title);
    fireEvent.click(screen.getByText("Filter"));
    fireEvent.click(screen.getByText("Edit"));
    await screen.findByText("Task updated");
    fireEvent.click(screen.getByText("Navigate"));
    expect(screen.getByText("Edited title")).toBeTruthy();
    expect(screen.getByText("Filter: chapter")).toBeTruthy();
    expect(gateway.list).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText("Undo"));
    await screen.findByText(task.title);
    expect(gateway.update).toHaveBeenLastCalledWith(task.id, {
      title: task.title,
    });
    expect(screen.queryByText("Task updated")).toBeNull();
  });

  it("rolls back failed saves and keeps the previous undo available", async () => {
    gateway.update
      .mockResolvedValueOnce({ ...task, title: "Edited title" })
      .mockRejectedValueOnce(new Error("Save failed"));
    render(<Notebook />);
    await screen.findByText(task.title);
    fireEvent.click(screen.getByText("Edit"));
    await screen.findByText("Task updated");
    fireEvent.click(screen.getByText("Undo"));
    await screen.findByText("Save failed");
    expect(screen.getByText("Edited title")).toBeTruthy();
    expect(screen.getByText("Task updated")).toBeTruthy();
  });

  it("rejects overlapping writes until the current save settles", async () => {
    let finish!: (value: typeof task) => void;
    gateway.update.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<Notebook />);
    await screen.findByText(task.title);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Create"));
    expect(gateway.create).not.toHaveBeenCalled();
    finish({ ...task, title: "Edited title" });
    await waitFor(() => expect(screen.getByText("Task updated")).toBeTruthy());
  });
});

describe("task route load failures", () => {
  it("shows a retryable load error rather than claiming that an unloaded task is missing", async () => {
    gateway.list.mockRejectedValueOnce(new Error("Notebook unavailable"));
    render(
      <TasksProvider mode="local">
        <TaskDetail taskId={task.id} />
      </TasksProvider>,
    );
    await screen.findByText("Your task could not be loaded.");
    expect(screen.queryByText("This task could not be found.")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(
      "Notebook unavailable",
    );
    gateway.list.mockResolvedValue([task]);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("heading", { name: task.title });
  });

  it("shows not-found only after a successful list load", async () => {
    gateway.list.mockResolvedValue([]);
    render(
      <TasksProvider mode="local">
        <TaskDetail taskId={task.id} />
      </TasksProvider>,
    );
    await screen.findByText("This task could not be found.");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

it("starts a separate local draft when navigating to a different task", async () => {
  const second = {
    ...task,
    id: "d2e80888-53ec-419d-aea0-54beb67d77b3",
    title: "Another task",
  };
  gateway.list.mockResolvedValue([task, second]);
  const view = render(
    <TasksProvider mode="local">
      <TaskDetail taskId={task.id} />
    </TasksProvider>,
  );
  await screen.findByRole("heading", { name: task.title });
  fireEvent.change(screen.getByLabelText("Task"), {
    target: { value: "Unsaved first draft" },
  });
  view.rerender(
    <TasksProvider mode="local">
      <TaskDetail taskId={second.id} />
    </TasksProvider>,
  );
  expect((screen.getByLabelText("Task") as HTMLInputElement).value).toBe(
    second.title,
  );
  expect(screen.getAllByRole("button", { name: "Save changes" })).toHaveLength(
    1,
  );
});
