"use client";

import { useState } from "react";
import { ZodError } from "zod";
import {
  changeDraft,
  taskDraft,
  taskDraftPatch,
  type DraftChanges,
  type TaskDraft,
} from "../domain/task-draft";
import type { Task, TaskPatch } from "../domain/task";

type Feedback =
  | { kind: "idle" }
  | { kind: "saved" }
  | { kind: "invalid"; message: string };

export function useTaskForm(
  task: Task,
  onSave: (patch: TaskPatch) => Promise<boolean>,
) {
  const [changes, setChanges] = useState<DraftChanges>({});
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });
  const values = taskDraft(task, changes);
  const current = taskDraft(task);
  const dirty = (Object.keys(changes) as (keyof TaskDraft)[]).some(
    (key) => values[key] !== current[key],
  );

  function change<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setChanges((previous) => changeDraft(task, previous, key, value));
    setFeedback({ kind: "idle" });
  }

  async function save() {
    let patch: TaskPatch;
    try {
      patch = taskDraftPatch(task, changes);
    } catch (error) {
      setFeedback({
        kind: "invalid",
        message:
          error instanceof ZodError
            ? error.issues[0].message
            : "Check your task details.",
      });
      return;
    }
    setFeedback({ kind: "idle" });
    if (!Object.keys(patch).length || (await onSave(patch))) {
      setChanges({});
      setFeedback({ kind: "saved" });
    }
  }

  return {
    values,
    change,
    save,
    dirty,
    saved: feedback.kind === "saved" && !dirty,
    validationError: feedback.kind === "invalid" ? feedback.message : null,
  };
}
