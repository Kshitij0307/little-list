import {
  applyTaskPatch,
  makeTask,
  validateTaskParent,
  taskSchema,
  type Task,
  type CreateTask,
  type TaskPatch,
} from "../domain/task";
import {
  applyTaskMove,
  parseMovedTasks,
  taskMoveSchema,
  type TaskMove,
  applyTaskDeletion,
  parseDeletedTasks,
  taskDeletionSchema,
  type TaskDeletion,
} from "../domain/task-batch";

export type StorageMode = "local" | "cloud";
export interface TaskGateway {
  list(): Promise<{ userId: string | null; tasks: Task[] }>;
  create(input: CreateTask): Promise<Task>;
  update(id: string, input: TaskPatch): Promise<Task>;
  move(input: TaskMove): Promise<Task[]>;
  remove(input: TaskDeletion): Promise<Task[]>;
}

const STORAGE_KEY = "little-list.tasks.v1";

function readLocal(): Task[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  try {
    return taskSchema.array().parse(JSON.parse(saved));
  } catch {
    throw new Error(
      "Your saved list could not be read. It has been left untouched.",
    );
  }
}

function writeLocal(tasks: Task[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    throw new Error(
      "This browser could not save your list. Check that storage is available.",
    );
  }
}

async function request(path: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  });
  const body = await response.json().catch(() => null);
  if (response.status === 401) {
    window.location.replace("/login");
    throw new Error("Your session expired. Please sign in again.");
  }
  if (!response.ok)
    throw new Error(body?.error ?? "Could not connect. Please try again.");
  return body;
}

export function createGateway(mode: StorageMode): TaskGateway {
  if (mode === "cloud")
    return {
      list: async () => {
        const result = await request("/api/tasks");
        if (
          !result ||
          typeof result !== "object" ||
          !("userId" in result) ||
          typeof result.userId !== "string" ||
          !("tasks" in result)
        )
          throw new Error("Invalid task list response.");
        return {
          userId: result.userId,
          tasks: taskSchema.array().parse(result.tasks),
        };
      },
      create: async (input) =>
        taskSchema.parse(
          await request("/api/tasks", {
            method: "POST",
            body: JSON.stringify(input),
          }),
        ),
      update: async (id, input) =>
        taskSchema.parse(
          await request(`/api/tasks/${id}`, {
            method: "PATCH",
            body: JSON.stringify(input),
          }),
        ),
      move: async (input) => {
        const move = taskMoveSchema.parse(input);
        return parseMovedTasks(
          await request("/api/tasks/batch", {
            method: "PATCH",
            body: JSON.stringify(move),
          }),
          move,
        );
      },
      remove: async (input) => {
        const deletion = taskDeletionSchema.parse(input);
        return parseDeletedTasks(
          await request("/api/tasks/batch", {
            method: "PATCH",
            body: JSON.stringify(deletion),
          }),
          deletion,
        );
      },
    };
  return {
    list: async () => ({
      userId: null,
      tasks: readLocal().filter((task) => !task.deleted_at),
    }),
    create: async (input) => {
      const tasks = readLocal();
      const task = makeTask(input);
      validateTaskParent(tasks, task.id, task.parent_id);
      writeLocal([...tasks, task]);
      return task;
    },
    update: async (id, input) => {
      const tasks = readLocal();
      const current = tasks.find((task) => task.id === id);
      if (!current) throw new Error("Task not found. Refresh your list.");
      const task = applyTaskPatch(current, input);
      if (input.parent_id !== undefined)
        validateTaskParent(tasks, id, task.parent_id);
      writeLocal(tasks.map((item) => (item.id === id ? task : item)));
      return task;
    },
    move: async (input) => {
      const move = taskMoveSchema.parse(input);
      const tasks = applyTaskMove(readLocal(), move);
      writeLocal(tasks);
      return tasks.filter((task) => move.ids.includes(task.id));
    },
    remove: async (input) => {
      const deletion = taskDeletionSchema.parse(input);
      const tasks = applyTaskDeletion(readLocal(), deletion);
      writeLocal(tasks);
      return tasks.filter((task) => deletion.ids.includes(task.id));
    },
  };
}
