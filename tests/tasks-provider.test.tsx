// @vitest-environment jsdom
import { useEffect, useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  act,
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
import { TaskListView } from "../src/features/tasks/components/task-list-view";
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

const gateway = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  move: vi.fn(),
  remove: vi.fn(),
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
  gateway.list.mockResolvedValue({ userId: null, tasks: [task] });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("includes the requested task in server-rendered HTML", () => {
  const html = renderToString(
    <TasksProvider
      mode="cloud"
      userId="owner-a"
      initialState={{ tasks: [task] }}
    >
      <TaskDetail taskId={task.id} />
    </TasksProvider>,
  );
  expect(html).toContain(task.title);
  expect(html).toContain("Save changes");
  expect(html).not.toContain("Picking up where you left off");
  expect(gateway.list).not.toHaveBeenCalled();
});

it("moves an open subtask to the main list from its detail form", async () => {
  const child = {
    ...task,
    id: "d2e80888-53ec-419d-aea0-54beb67d77b3",
    parent_id: task.id,
    title: "A smaller step",
  };
  gateway.update.mockResolvedValue({ ...child, parent_id: null });
  render(
    <TasksProvider
      mode="cloud"
      userId="owner-a"
      initialState={{ tasks: [task, child] }}
    >
      <TaskDetail taskId={child.id} />
    </TasksProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Move to main list" }));

  await waitFor(() =>
    expect(gateway.update).toHaveBeenCalledWith(child.id, { parent_id: null }),
  );
  expect(
    screen.queryByRole("button", { name: "Move to main list" }),
  ).toBeNull();
  expect(screen.getByRole("heading", { name: child.title })).toBeTruthy();
});

it("uses server tasks immediately without a mount fetch and supports editing and undo", async () => {
  gateway.update
    .mockResolvedValueOnce({ ...task, title: "Edited title" })
    .mockResolvedValueOnce(task);
  render(
    <TasksProvider
      mode="cloud"
      userId="owner-a"
      initialState={{ tasks: [task] }}
    >
      <Page />
    </TasksProvider>,
  );
  expect(screen.getByText(task.title)).toBeTruthy();
  expect(screen.queryByText("Loading")).toBeNull();
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(gateway.list).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Edit"));
  await screen.findByText("Edited title");
  fireEvent.click(screen.getByText("Undo"));
  await screen.findByText(task.title);
  expect(gateway.update).toHaveBeenCalledTimes(2);
});

it("shows a server load error with a working client retry", async () => {
  gateway.list.mockResolvedValue({ userId: "owner-a", tasks: [task] });
  render(
    <TasksProvider
      mode="cloud"
      userId="owner-a"
      initialState={{ error: "Unable to load tasks." }}
    >
      <TaskDetail taskId={task.id} />
    </TasksProvider>,
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "Unable to load tasks.",
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(gateway.list).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("heading", { name: task.title });
  expect(gateway.list).toHaveBeenCalledOnce();
});

it("renders an empty server notebook immediately and refreshes it on return", async () => {
  gateway.list.mockResolvedValue({ userId: "owner-a", tasks: [task] });
  render(
    <TasksProvider mode="cloud" userId="owner-a" initialState={{ tasks: [] }}>
      <Page />
    </TasksProvider>,
  );
  expect(screen.getByText("Empty")).toBeTruthy();
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(gateway.list).not.toHaveBeenCalled();
  const now = vi.spyOn(Date, "now");
  now.mockReturnValue(Date.now() + 1_100);
  fireEvent.focus(window);
  await screen.findByText(task.title);
  expect(gateway.list).toHaveBeenCalledOnce();
});

it("opens a task while a background refresh is pending", async () => {
  let finish!: (result: { userId: null; tasks: (typeof task)[] }) => void;
  gateway.list
    .mockResolvedValueOnce({ userId: null, tasks: [task] })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  function RoutedNotebook() {
    const [taskId, setTaskId] = useState<string | null>(null);
    useEffect(() => {
      navigation.push.mockImplementation((path: string) =>
        setTaskId(path.slice("/tasks/".length)),
      );
    }, []);
    return (
      <TasksProvider mode="local">
        {taskId ? <TaskDetail taskId={taskId} /> : <TaskListView />}
      </TasksProvider>
    );
  }
  render(<RoutedNotebook />);
  await screen.findByRole("button", { name: `Edit ${task.title}` });
  const now = vi.spyOn(Date, "now");
  now.mockReturnValue(Date.now() + 1_100);
  fireEvent.focus(window);
  fireEvent.click(screen.getByRole("button", { name: `Edit ${task.title}` }));
  expect(navigation.push).toHaveBeenCalledWith(`/tasks/${task.id}`);
  expect(screen.getByRole("heading", { name: task.title })).toBeTruthy();
  await act(async () => finish({ userId: null, tasks: [task] }));
  expect(screen.getByRole("heading", { name: task.title })).toBeTruthy();
  expect(screen.queryByPlaceholderText("What’s on your mind?")).toBeNull();
});

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
  gateway.list.mockResolvedValue({
    userId: null,
    tasks: [task, child, starred, done, deleted, unrelated],
  });
  render(
    <TasksProvider mode="local">
      <SubtaskSection taskId={task.id} onOpenTask={vi.fn()} />
    </TasksProvider>,
  );
  await screen.findByRole("tab", { name: "Todo 2" });
  const addButtons = screen.getAllByRole("button", { name: "Add" });
  expect(
    screen
      .getByLabelText("Add a smaller step as its subtask")
      .parentElement?.contains(addButtons[0]),
  ).toBe(true);
  expect(
    screen
      .getByLabelText("Add an existing main-list task as its subtask")
      .parentElement?.contains(addButtons[1]),
  ).toBe(true);
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
    expect(screen.queryByText("A page out of place.")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(
      "Notebook unavailable",
    );
    gateway.list.mockResolvedValue({ userId: null, tasks: [task] });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("heading", { name: task.title });
  });

  it("shows not-found only after a successful list load", async () => {
    gateway.list.mockResolvedValue({ userId: null, tasks: [] });
    render(
      <TasksProvider mode="local">
        <TaskDetail taskId={task.id} />
      </TasksProvider>,
    );
    await screen.findByText("A page out of place.");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

it("shows skeletons without false zero counts during first load and retains tasks during background refresh", async () => {
  let finish!: (result: { userId: null; tasks: (typeof task)[] }) => void;
  gateway.list.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <TasksProvider mode="local">
      <TaskListView />
    </TasksProvider>,
  );
  expect(screen.getByRole("status", { name: "Loading tasks" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Todo" })).toBeTruthy();
  expect(
    screen.queryByText("Good things start with a little list."),
  ).toBeNull();
  await waitFor(() => expect(gateway.list).toHaveBeenCalledOnce());
  await act(async () => finish({ userId: null, tasks: [task] }));
  expect(screen.getByText(task.title)).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Todo 1" })).toBeTruthy();
  const now = vi.spyOn(Date, "now");
  now.mockReturnValue(Date.now() + 1_100);
  fireEvent.focus(window);
  fireEvent(document, new Event("visibilitychange"));
  expect(gateway.list).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("status", { name: "Loading tasks" })).toBeNull();
  expect(screen.getByText(task.title)).toBeTruthy();
  await act(async () => finish({ userId: null, tasks: [task] }));
});

it("clears the previous account's tasks when a refresh belongs to another account", async () => {
  const replace = vi.fn();
  vi.stubGlobal("location", { replace });
  gateway.list
    .mockResolvedValueOnce({ userId: "owner-a", tasks: [task] })
    .mockResolvedValueOnce({
      userId: "owner-b",
      tasks: [{ ...task, title: "Another account's task" }],
    });
  render(
    <TasksProvider mode="cloud" userId="owner-a">
      <Page />
    </TasksProvider>,
  );
  await screen.findByText(task.title);
  const now = vi.spyOn(Date, "now");
  now.mockReturnValue(Date.now() + 1_100);
  fireEvent.focus(window);
  fireEvent(document, new Event("visibilitychange"));
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  expect(gateway.list).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(task.title)).toBeNull();
  expect(screen.queryByText("Another account's task")).toBeNull();
});

it("refreshes a restored page once and keeps existing tasks available if the network fails", async () => {
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  gateway.list
    .mockResolvedValueOnce({ userId: "owner-a", tasks: [task] })
    .mockRejectedValueOnce(new Error("Connection unavailable"));
  render(
    <TasksProvider mode="cloud" userId="owner-a">
      <Page />
    </TasksProvider>,
  );
  await screen.findByText(task.title);
  const now = vi.spyOn(Date, "now");
  now.mockReturnValue(Date.now() + 1_100);
  fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
  await screen.findByText("Connection unavailable");
  // Even a later focus event from the same return must not repeat a completed request.
  fireEvent.focus(window);
  expect(gateway.list).toHaveBeenCalledTimes(2);
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByText(task.title)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
});

it("clears search without losing keyboard focus and restores the task list", async () => {
  render(
    <TasksProvider mode="local">
      <TaskListView />
    </TasksProvider>,
  );
  await screen.findByRole("button", { name: `Edit ${task.title}` });
  const search = screen.getByRole("textbox", { name: "Search tasks" });
  fireEvent.change(search, { target: { value: "No matching task" } });
  expect(
    screen.queryByRole("button", { name: `Edit ${task.title}` }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect((search as HTMLInputElement).value).toBe("");
  expect(document.activeElement).toBe(search);
  expect(
    screen.getByRole("button", { name: `Edit ${task.title}` }),
  ).toBeTruthy();
});

it("starts a separate local draft when navigating to a different task", async () => {
  const second = {
    ...task,
    id: "d2e80888-53ec-419d-aea0-54beb67d77b3",
    title: "Another task",
  };
  gateway.list.mockResolvedValue({ userId: null, tasks: [task, second] });
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
