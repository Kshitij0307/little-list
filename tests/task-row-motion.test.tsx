// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { TasksProvider } from "../src/features/tasks/hooks/tasks-provider";
import { TaskListView } from "../src/features/tasks/components/task-list-view";
import { SubtaskSection } from "../src/features/tasks/components/subtask-section";
import { taskRowMotion } from "../src/features/tasks/components/task-row-motion";
import { createTaskSchema, makeTask } from "../src/features/tasks/domain/task";

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
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const task = makeTask(
  createTaskSchema.parse({
    id: "be7f3440-3868-4e48-90fb-f2e8dbce5b26",
    title: "Write a page",
  }),
);

beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("task row motion", () => {
  it("chooses matching rule, check, and paper motions", () => {
    expect(taskRowMotion("todo", { status: "in_progress" })).toBe("rule-write");
    expect(taskRowMotion("todo", { status: "done" })).toBe("pencil-rule");
    expect(taskRowMotion("in_progress", { status: "done" })).toBe(
      "pencil-rule",
    );
    expect(taskRowMotion("in_progress", { status: "todo" })).toBe(
      "rule-rewind",
    );
    expect(taskRowMotion("done", { status: "todo" })).toBe("rule-rewind-check");
    expect(taskRowMotion("done", { status: "in_progress" })).toBe(
      "rule-rewind-check",
    );
    expect(taskRowMotion("todo", { deleted_at: "2026-11-08T00:00:00Z" })).toBe(
      "paper-flecks",
    );
    expect(taskRowMotion("todo", { title: "Another page" })).toBeNull();
  });

  it("keeps an updating main row visible for its motion while saving immediately", async () => {
    gateway.update.mockResolvedValue({ ...task, status: "in_progress" });
    render(
      <TasksProvider
        mode="cloud"
        userId="owner"
        initialState={{ tasks: [task] }}
      >
        <TaskListView />
      </TasksProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Start ${task.title}` }),
    );

    expect(
      document
        .querySelector(`[data-task-id="${task.id}"]`)
        ?.getAttribute("data-motion"),
    ).toBe("rule-write");
    await waitFor(() =>
      expect(gateway.update).toHaveBeenCalledWith(task.id, {
        status: "in_progress",
      }),
    );
    await waitFor(
      () =>
        expect(
          document.querySelector(`[data-task-id="${task.id}"]`),
        ).toBeNull(),
      { timeout: 1600 },
    );
  });

  it("uses the same pencil and rule motion for a subtask", () => {
    const child = {
      ...task,
      id: "d2e80888-53ec-419d-aea0-54beb67d77b3",
      parent_id: task.id,
      title: "A smaller step",
    };
    gateway.update.mockResolvedValue({ ...child, status: "done" });
    render(
      <TasksProvider
        mode="cloud"
        userId="owner"
        initialState={{ tasks: [task, child] }}
      >
        <SubtaskSection taskId={task.id} onOpenTask={vi.fn()} />
      </TasksProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Complete ${child.title}` }),
    );

    expect(
      document
        .querySelector(`[data-task-id="${child.id}"]`)
        ?.getAttribute("data-motion"),
    ).toBe("pencil-rule");
  });

  it("keeps a deleted row until its paper flecks finish", async () => {
    gateway.remove.mockResolvedValue([
      { ...task, deleted_at: "2026-11-08T00:00:00Z" },
    ]);
    render(
      <TasksProvider
        mode="cloud"
        userId="owner"
        initialState={{ tasks: [task] }}
      >
        <TaskListView />
      </TasksProvider>,
    );

    fireEvent.keyDown(
      screen.getByRole("button", { name: `More options for ${task.title}` }),
      { key: "ArrowDown" },
    );
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete task" }),
    );

    expect(
      document
        .querySelector(`[data-task-id="${task.id}"]`)
        ?.getAttribute("data-motion"),
    ).toBe("paper-flecks");
    await waitFor(() => expect(gateway.remove).toHaveBeenCalledOnce());
    await waitFor(
      () =>
        expect(
          document.querySelector(`[data-task-id="${task.id}"]`),
        ).toBeNull(),
      { timeout: 1600 },
    );
  });

  it("skips the animation when reduced motion is preferred", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    gateway.update.mockResolvedValue({ ...task, status: "in_progress" });
    render(
      <TasksProvider
        mode="cloud"
        userId="owner"
        initialState={{ tasks: [task] }}
      >
        <TaskListView />
      </TasksProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Start ${task.title}` }),
    );

    await waitFor(() =>
      expect(document.querySelector(`[data-task-id="${task.id}"]`)).toBeNull(),
    );
    expect(gateway.update).toHaveBeenCalledOnce();
  });
});
