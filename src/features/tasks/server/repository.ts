import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createTaskSchema, taskSchema, updateTaskSchema, type CreateTask, type Task, type TaskPatch } from "../domain/task";

export class TaskRepositoryError extends Error {}

export function storageMode(): "local" | "cloud" {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!!url !== !!key) throw new Error("Set both Supabase environment variables, or leave both empty for local mode.");
  return url && key ? "cloud" : "local";
}

function database() {
  if (storageMode() !== "cloud") throw new TaskRepositoryError("Cloud storage is not configured.");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function listTasks() {
  const client = database();
  const tasks: Task[] = [];
  const pageSize = 500;
  // Supabase caps individual responses; page through so older tasks remain visible.
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("tasks").select("*").is("deleted_at", null)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + pageSize - 1);
    if (error) throw new TaskRepositoryError("Unable to load tasks.");
    const page = taskSchema.array().parse(data);
    tasks.push(...page);
    if (page.length < pageSize) return tasks;
  }
}

export async function createTask(input: CreateTask) {
  const { data, error } = await database().from("tasks").insert(createTaskSchema.parse(input)).select().single();
  if (error) throw new TaskRepositoryError("Unable to create the task.");
  return taskSchema.parse(data);
}

export async function updateTask(id: string, input: TaskPatch) {
  const { data, error } = await database().from("tasks").update(updateTaskSchema.parse(input)).eq("id", id).select().maybeSingle();
  if (error) throw new TaskRepositoryError("Unable to update the task.");
  return data ? taskSchema.parse(data) : null;
}
