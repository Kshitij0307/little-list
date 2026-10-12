import { applyTaskPatch, makeTask, taskSchema, type Task, type CreateTask, type TaskPatch } from "../domain/task";

export type StorageMode = "local" | "cloud";
export interface TaskGateway {
  list(): Promise<Task[]>;
  create(input: CreateTask): Promise<Task>;
  update(id: string, input: TaskPatch): Promise<Task>;
}

const STORAGE_KEY = "little-list.tasks.v1";

function readLocal(): Task[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  try { return taskSchema.array().parse(JSON.parse(saved)); }
  catch { throw new Error("Your saved list could not be read. It has been left untouched."); }
}

function writeLocal(tasks: Task[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
  catch { throw new Error("This browser could not save your list. Check that storage is available."); }
}

async function request(path: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(path, { ...options, cache: "no-store", headers: { "Content-Type": "application/json" } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Could not connect. Please try again.");
  return body;
}

export function createGateway(mode: StorageMode): TaskGateway {
  if (mode === "cloud") return {
    list: async () => taskSchema.array().parse(await request("/api/tasks")),
    create: async (input) => taskSchema.parse(await request("/api/tasks", { method: "POST", body: JSON.stringify(input) })),
    update: async (id, input) => taskSchema.parse(await request(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(input) })),
  };
  return {
    list: async () => readLocal().filter((task) => !task.deleted_at),
    create: async (input) => {
      const tasks = readLocal();
      const task = makeTask(input);
      writeLocal([...tasks, task]);
      return task;
    },
    update: async (id, input) => {
      const tasks = readLocal();
      const current = tasks.find((task) => task.id === id);
      if (!current) throw new Error("Task not found. Refresh your list.");
      const task = applyTaskPatch(current, input);
      writeLocal(tasks.map((item) => item.id === id ? task : item));
      return task;
    },
  };
}
