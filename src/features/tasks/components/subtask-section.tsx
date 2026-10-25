"use client";
import subtasksStyles from "./subtask-section.module.css";
import listStyles from "./task-list-view.module.css";
import fieldsStyles from "@/components/ui/fields.module.css";
import { useState } from "react";
import { CheckCheck, Feather, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  childTasks,
  sortTasks,
  subtaskCandidates,
  STATUS_LABELS,
  type TaskStatus,
} from "../domain/task";
import { useTaskContext } from "../hooks/tasks-provider";
import { TaskRow } from "./task-row";
import { TaskPicker } from "./task-picker";
import { TaskStatusTabs } from "./task-status-tabs";
const SUBTASK_NOTES: Record<TaskStatus, string> = {
  todo: "The next small steps for this task.",
  in_progress: "The steps currently moving forward.",
  done: "Progress already made on this task.",
};

export function SubtaskSection({
  taskId,
  onOpenTask,
}: {
  taskId: string;
  onOpenTask(id: string): void;
}) {
  const { tasks, busy, create, update } = useTaskContext();
  const [subtaskStatus, setSubtaskStatus] = useState<TaskStatus>("todo");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [existingId, setExistingId] = useState("");
  const children = childTasks(tasks, taskId);
  const visibleChildren = sortTasks(
    children.filter((task) => task.status === subtaskStatus),
    subtaskStatus,
  );
  const candidates = subtaskCandidates(tasks, taskId);
  return (
    <section
      data-subtasks
      className={subtasksStyles["subtasks-section"]}
      aria-labelledby="subtasks-heading"
    >
      <div className={subtasksStyles["subtasks-heading"]}>
        <div>
          <h3 id="subtasks-heading">Subtasks</h3>
          <p>Give every step a clear place to land.</p>
        </div>
        <span>
          {children.filter((item) => item.status === "done").length}/
          {children.length} done
        </span>
      </div>

      <form
        className={subtasksStyles["subtask-add-form"]}
        onSubmit={async (event) => {
          event.preventDefault();

          if (await create(subtaskTitle, taskId)) {
            setSubtaskTitle("");
            setSubtaskStatus("todo");
          }
        }}
      >
        <label className={fieldsStyles["field-label"]} htmlFor="subtask-title">
          Add a smaller step as its subtask
        </label>
        <div className={subtasksStyles["subtask-input-row"]}>
          <input
            className={fieldsStyles["field"]}
            id="subtask-title"
            placeholder="What needs to happen next?"
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
            <Plus size={14} /> Add
          </Button>
        </div>
      </form>

      <div className={subtasksStyles["subtask-controls"]}>
        <TaskStatusTabs
          value={subtaskStatus}
          onChange={setSubtaskStatus}
          tasks={children}
          idPrefix="subtask"
          label="Subtask status"
        />
        <p>{SUBTASK_NOTES[subtaskStatus]}</p>
      </div>

      <div
        id="subtask-panel"
        role="tabpanel"
        aria-labelledby={`subtask-tab-${subtaskStatus}`}
        className={subtasksStyles["subtask-panel"]}
      >
        {visibleChildren.length ? (
          <ul
            className={[
              listStyles["task-list"],
              subtasksStyles["subtask-list"],
            ].join(" ")}
          >
            {visibleChildren.map((item) => (
              <TaskRow
                key={item.id}
                task={item}
                busy={busy}
                onEdit={() => onOpenTask(item.id)}
                onUpdate={(patch, label) => void update(item.id, patch, label)}
                onDetach={() =>
                  void update(
                    item.id,
                    { parent_id: null },
                    "Subtask moved to main list",
                  )
                }
              />
            ))}
          </ul>
        ) : (
          <div className={subtasksStyles["subtask-empty"]}>
            {subtaskStatus === "done" ? (
              <CheckCheck size={24} />
            ) : (
              <Feather size={24} />
            )}
            <p>No {STATUS_LABELS[subtaskStatus].toLowerCase()} subtasks.</p>
          </div>
        )}
      </div>

      <form
        className={[
          subtasksStyles["subtask-add-form"],
          subtasksStyles["existing-task-form"],
        ].join(" ")}
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            existingId &&
            (await update(
              existingId,
              { parent_id: taskId },
              "Existing task added as subtask",
            ))
          ) {
            setExistingId("");
          }
        }}
      >
        <label
          className={fieldsStyles["field-label"]}
          htmlFor="existing-subtask"
        >
          Add an existing main-list task as its subtask
        </label>
        <div className={subtasksStyles["subtask-input-row"]}>
          <TaskPicker
            id="existing-subtask"
            candidates={candidates}
            value={existingId}
            onChange={setExistingId}
            disabled={busy}
          />
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
      </form>
    </section>
  );
}
