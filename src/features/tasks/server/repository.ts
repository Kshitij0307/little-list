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

export class TaskRepositoryError extends Error {}

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
