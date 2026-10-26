import "server-only";
import { requireTaskSession } from "@/features/auth/server/session";
export { storageMode } from "@/lib/supabase/config";
import {
  createTaskSchema,
  taskSchema,
  updateTaskSchema,
  type CreateTask,
  type Task,
  type TaskPatch,
} from "../domain/task";
import {
  parseMovedTasks,
  taskMoveSchema,
  type TaskMove,
  parseDeletedTasks,
  taskDeletionSchema,
  type TaskDeletion,
} from "../domain/task-batch";

export class TaskRepositoryError extends Error {}
export class TaskConflictError extends Error {}

export async function deleteTasks(input: TaskDeletion) {
  const deletion = taskDeletionSchema.parse(input);
  const { client } = await requireTaskSession();
  const { data, error } = await client.rpc("delete_tasks", {
    task_ids: deletion.ids,
    from_status: deletion.from_status,
    task_parent_id: deletion.parent_id,
    deletion_time: deletion.deleted_at,
    restoring: deletion.restore,
  });
  if (error?.code === "23514")
    throw new TaskConflictError(
      "Selected tasks changed. Refresh your list and select them again.",
    );
  if (error)
    throw new TaskRepositoryError("Unable to update the selected tasks.");
  return parseDeletedTasks(data, deletion);
}

export async function moveTasks(input: TaskMove) {
  const move = taskMoveSchema.parse(input);
  const { client } = await requireTaskSession();
  const { data, error } = await client.rpc("move_tasks", {
    task_ids: move.ids,
    from_status: move.from_status,
    to_status: move.to_status,
    task_parent_id: move.parent_id,
  });
  if (error?.code === "23514")
    throw new TaskConflictError(
      "Selected tasks changed. Refresh your list and select them again.",
    );
  if (error)
    throw new TaskRepositoryError("Unable to move the selected tasks.");
  return parseMovedTasks(data, move);
}

export async function listTasks(
  session?: Awaited<ReturnType<typeof requireTaskSession>>,
) {
  const { client, user } = session ?? (await requireTaskSession());
  const tasks: Task[] = [];
  const pageSize = 500;
  // Supabase caps individual responses; page through so older tasks remain visible.
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new TaskRepositoryError("Unable to load tasks.");
    const page = taskSchema.array().parse(data);
    tasks.push(...page);
    if (page.length < pageSize) return { userId: user.id, tasks };
  }
}

export async function createTask(input: CreateTask) {
  const { client, user } = await requireTaskSession();
  const { data, error } = await client
    .from("tasks")
    .insert({ ...createTaskSchema.parse(input), user_id: user.id })
    .select()
    .single();
  if (error) throw new TaskRepositoryError("Unable to create the task.");
  return taskSchema.parse(data);
}

export async function updateTask(id: string, input: TaskPatch) {
  const { client, user } = await requireTaskSession();
  const { data, error } = await client
    .from("tasks")
    .update(updateTaskSchema.parse(input))
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();
  if (error) throw new TaskRepositoryError("Unable to update the task.");
  return data ? taskSchema.parse(data) : null;
}
