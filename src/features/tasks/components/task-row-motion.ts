import type { TaskPatch, TaskStatus } from "../domain/task";

export const TASK_ROW_MOTION_MS = 760;

export type TaskRowMotion =
  | "rule-write"
  | "pencil-rule"
  | "rule-rewind"
  | "rule-rewind-check"
  | "paper-flecks";

export function taskRowMotion(
  from: TaskStatus,
  patch: TaskPatch,
): TaskRowMotion | null {
  if (patch.deleted_at) return "paper-flecks";
  const to = patch.status;
  if (!to || to === from) return null;
  if (to === "done") return "pencil-rule";
  if (from === "done") return "rule-rewind-check";
  return to === "todo" ? "rule-rewind" : "rule-write";
}
