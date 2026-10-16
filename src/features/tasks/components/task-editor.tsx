"use client";

import { useState } from "react";
import { ArrowLeft, CalendarDays, Plus, Star, Sun, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  STATUS_LABELS,
  STATUSES,
  subtaskCandidates,
  taskFieldsSchema,
  type Task,
  type TaskPatch,
} from "../domain/task";

import { TaskRow } from "./task-row";

export function TaskEditor({
  task,
  tasks,
  busy,
  onClose,
  onSave,
  onCreateSubtask,
  onUpdateTask,
  parentTitle,
}: {
  task: Task;
  tasks: Task[];
  busy: boolean;
  onClose(): void;
  onSave(patch: TaskPatch): Promise<boolean>;
  onCreateSubtask(title: string, parentId: string): Promise<boolean>;
  onUpdateTask(id: string, patch: TaskPatch, label?: string): Promise<boolean>;
  parentTitle?: string;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [status, setStatus] = useState(task.status);
  const [starred, setStarred] = useState(task.starred);
  const [focus, setFocus] = useState(task.focus_today);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState("");
  const [childId, setChildId] = useState<string | null>(null);
  const children = tasks.filter(
    (item) => item.parent_id === task.id && !item.deleted_at,
  );
  const candidates = subtaskCandidates(tasks, task.id);
  const child = children.find((item) => item.id === childId);
  const [error, setError] = useState<string | null>(null);

  async function updateSubtask(id: string, patch: TaskPatch, label?: string) {
    setSubtaskError(null);
    const saved = await onUpdateTask(id, patch, label);
    if (!saved)
      setSubtaskError("Could not update the subtask. Please try again.");
    return saved;
  }

  // Keep this editor mounted while a child is open, preserving unsaved parent details.
  if (child)
    return (
      <TaskEditor
        key={child.id}
        task={child}
        tasks={tasks}
        busy={busy}
        parentTitle={task.title}
        onClose={() => setChildId(null)}
        onSave={(patch) => onUpdateTask(child.id, patch)}
        onCreateSubtask={onCreateSubtask}
        onUpdateTask={onUpdateTask}
      />
    );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        {parentTitle && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="parent-task-back"
            disabled={busy}
            onClick={onClose}
          >
            <ArrowLeft size={14} />
            <span>Back to {parentTitle}</span>
          </Button>
        )}
        <p className="eyebrow">A little more detail</p>
        <DialogTitle className="dialog-title">
          Make room for the plan.
        </DialogTitle>
        <DialogDescription className="dialog-description">
          A clear next step goes a long way.
        </DialogDescription>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const result = taskFieldsSchema.safeParse({
              title,
              notes,
              due_date: dueDate || null,
              status,
              starred,
              focus_today: focus,
            });
            if (!result.success) {
              setError(result.error.issues[0].message);
              return;
            }
            setError(null);
            if (await onSave(result.data)) onClose();
            else setError("Your changes weren't saved. Please try again.");
          }}
          className="editor-form"
        >
          <label className="field-label" htmlFor="task-title">
            Task
          </label>
          <input
            className="field"
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            autoFocus
            disabled={busy}
          />
          <label className="field-label" htmlFor="task-notes">
            Notes <span className="optional">optional</span>
          </label>
          <textarea
            className="field notes-field"
            id="task-notes"
            placeholder="A few thoughts, a link, or where to start…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={5000}
            disabled={busy}
          />
          <div className="editor-grid">
            <div>
              <label className="field-label" htmlFor="task-status">
                Status
              </label>
              <select
                className="field"
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Task["status"])}
                disabled={busy}
              >
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {STATUS_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="task-due">
                <CalendarDays size={14} /> Due date
              </label>
              <input
                className="field"
                id="task-due"
                name="due_date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <div className="editor-toggles">
            <label>
              <input
                type="checkbox"
                checked={starred}
                onChange={(e) => setStarred(e.target.checked)}
                disabled={busy}
              />
              <Star size={15} /> Important
            </label>
            <label>
              <input
                type="checkbox"
                checked={focus}
                onChange={(e) => setFocus(e.target.checked)}
                disabled={busy}
              />
              <Sun size={15} /> Focus today
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="editor-footer">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
        <section
          className="subtasks-section"
          aria-labelledby="subtasks-heading"
        >
          <div className="subtasks-heading">
            <h2 id="subtasks-heading">Subtasks</h2>
            <span>
              {children.filter((item) => item.status === "done").length}/
              {children.length} done
            </span>
          </div>
          {children.length ? (
            <ul className="task-list subtask-list">
              {children.map((item) => (
                <li key={item.id} className="subtask-item">
                  <ul className="subtask-row-list">
                    <TaskRow
                      task={item}
                      busy={busy}
                      onEdit={() => setChildId(item.id)}
                      onUpdate={(patch, label) =>
                        void updateSubtask(item.id, patch, label)
                      }
                    />
                  </ul>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void updateSubtask(
                        item.id,
                        { parent_id: null },
                        "Subtask moved to main list",
                      )
                    }
                    aria-label={`Move ${item.title} to main list`}
                  >
                    <Unlink size={13} />
                    Move to main list
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="subtasks-hint">Break this task into smaller steps.</p>
          )}
          <form
            className="subtask-add-form"
            onSubmit={async (event) => {
              event.preventDefault();
              setSubtaskError(null);
              if (await onCreateSubtask(subtaskTitle, task.id))
                setSubtaskTitle("");
              else
                setSubtaskError("Could not add the subtask. Please try again.");
            }}
          >
            <label className="field-label" htmlFor="subtask-title">
              Add subtask
            </label>
            <div className="subtask-input-row">
              <input
                className="field"
                id="subtask-title"
                placeholder="A smaller next step…"
                value={subtaskTitle}
                onChange={(event) => setSubtaskTitle(event.target.value)}
                maxLength={200}
                required
                disabled={busy}
              />
              <Button
                type="submit"
                size="sm"
                disabled={busy || !subtaskTitle.trim()}
              >
                <Plus size={14} />
                Add
              </Button>
            </div>
          </form>
          <form
            className="subtask-add-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                existingId &&
                (await updateSubtask(
                  existingId,
                  { parent_id: task.id },
                  "Existing task added as subtask",
                ))
              )
                setExistingId("");
            }}
          >
            <label className="field-label" htmlFor="existing-subtask">
              Add existing task
            </label>
            <div className="subtask-input-row">
              <select
                className="field"
                id="existing-subtask"
                value={existingId}
                onChange={(event) => setExistingId(event.target.value)}
                disabled={busy || !candidates.length}
                required
              >
                <option value="">
                  {candidates.length
                    ? "Choose a task…"
                    : "No other tasks available"}
                </option>
                {candidates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · {STATUS_LABELS[item.status]}
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                size="sm"
                disabled={
                  busy || !candidates.some((item) => item.id === existingId)
                }
              >
                Add
              </Button>
            </div>
            <p className="subtasks-hint">
              Subtasks save immediately and appear only inside this task.
            </p>
          </form>
          {subtaskError && (
            <p className="form-error" role="alert">
              {subtaskError}
            </p>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
