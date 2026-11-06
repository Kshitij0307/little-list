import { z } from "zod";
import { rankBetween, taskRankSchema } from "./task-rank";

export const STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In progress",
  done: "Done",
};
export const PIN_COLORS = ["olive", "berry", "sage", "slate", "cream"] as const;
export const pinColorSchema = z.enum(PIN_COLORS);
export type PinColor = (typeof PIN_COLORS)[number];

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Choose a valid date.");

const taskLink = z
  .string()
  .trim()
  .max(2048, "Keep the link under 2,048 characters.")
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        /^https?:\/\//i.test(value) &&
        !url.username &&
        !url.password &&
        !/\s/.test(value)
      );
    } catch {
      return false;
    }
  }, "Enter a valid http:// or https:// link.");

const editableTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give your task a title.")
    .max(200, "Keep the title under 200 characters."),
  notes: z.string().max(5000, "Keep notes under 5,000 characters."),
  link_url: taskLink.nullable(),
  status: z.enum(STATUSES),
  pinned: z.boolean(),
  focus_today: z.boolean(),
  due_date: dateOnly.nullable(),
});
export const taskFieldsSchema = editableTaskSchema.extend({
  notes: editableTaskSchema.shape.notes.default(""),
  link_url: editableTaskSchema.shape.link_url.default(null),
  status: editableTaskSchema.shape.status.default("todo"),
  pinned: editableTaskSchema.shape.pinned.default(false),
  focus_today: editableTaskSchema.shape.focus_today.default(false),
  due_date: editableTaskSchema.shape.due_date.default(null),
});
export const createTaskSchema = taskFieldsSchema
  .extend({ id: z.uuid(), parent_id: z.uuid().nullable().default(null) })
  .strict();
export const updateTaskSchema = editableTaskSchema
  .partial()
  .extend({
    parent_id: z.uuid().nullable().optional(),
    deleted_at: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, "No changes supplied.");
export const taskSchema = taskFieldsSchema.extend({
  id: z.uuid(),
  parent_id: z.uuid().nullable().default(null),
  pin_color: pinColorSchema.nullable().default(null),
  rank: taskRankSchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  completed_at: z.iso.datetime({ offset: true }).nullable(),
  deleted_at: z.iso.datetime({ offset: true }).nullable(),
});
export type Task = z.infer<typeof taskSchema>;
export type CreateTask = z.infer<typeof createTaskSchema>;
export type TaskPatch = z.infer<typeof updateTaskSchema>;

export function makeTask(
  input: CreateTask,
  now = new Date().toISOString(),
  rank = rankBetween(null, null),
): Task {
  return {
    ...createTaskSchema.parse(input),
    created_at: now,
    updated_at: now,
    completed_at: input.status === "done" ? now : null,
    deleted_at: null,
    pin_color: null,
    rank,
  };
}

export function applyTaskPatch(
  task: Task,
  input: TaskPatch,
  now = new Date().toISOString(),
): Task {
  const patch = updateTaskSchema.parse(input);
  const status = patch.status ?? task.status;
  return {
    ...task,
    ...patch,
    updated_at: now,
    completed_at: status === "done" ? (task.completed_at ?? now) : null,
  };
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function sortTasks(tasks: Task[], _status: TaskStatus): Task[] {
  void _status;
  return [...tasks].sort((a, b) => {
    return (
      Number(b.pinned) - Number(a.pinned) ||
      a.rank.localeCompare(b.rank) ||
      a.id.localeCompare(b.id)
    );
  });
}

// Validate the full ancestry so moving a task cannot make it its own descendant.
export function validateTaskParent(
  tasks: Task[],
  id: string,
  parentId: string | null,
): void {
  const seen = new Set([id]);
  let ancestor = parentId;
  while (ancestor) {
    if (seen.has(ancestor))
      throw new Error("A task cannot be its own subtask.");
    seen.add(ancestor);
    const parent = tasks.find(
      (task) => task.id === ancestor && !task.deleted_at,
    );
    if (!parent) throw new Error("Parent task not found. Refresh your list.");
    ancestor = parent.parent_id;
  }
}

export function mainTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => !task.parent_id && !task.deleted_at);
}

export function childTasks(
  tasks: Task[],
  parentId: string,
  status?: TaskStatus,
): Task[] {
  const children = tasks.filter(
    (task) =>
      task.parent_id === parentId &&
      !task.deleted_at &&
      (!status || task.status === status),
  );
  return status ? sortTasks(children, status) : children;
}

export function subtaskCandidates(tasks: Task[], parentId: string): Task[] {
  return mainTasks(tasks).filter((task) => {
    try {
      validateTaskParent(tasks, task.id, parentId);
      return true;
    } catch {
      return false;
    }
  });
}
