import {
  applyTaskPatch,
  makeTask,
  PIN_COLORS,
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
  taskDeletionTargets,
  repairDeletedTaskTrees,
  type TaskDeletion,
} from "../domain/task-batch";
import {
  applyLocalRankMove,
  rankBetween,
  spacedRanks,
  taskRankMoveSchema,
  type TaskRankMove,
} from "../domain/task-rank";

export type StorageMode = "local" | "cloud";
export interface TaskGateway {
  list(): Promise<{ userId: string | null; tasks: Task[] }>;
  create(input: CreateTask): Promise<Task>;
  update(id: string, input: TaskPatch): Promise<Task>;
  move(input: TaskMove): Promise<Task[]>;
  remove(input: TaskDeletion): Promise<Task[]>;
  reorder(input: TaskRankMove): Promise<Task>;
}

const STORAGE_KEY = "little-list.tasks.v1";

function repairPinColors(tasks: Task[]) {
  const next = [...tasks];
  const pinned = next
    .filter((task) => task.pinned && !task.deleted_at)
    .sort((a, b) => a.rank.localeCompare(b.rank));
  let changed = false;
  const assigned = new Map(
    pinned.map((task, index) => [
      task.id,
      PIN_COLORS[index % PIN_COLORS.length],
    ]),
  );
  for (let index = 0; index < next.length; index += 1) {
    const task = next[index];
    const color = task.pinned
      ? (task.pin_color ?? assigned.get(task.id))
      : null;
    if (task.pin_color !== color) {
      next[index] = { ...task, pin_color: color ?? "olive" };
      changed = true;
    }
  }
  return changed ? next : tasks;
}

function nextPinColor(tasks: Task[], id: string) {
  const pinnedCount = tasks.filter(
    (task) => task.id !== id && task.pinned && !task.deleted_at,
  ).length;
  return PIN_COLORS[pinnedCount % PIN_COLORS.length];
}

function readLocal(): Task[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  let tasks: Task[];
  try {
    const raw = JSON.parse(saved) as Record<string, unknown>[];
    let upgraded = false;
    const grouped = new Map<string, Record<string, unknown>[]>();
    for (const task of raw) {
      if (!("pinned" in task) && typeof task.starred === "boolean") {
        task.pinned = task.starred;
        upgraded = true;
      }
      const key = `${String(task.parent_id ?? "root")}:${String(task.status)}:${String(task.pinned ?? false)}`;
      const group = grouped.get(key) ?? [];
      group.push(task);
      grouped.set(key, group);
    }
    for (const group of grouped.values()) {
      const missing = group.some((task) => typeof task.rank !== "string");
      if (!missing) continue;
      upgraded = true;
      group.sort((a, b) =>
        Boolean(a.pinned) !== Boolean(b.pinned)
          ? Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
          : String(b.created_at).localeCompare(String(a.created_at)),
      );
      const ranks = spacedRanks(group.length);
      group.forEach((task, index) => (task.rank = ranks[index]));
    }
    const parsed = taskSchema.array().parse(raw);
    tasks = repairPinColors(parsed);
    if (upgraded || tasks !== parsed) writeLocal(tasks);
  } catch {
    throw new Error(
      "Your saved list could not be read. It has been left untouched.",
    );
  }
  const repaired = repairDeletedTaskTrees(tasks);
  if (repaired !== tasks) writeLocal(repaired);
  return repaired;
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
      reorder: async (input) =>
        taskSchema.parse(
          await request("/api/tasks/reorder", {
            method: "PATCH",
            body: JSON.stringify(taskRankMoveSchema.parse(input)),
          }),
        ),
    };
  return {
    list: async () => ({
      userId: null,
      tasks: readLocal().filter((task) => !task.deleted_at),
    }),
    create: async (input) => {
      const tasks = readLocal();
      const siblings = tasks
        .filter(
          (task) =>
            !task.deleted_at &&
            task.parent_id === input.parent_id &&
            task.status === input.status &&
            task.pinned === input.pinned,
        )
        .sort((a, b) => a.rank.localeCompare(b.rank));
      let task = makeTask(
        input,
        undefined,
        rankBetween(null, siblings.at(0)?.rank ?? null),
      );
      if (task.pinned)
        task = { ...task, pin_color: nextPinColor(tasks, task.id) };
      validateTaskParent(tasks, task.id, task.parent_id);
      writeLocal([...tasks, task]);
      return task;
    },
    update: async (id, input) => {
      const tasks = readLocal();
      const current = tasks.find((task) => task.id === id);
      if (!current) throw new Error("Task not found. Refresh your list.");
      let task = applyTaskPatch(current, input);
      if (input.pinned !== undefined && input.pinned !== current.pinned) {
        task = {
          ...task,
          pin_color: task.pinned ? nextPinColor(tasks, id) : null,
        };
      }
      if (
        (input.status !== undefined && input.status !== current.status) ||
        (input.parent_id !== undefined &&
          input.parent_id !== current.parent_id) ||
        (input.pinned !== undefined && input.pinned !== current.pinned)
      ) {
        const first = tasks
          .filter(
            (item) =>
              item.id !== id &&
              !item.deleted_at &&
              item.status === task.status &&
              item.parent_id === task.parent_id &&
              item.pinned === task.pinned,
          )
          .sort((a, b) => a.rank.localeCompare(b.rank))
          .at(0);
        task = { ...task, rank: rankBetween(null, first?.rank ?? null) };
      }
      if (input.parent_id !== undefined)
        validateTaskParent(tasks, id, task.parent_id);
      const patched = tasks.map((item) => (item.id === id ? task : item));
      if (
        input.deleted_at !== undefined &&
        input.deleted_at !== current.deleted_at
      ) {
        const deletion = taskDeletionSchema.parse({
          ids: [id],
          from_status: task.status,
          parent_id: task.parent_id,
          deleted_at: input.deleted_at ?? current.deleted_at,
          restore: input.deleted_at === null,
        });
        // Keep the previous deletion state while applying other patched fields.
        writeLocal(
          applyTaskDeletion(
            patched.map((item) =>
              item.id === id
                ? { ...task, deleted_at: current.deleted_at }
                : item,
            ),
            deletion,
          ),
        );
      } else writeLocal(patched);
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
      const current = readLocal();
      const ids = new Set(
        taskDeletionTargets(current, deletion).map((task) => task.id),
      );
      const tasks = applyTaskDeletion(current, deletion);
      writeLocal(tasks);
      return tasks.filter((task) => ids.has(task.id));
    },
    reorder: async (input) => {
      const result = applyLocalRankMove(readLocal(), input);
      writeLocal(result.tasks);
      return result.moved;
    },
  };
}
