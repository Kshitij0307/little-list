// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  TasksProvider,
  useTaskContext,
} from "../src/features/tasks/hooks/tasks-provider";
import { TaskListView } from "../src/features/tasks/components/task-list-view";
import { SubtaskSection } from "../src/features/tasks/components/subtask-section";
import { createTaskSchema, makeTask } from "../src/features/tasks/domain/task";
import type {
  TaskMove,
  TaskDeletion,
} from "../src/features/tasks/domain/task-batch";
import { applyTaskDeletion } from "../src/features/tasks/domain/task-batch";
import { TaskDetail } from "../src/features/tasks/components/task-detail";

const gateway = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  move: vi.fn(),
  remove: vi.fn(),
  reorder: vi.fn(),
}));
vi.mock("../src/features/tasks/client/task-gateway", () => ({
  createGateway: () => gateway,
}));
const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
const first = makeTask(
  createTaskSchema.parse({
    id: "be7f3440-3868-4e48-90fb-f2e8dbce5b26",
    title: "First",
  }),
);
const second = {
  ...first,
  id: "d2e80888-53ec-419d-aea0-54beb67d77b3",
  title: "Second",
};
const progress = {
  ...first,
  id: "e595cb27-c6f2-4f01-81dd-c17c0d0b650e",
  title: "Other tab",
  status: "in_progress" as const,
};

function UndoControl() {
  const { undo, undoAction } = useTaskContext();
  return (
    <button disabled={!undoAction} onClick={() => void undo()}>
      Undo batch
    </button>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/");
});
afterEach(cleanup);

it("restores the selected status tab from the URL and preserves other parameters", () => {
  const finished = {
    ...first,
    id: "08f11c15-0d3c-47c2-98c4-6ea2ae266ada",
    title: "Finished task",
    status: "done" as const,
  };
  window.history.replaceState(null, "", "/?status=done&view=compact");

  render(
    <TasksProvider
      mode="cloud"
      userId="owner"
      initialState={{ tasks: [first, progress, finished] }}
    >
      <TaskListView />
    </TasksProvider>,
  );

  expect(
    screen.getByRole("tab", { name: "Done 1" }).getAttribute("aria-selected"),
  ).toBe("true");
  expect(screen.getByText("Finished task")).toBeTruthy();

  fireEvent.click(screen.getByRole("tab", { name: "In progress 1" }));
  expect(window.location.search).toBe("?status=in_progress&view=compact");
  expect(screen.getByText("Other tab")).toBeTruthy();

  fireEvent.click(screen.getByRole("tab", { name: "Todo 1" }));
  expect(window.location.search).toBe("?view=compact");
});

it("restores the focus filter from the URL and preserves it across status changes", () => {
  const focusedTodo = { ...first, focus_today: true };
  const focusedProgress = { ...progress, focus_today: true };
  window.history.replaceState(
    null,
    "",
    "/?status=in_progress&focus=true&view=compact",
  );

  render(
    <TasksProvider
      mode="cloud"
      userId="owner"
      initialState={{ tasks: [focusedTodo, focusedProgress, second] }}
    >
      <TaskListView />
    </TasksProvider>,
  );

  const focus = screen.getByRole("button", { name: "Focus today" });
  expect(focus.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Other tab")).toBeTruthy();

  fireEvent.click(screen.getByRole("tab", { name: "Todo 2" }));
  expect(window.location.search).toBe("?focus=true&view=compact");
  expect(screen.getByText("First")).toBeTruthy();
  expect(screen.queryByText("Second")).toBeNull();

  fireEvent.click(focus);
  expect(window.location.search).toBe("?view=compact");
  expect(screen.getByText("Second")).toBeTruthy();

  fireEvent.click(focus);
  expect(window.location.search).toBe("?view=compact&focus=true");
});

it("restores the selected subtask tab from the task route status parameter", () => {
  const child = { ...first, parent_id: progress.id };
  const finishedChild = {
    ...child,
    id: "29d81585-7d1d-4a29-b441-8ae084e1868c",
    title: "Finished subtask",
    status: "done" as const,
  };
  window.history.replaceState(
    null,
    "",
    "/tasks/parent?status=done&view=compact",
  );

  render(
    <TasksProvider
      mode="cloud"
      userId="owner"
      initialState={{ tasks: [progress, child, finishedChild] }}
    >
      <SubtaskSection taskId={progress.id} onOpenTask={vi.fn()} />
    </TasksProvider>,
  );

  expect(
    screen.getByRole("tab", { name: "Done 1" }).getAttribute("aria-selected"),
  ).toBe("true");
  expect(screen.getByText("Finished subtask")).toBeTruthy();

  fireEvent.click(screen.getByRole("tab", { name: "Todo 1" }));
  expect(window.location.search).toBe("?view=compact");
  expect(screen.getByText("First")).toBeTruthy();
});

it("reorders from task content with Alt+Arrow and shows no drag handle", async () => {
  gateway.reorder.mockResolvedValue({ ...first, rank: "zzzzzzzzzzzy" });
  render(
    <TasksProvider
      mode="cloud"
      userId="owner"
      initialState={{ tasks: [first, second] }}
    >
      <TaskListView />
    </TasksProvider>,
  );
  expect(
    screen.queryByRole("button", { name: /drag or use arrow keys/i }),
  ).toBeNull();
  const body = screen.getByRole("button", { name: "Edit First" });
  expect(body.getAttribute("aria-keyshortcuts")).toBe(
    "Alt+ArrowUp Alt+ArrowDown",
  );
  fireEvent.keyDown(body, { key: "ArrowDown", altKey: true });
  await waitFor(() => expect(gateway.reorder).toHaveBeenCalledOnce());
  expect(gateway.reorder).toHaveBeenCalledWith({
    id: first.id,
    before_id: second.id,
    after_id: null,
    status: "todo",
    parent_id: null,
    pinned: false,
  });
});

it("requires a touch hold, lifts the task, and suppresses opening after release", () => {
  vi.useFakeTimers();
  try {
    class TestPointerEvent extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.pointerType = init.pointerType ?? "";
      }
    }
    vi.stubGlobal("PointerEvent", TestPointerEvent);
    render(
      <TasksProvider
        mode="cloud"
        userId="owner"
        initialState={{ tasks: [first, second] }}
      >
        <TaskListView />
      </TasksProvider>,
    );
    const body = screen.getByRole("button", { name: "Edit First" });
    Object.assign(body, { setPointerCapture: vi.fn() });
    const row = body.closest("[data-task-row]")!;
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
      top: 50,
      height: 100,
    } as DOMRect);
    const secondRow = screen
      .getByRole("button", { name: "Edit Second" })
      .closest("[data-task-row]")!;
    vi.spyOn(secondRow, "getBoundingClientRect").mockReturnValue({
      top: 100,
      height: 100,
    } as DOMRect);
    fireEvent.pointerDown(body, {
      button: 0,
      pointerId: 7,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
    });
    expect(row.getAttribute("data-dragging")).toBeNull();
    expect(document.documentElement.classList.contains("task-drag-lock")).toBe(
      true,
    );
    act(() => vi.advanceTimersByTime(360));
    expect(row.getAttribute("data-dragging")).toBe("true");
    fireEvent.pointerMove(body, {
      pointerId: 7,
      pointerType: "touch",
      clientX: 100,
      clientY: 180,
    });
    expect((row as HTMLElement).style.getPropertyValue("--drag-offset-y")).toBe(
      "80px",
    );
    expect(
      screen
        .getByRole("button", { name: "Edit Second" })
        .closest("[data-task-row]")
        ?.getAttribute("data-shift"),
    ).toBe("up");
    fireEvent.pointerUp(body, { pointerId: 7, pointerType: "touch" });
    expect(document.documentElement.classList.contains("task-drag-lock")).toBe(
      false,
    );
    fireEvent.click(body);
    expect(navigation.push).not.toHaveBeenCalled();
  } finally {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

it("uses the animated insertion slot when dropping between adjacent tasks", async () => {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "";
    }
  }
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  try {
    gateway.reorder.mockResolvedValue({ ...first, rank: "zzzzzzzzzzzy" });
    render(
      <TasksProvider
        mode="cloud"
        userId="owner"
        initialState={{ tasks: [first, second, progress] }}
      >
        <TaskListView />
      </TasksProvider>,
    );
    const firstBody = screen.getByRole("button", { name: "Edit First" });
    Object.assign(firstBody, { setPointerCapture: vi.fn() });
    const firstRow = firstBody.closest("[data-task-row]")!;
    const secondRow = screen
      .getByRole("button", { name: "Edit Second" })
      .closest("[data-task-row]")!;
    vi.spyOn(firstRow, "getBoundingClientRect").mockReturnValue({
      top: 0,
      height: 100,
    } as DOMRect);
    vi.spyOn(secondRow, "getBoundingClientRect").mockReturnValue({
      top: 100,
      height: 100,
    } as DOMRect);

    fireEvent.pointerDown(firstBody, {
      button: 0,
      pointerId: 4,
      pointerType: "mouse",
      clientX: 50,
      clientY: 50,
    });
    fireEvent.pointerMove(firstBody, {
      pointerId: 4,
      pointerType: "mouse",
      clientX: 55,
      clientY: 120,
    });
    expect(secondRow.getAttribute("data-shift")).toBeNull();
    fireEvent.pointerUp(firstBody, {
      pointerId: 4,
      pointerType: "mouse",
      clientY: 120,
    });
    expect(gateway.reorder).not.toHaveBeenCalled();

    fireEvent.pointerDown(firstBody, {
      button: 0,
      pointerId: 5,
      pointerType: "mouse",
      clientX: 50,
      clientY: 50,
    });
    fireEvent.pointerMove(firstBody, {
      pointerId: 5,
      pointerType: "mouse",
      clientX: 55,
      clientY: 160,
    });
    expect(secondRow.getAttribute("data-shift")).toBe("up");
    fireEvent.pointerUp(firstBody, {
      pointerId: 5,
      pointerType: "mouse",
      clientY: 160,
    });
    await waitFor(() => expect(gateway.reorder).toHaveBeenCalledOnce());
    expect(gateway.reorder).toHaveBeenCalledWith({
      id: first.id,
      before_id: second.id,
      after_id: null,
      status: "todo",
      parent_id: null,
      pinned: false,
    });
  } finally {
    vi.unstubAllGlobals();
  }
});

it.each([false, true])(
  "removes and restores all descendant routes with one undo (bulk=%s)",
  async (bulk) => {
    const child = { ...second, parent_id: first.id, status: "done" as const };
    const grandchild = { ...progress, parent_id: child.id };
    let stored = [first, child, grandchild];
    gateway.remove.mockImplementation(async (input: TaskDeletion) => {
      stored = applyTaskDeletion(stored, input);
      return stored;
    });
    function DeleteTree() {
      const { update, remove, tasks } = useTaskContext();
      return (
        <>
          <span>Active tasks: {tasks.length}</span>
          <button
            onClick={() =>
              void (bulk
                ? remove({
                    ids: [first.id],
                    from_status: "todo",
                    parent_id: null,
                    deleted_at: "2026-10-27T10:00:00Z",
                    restore: false,
                  })
                : update(first.id, { deleted_at: "2026-10-27T10:00:00Z" }))
            }
          >
            Delete parent
          </button>
          <UndoControl />
          <TaskDetail taskId={grandchild.id} />
        </>
      );
    }
    render(
      <TasksProvider
        mode="cloud"
        userId="owner"
        initialState={{ tasks: stored }}
      >
        <DeleteTree />
      </TasksProvider>,
    );
    expect(
      screen.getByRole("heading", { name: grandchild.title }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete parent" }));
    await screen.findByText("Active tasks: 0");
    await screen.findByRole("heading", { name: "A page out of place." });
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Undo batch",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    expect(gateway.update).not.toHaveBeenCalled();
    expect(stored.every((task) => !!task.deleted_at)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Undo batch" }));
    await screen.findByText("Active tasks: 3");
    await screen.findByRole("heading", { name: grandchild.title });
    expect(stored.every((task) => !task.deleted_at)).toBe(true);
  },
);

async function destination(label: string) {
  fireEvent.keyDown(screen.getByRole("button", { name: "Move to…" }), {
    key: "ArrowDown",
  });
  fireEvent.keyDown(await screen.findByRole("menuitemradio", { name: label }), {
    key: "Enter",
  });
}

it.each([false, true])(
  "selects through task content and restores navigation after cancelling (subtasks=%s)",
  (nested) => {
    const openSubtask = vi.fn();
    const tasks = [
      { ...first, parent_id: nested ? progress.id : null },
      ...(nested ? [progress] : []),
    ];
    render(
      <TasksProvider mode="cloud" userId="owner" initialState={{ tasks }}>
        {nested ? (
          <SubtaskSection taskId={progress.id} onOpenTask={openSubtask} />
        ) : (
          <TaskListView />
        )}
      </TasksProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select tasks" }));
    fireEvent.click(screen.getByRole("button", { name: "Select First" }));
    expect(screen.getByText("1 selected")).toBeTruthy();
    expect(
      screen
        .getByRole("checkbox", { name: "Select First" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(navigation.push).not.toHaveBeenCalled();
    expect(openSubtask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Select First" }));
    expect(
      screen
        .getByRole("checkbox", { name: "Select First" })
        .getAttribute("aria-checked"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit First" }));
    if (nested) expect(openSubtask).toHaveBeenCalledWith(first.id);
    else expect(navigation.push).toHaveBeenCalledWith(`/tasks/${first.id}`);
  },
);

it.each([false, true])(
  "moves only this tab's selected tasks, with one batch undo (subtasks=%s)",
  async (nested) => {
    const parentId = nested ? progress.id : null;
    const selectedTasks = [first, second].map((task) => ({
      ...task,
      parent_id: parentId,
    }));
    const outside = { ...progress, parent_id: parentId };
    const tasks = [
      ...selectedTasks,
      outside,
      ...(nested
        ? [{ ...progress, status: "todo" as const, parent_id: null }]
        : []),
    ];
    gateway.move.mockImplementation(async (input: TaskMove) =>
      selectedTasks.map((task) => ({ ...task, status: input.to_status })),
    );
    render(
      <TasksProvider mode="cloud" userId="owner" initialState={{ tasks }}>
        {nested ? (
          <SubtaskSection taskId={parentId!} onOpenTask={vi.fn()} />
        ) : (
          <TaskListView />
        )}
        <UndoControl />
      </TasksProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select tasks" }));
    expect(screen.queryByRole("button", { name: "Complete First" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select First" }));
    expect(
      screen
        .getByRole("checkbox", { name: "Select First" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(gateway.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText("2 selected")).toBeTruthy();
    await destination("Done");
    fireEvent.click(screen.getByRole("button", { name: "Move selected" }));
    await waitFor(() => expect(gateway.move).toHaveBeenCalledOnce());
    expect(gateway.move).toHaveBeenCalledWith({
      ids: [first.id, second.id],
      from_status: "todo",
      to_status: "done",
      parent_id: parentId,
    });
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Undo batch",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo batch" }));
    await screen.findByRole("button", { name: "Complete First" });
    expect(gateway.move).toHaveBeenLastCalledWith({
      ids: [first.id, second.id],
      from_status: "done",
      to_status: "todo",
      parent_id: parentId,
    });
    expect(gateway.move).toHaveBeenCalledTimes(2);
  },
);

it("clears selection when tabs or search filters change and shows only other destinations", async () => {
  render(
    <TasksProvider
      mode="cloud"
      userId="owner"
      initialState={{ tasks: [first, second, progress] }}
    >
      <TaskListView />
    </TasksProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Select tasks" }));
  fireEvent.click(screen.getByRole("button", { name: "Select all" }));
  fireEvent.click(screen.getByRole("tab", { name: "In progress 1" }));
  expect(screen.queryByText("2 selected")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Select tasks" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Select Other tab" }));
  fireEvent.keyDown(screen.getByRole("button", { name: "Move to…" }), {
    key: "ArrowDown",
  });
  expect(
    await screen.findByRole("menuitemradio", { name: "Todo" }),
  ).toBeTruthy();
  expect(screen.getByRole("menuitemradio", { name: "Done" })).toBeTruthy();
  expect(
    screen.queryByRole("menuitemradio", { name: "In progress" }),
  ).toBeNull();
  fireEvent.keyDown(screen.getByRole("menuitemradio", { name: "Todo" }), {
    key: "Escape",
  });
  fireEvent.change(screen.getByLabelText("Search tasks"), {
    target: { value: "Other" },
  });
  expect(
    screen.queryByRole("checkbox", { name: "Select Other tab" }),
  ).toBeNull();
  expect(gateway.move).not.toHaveBeenCalled();
});

it("rolls back a failed move and preserves the selection for retry", async () => {
  gateway.move.mockRejectedValue(new Error("Selected tasks changed"));
  render(
    <TasksProvider
      mode="cloud"
      userId="owner"
      initialState={{ tasks: [first, second] }}
    >
      <TaskListView />
    </TasksProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Select tasks" }));
  fireEvent.click(screen.getByRole("button", { name: "Select all" }));
  await destination("In progress");
  fireEvent.click(screen.getByRole("button", { name: "Move selected" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Selected tasks changed",
  );
  expect(
    screen
      .getByRole("checkbox", { name: "Select First" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  expect(screen.getByText("2 selected")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Move selected" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

it.each([false, true])(
  "soft-deletes a scoped selection and restores it with one undo (subtasks=%s)",
  async (nested) => {
    const parentId = nested ? progress.id : null;
    const selectedTasks = [first, second].map((task) => ({
      ...task,
      parent_id: parentId,
    }));
    gateway.remove.mockImplementation(async (input: TaskDeletion) =>
      selectedTasks.map((task) => ({
        ...task,
        deleted_at: input.restore ? null : input.deleted_at,
      })),
    );
    render(
      <TasksProvider
        mode="cloud"
        userId="owner"
        initialState={{ tasks: [...selectedTasks, progress] }}
      >
        {nested ? (
          <SubtaskSection taskId={parentId!} onOpenTask={vi.fn()} />
        ) : (
          <TaskListView />
        )}
        <UndoControl />
      </TasksProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select tasks" }));
    expect(
      (
        screen.getByRole("button", {
          name: "Delete selected",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Undo batch",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    const deletion = gateway.remove.mock.calls[0][0];
    expect(deletion).toMatchObject({
      ids: [first.id, second.id],
      from_status: "todo",
      parent_id: parentId,
      restore: false,
    });
    expect(screen.queryByRole("button", { name: "Edit First" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo batch" }));
    await screen.findByRole("button", { name: "Complete First" });
    expect(gateway.remove).toHaveBeenCalledTimes(2);
    expect(gateway.remove).toHaveBeenLastCalledWith({
      ...deletion,
      restore: true,
    });
  },
);

it("places selection before Focus today and resets the destination when cancelled from that button", async () => {
  render(
    <TasksProvider
      mode="cloud"
      userId="owner"
      initialState={{ tasks: [first, second] }}
    >
      <TaskListView />
    </TasksProvider>,
  );
  const toggle = screen.getByRole("button", { name: "Select tasks" });
  const focus = screen.getByRole("button", { name: "Focus today" });
  expect(toggle.parentElement).toBe(focus.parentElement);
  expect(
    toggle.compareDocumentPosition(focus) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole("button", { name: "Select all" }));
  await destination("Done");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  fireEvent.click(toggle);
  expect(screen.getByText("0 selected")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Move to…" })).toBeTruthy();
});

it("restores the rows and selection after a failed bulk delete", async () => {
  gateway.remove.mockRejectedValue(new Error("Unable to delete tasks"));
  render(
    <TasksProvider
      mode="cloud"
      userId="owner"
      initialState={{ tasks: [first, second] }}
    >
      <TaskListView />
    </TasksProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Select tasks" }));
  fireEvent.click(screen.getByRole("button", { name: "Select all" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Unable to delete tasks",
  );
  expect(
    screen
      .getByRole("checkbox", { name: "Select First" })
      .getAttribute("aria-checked"),
  ).toBe("true");
});

it("rolls back a failed deletion undo and keeps it available for retry", async () => {
  gateway.remove.mockImplementation(async (input: TaskDeletion) =>
    [first, second].map((task) => ({
      ...task,
      deleted_at: input.restore ? null : input.deleted_at,
    })),
  );
  render(
    <TasksProvider
      mode="cloud"
      userId="owner"
      initialState={{ tasks: [first, second] }}
    >
      <TaskListView />
      <UndoControl />
    </TasksProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Select tasks" }));
  fireEvent.click(screen.getByRole("button", { name: "Select all" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Undo batch" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  gateway.remove.mockRejectedValueOnce(new Error("Connection interrupted"));
  fireEvent.click(screen.getByRole("button", { name: "Undo batch" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Connection interrupted",
  );
  expect(screen.queryByRole("button", { name: "Edit First" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Undo batch" }));
  await screen.findByRole("button", { name: "Edit First" });
  expect(gateway.remove).toHaveBeenCalledTimes(3);
  expect(
    (screen.getByRole("button", { name: "Undo batch" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
