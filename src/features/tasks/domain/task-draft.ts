import { taskFieldsSchema, type Task, type TaskPatch } from "./task";

export type TaskDraft = Pick<
  Task,
  "title" | "notes" | "status" | "starred" | "focus_today"
> & { due_date: string };
export type DraftChanges = Partial<TaskDraft>;

export function taskDraft(task: Task, changes: DraftChanges = {}): TaskDraft {
  return {
    title: task.title,
    notes: task.notes,
    due_date: task.due_date ?? "",
    status: task.status,
    starred: task.starred,
    focus_today: task.focus_today,
    ...changes,
  };
}

// Only local edits override refreshed data. Untouched fields always use the latest task.
export function changeDraft<K extends keyof TaskDraft>(
  task: Task,
  changes: DraftChanges,
  key: K,
  value: TaskDraft[K],
): DraftChanges {
  const next = { ...changes, [key]: value };
  if (taskDraft(task)[key] === value) delete next[key];
  return next;
}

export function taskDraftPatch(task: Task, changes: DraftChanges): TaskPatch {
  const draft = taskDraft(task, changes);
  const parsed = taskFieldsSchema.parse({
    ...draft,
    due_date: draft.due_date || null,
  });
  const patch: TaskPatch = {};
  for (const key of Object.keys(changes) as (keyof TaskDraft)[]) {
    if (parsed[key] !== task[key]) Object.assign(patch, { [key]: parsed[key] });
  }
  return patch;
}
