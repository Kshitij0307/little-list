"use client";
import formStyles from "./task-form.module.css";
import fieldsStyles from "@/components/ui/fields.module.css";
import { CalendarDays, Star, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChoiceMenu } from "@/components/ui/choice-menu";
import {
  STATUSES,
  STATUS_LABELS,
  type Task,
  type TaskPatch,
  type TaskStatus,
} from "../domain/task";
import { useTaskForm } from "../hooks/use-task-form";
export function TaskForm({
  task,
  busy,
  onSave,
}: {
  task: Task;
  busy: boolean;
  onSave(patch: TaskPatch): Promise<boolean>;
}) {
  const { values, change, save, dirty, validationError, saved } = useTaskForm(
    task,
    onSave,
  );
  return (
    <form
      className={formStyles["editor-form"]}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h3>Task details</h3>
      <label className={fieldsStyles["field-label"]} htmlFor="task-title">
        Task
      </label>
      <input
        className={fieldsStyles["field"]}
        id="task-title"
        value={values.title}
        onChange={(event) => change("title", event.target.value)}
        maxLength={200}
        required
        autoFocus
        disabled={busy}
      />
      <label className={fieldsStyles["field-label"]} htmlFor="task-notes">
        Notes <span className={fieldsStyles["optional"]}>optional</span>
      </label>
      <textarea
        className={[fieldsStyles["field"], fieldsStyles["notes-field"]].join(
          " ",
        )}
        id="task-notes"
        placeholder="A few thoughts, a link, or where to start…"
        value={values.notes}
        onChange={(event) => change("notes", event.target.value)}
        maxLength={5000}
        disabled={busy}
      />
      <div className={formStyles["editor-grid"]}>
        <div>
          <label className={fieldsStyles["field-label"]} htmlFor="task-status">
            Status
          </label>
          <ChoiceMenu
            id="task-status"
            value={values.status}
            onChange={(status) => change("status", status as TaskStatus)}
            disabled={busy}
            menuLabel="Task status"
            options={STATUSES.map((status) => ({
              value: status,
              label: STATUS_LABELS[status],
            }))}
          />
        </div>
        <div>
          <label className={fieldsStyles["field-label"]} htmlFor="task-due">
            <CalendarDays size={14} /> Due date
          </label>
          <input
            className={fieldsStyles["field"]}
            id="task-due"
            type="date"
            value={values.due_date}
            onChange={(event) => change("due_date", event.target.value)}
            disabled={busy}
          />
        </div>
      </div>
      <div className={formStyles["editor-toggles"]}>
        <label>
          <input
            type="checkbox"
            checked={values.starred}
            onChange={(event) => change("starred", event.target.checked)}
            disabled={busy}
          />
          <Star size={15} /> Important
        </label>
        <label>
          <input
            type="checkbox"
            checked={values.focus_today}
            onChange={(event) => change("focus_today", event.target.checked)}
            disabled={busy}
          />
          <Sun size={15} /> Focus today
        </label>
      </div>
      {validationError && (
        <p className={fieldsStyles["form-error"]} role="alert">
          {validationError}
        </p>
      )}
      <div className={formStyles["editor-footer"]}>
        {saved && (
          <span className={formStyles["inline-save-note"]}>Changes saved</span>
        )}
        <Button type="submit" disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
