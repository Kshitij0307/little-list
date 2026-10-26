import { z } from "zod";
import { applyTaskPatch, STATUSES, taskSchema, type Task } from "./task";

export const MAX_BATCH_TASKS = 500;
const batchScopeSchema = z
  .object({
    ids: z
      .array(z.uuid())
      .min(1, "Select at least one task.")
      .max(MAX_BATCH_TASKS, "Select at most 500 tasks at a time.")
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Select each task only once.",
      ),
    from_status: z.enum(STATUSES),
    parent_id: z.uuid().nullable(),
  })
  .strict();
export const taskMoveSchema = batchScopeSchema
  .extend({ to_status: z.enum(STATUSES) })
  .refine(
    (input) => input.from_status !== input.to_status,
    "Choose a different status.",
  );
export type TaskMove = z.infer<typeof taskMoveSchema>;
export const taskDeletionSchema = batchScopeSchema.extend({
  deleted_at: z.iso.datetime({ offset: true }),
  restore: z.boolean(),
});
export type TaskDeletion = z.infer<typeof taskDeletionSchema>;
export const taskBatchSchema = z.union([taskMoveSchema, taskDeletionSchema]);

export function applyTaskDeletion(tasks: Task[], input: TaskDeletion): Task[] {
  const deletion = taskDeletionSchema.parse(input);
  const ids = new Set(deletion.ids);
  const selected = tasks.filter((task) => ids.has(task.id));
  if (
    selected.length !== ids.size ||
    selected.some(
      (task) =>
        task.status !== deletion.from_status ||
        task.parent_id !== deletion.parent_id ||
        (deletion.restore
          ? !task.deleted_at ||
            Date.parse(task.deleted_at) !== Date.parse(deletion.deleted_at)
          : !!task.deleted_at),
    )
  )
    throw new Error(
      "Selected tasks changed. Refresh your list and select them again.",
    );
  return tasks.map((task) =>
    ids.has(task.id)
      ? applyTaskPatch(task, {
          deleted_at: deletion.restore ? null : deletion.deleted_at,
        })
      : task,
  );
}

export function parseDeletedTasks(value: unknown, input: TaskDeletion): Task[] {
  const tasks = taskSchema.array().parse(value);
  const ids = new Set(input.ids);
  if (
    tasks.length !== ids.size ||
    new Set(tasks.map((task) => task.id)).size !== ids.size ||
    tasks.some(
      (task) =>
        !ids.has(task.id) ||
        task.status !== input.from_status ||
        task.parent_id !== input.parent_id ||
        (input.restore
          ? !!task.deleted_at
          : !task.deleted_at ||
            Date.parse(task.deleted_at) !== Date.parse(input.deleted_at)),
    )
  )
    throw new Error("Could not confirm the task deletion. Refresh your list.");
  return tasks;
}

export function applyTaskMove(tasks: Task[], input: TaskMove): Task[] {
  const move = taskMoveSchema.parse(input);
  const ids = new Set(move.ids);
  const selected = tasks.filter((task) => ids.has(task.id));
  if (
    selected.length !== ids.size ||
    selected.some(
      (task) =>
        task.deleted_at ||
        task.status !== move.from_status ||
        task.parent_id !== move.parent_id,
    )
  )
    throw new Error(
      "Selected tasks changed. Refresh your list and select them again.",
    );
  const now = new Date().toISOString();
  return tasks.map((task) =>
    ids.has(task.id)
      ? applyTaskPatch(task, { status: move.to_status }, now)
      : task,
  );
}

export function parseMovedTasks(value: unknown, input: TaskMove): Task[] {
  const tasks = taskSchema.array().parse(value);
  const ids = new Set(input.ids);
  if (
    tasks.length !== ids.size ||
    new Set(tasks.map((task) => task.id)).size !== ids.size ||
    tasks.some(
      (task) =>
        !ids.has(task.id) ||
        task.status !== input.to_status ||
        task.parent_id !== input.parent_id ||
        task.deleted_at,
    )
  )
    throw new Error("Could not confirm the task move. Refresh your list.");
  return tasks;
}
