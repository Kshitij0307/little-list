"use client";

import { useRef, useState, type ReactNode } from "react";
import { ListChecks, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChoiceMenu } from "@/components/ui/choice-menu";
import { MAX_BATCH_TASKS } from "../domain/task-batch";
import {
  STATUSES,
  STATUS_LABELS,
  type Task,
  type TaskStatus,
} from "../domain/task";
import { useTaskContext } from "../hooks/tasks-provider";
import type { TaskSelection } from "../hooks/use-task-selection";
import { TaskRow } from "./task-row";
import styles from "./selectable-task-list.module.css";

export function TaskSelectionToggle({
  selection,
  disabled,
  idPrefix,
}: {
  selection: TaskSelection;
  disabled: boolean;
  idPrefix: string;
}) {
  return (
    <Button
      id={`${idPrefix}-selection-toggle`}
      type="button"
      variant="ghost"
      size="sm"
      className={styles.toggle}
      aria-pressed={selection.active}
      aria-controls={`${idPrefix}-panel`}
      disabled={disabled}
      onClick={() => {
        if (selection.active) selection.clear();
        else {
          selection.start();
          requestAnimationFrame(() =>
            document
              .getElementById(`${idPrefix}-panel`)
              ?.querySelector<HTMLButtonElement>('[role="checkbox"]')
              ?.focus(),
          );
        }
      }}
    >
      <ListChecks size={16} /> Select tasks
    </Button>
  );
}

export function SelectableTaskList({
  tasks,
  status,
  parentId = null,
  className,
  onOpenTask,
  children,
  selection,
  externalTrigger = false,
}: {
  tasks: Task[];
  status: TaskStatus;
  parentId?: string | null;
  className: string;
  onOpenTask(id: string): void;
  children: ReactNode;
  selection: TaskSelection;
  externalTrigger?: boolean;
}) {
  const { busy, update, move, remove } = useTaskContext();
  const { active, ids, selected, allSelected, target, chooseTarget } =
    selection;
  const [pending, setPending] = useState<"move" | "delete" | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const idPrefix = parentId ? "subtask" : "task";
  function finish() {
    if (!container.current) return;
    selection.clear();
    requestAnimationFrame(() => {
      if (!container.current) return;
      const trigger = document.getElementById(
        `${idPrefix}-selection-toggle`,
      ) as HTMLButtonElement | null;
      (trigger && !trigger.disabled
        ? trigger
        : document.getElementById(`${idPrefix}-tab-${status}`)
      )?.focus();
    });
  }
  async function act(action: "move" | "delete") {
    setPending(action);
    const scope = {
      ids: selected.map((task) => task.id),
      from_status: status,
      parent_id: parentId,
    };
    try {
      const succeeded =
        action === "move"
          ? await move({ ...scope, to_status: target as TaskStatus })
          : await remove({
              ...scope,
              deleted_at: new Date().toISOString(),
              restore: false,
            });
      if (succeeded) finish();
    } finally {
      setPending(null);
    }
  }
  return (
    <div ref={container} className={parentId ? undefined : styles.main}>
      {active ? (
        <div className={styles.toolbar}>
          <div className={styles.summary}>
            <span className={styles.count} role="status">
              <ListChecks size={16} /> {pending ? ids.length : selected.length}{" "}
              selected
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || !tasks.length}
              onClick={selection.toggleAll}
            >
              {allSelected
                ? "Deselect all"
                : tasks.length > MAX_BATCH_TASKS
                  ? "Select first 500"
                  : "Select all"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={finish}
            >
              Cancel
            </Button>
          </div>
          <div className={styles.actions}>
            <div className={styles.destination}>
              <ChoiceMenu
                id={`${idPrefix}-bulk-status`}
                menuLabel="Move selected tasks to"
                placeholder="Move to…"
                value={target}
                disabled={busy || !selected.length}
                onChange={chooseTarget}
                options={STATUSES.filter((value) => value !== status).map(
                  (value) => ({ value, label: STATUS_LABELS[value] }),
                )}
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={busy || !selected.length || !target}
              onClick={() => void act("move")}
            >
              {pending === "move" ? "Moving…" : "Move selected"}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              className={styles.delete}
              disabled={busy || !selected.length}
              onClick={() => void act("delete")}
            >
              <Trash2 size={15} />{" "}
              {pending === "delete" ? "Deleting…" : "Delete selected"}
            </Button>
          </div>
        </div>
      ) : (
        !externalTrigger &&
        tasks.length > 0 && (
          <div className={styles.standalone}>
            <TaskSelectionToggle
              selection={selection}
              disabled={busy}
              idPrefix={idPrefix}
            />
          </div>
        )
      )}
      {tasks.length ? (
        <ul className={className}>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              busy={busy}
              onEdit={() => onOpenTask(task.id)}
              onUpdate={(patch, label) => void update(task.id, patch, label)}
              selection={
                active
                  ? {
                      selected: ids.includes(task.id),
                      disabled:
                        !ids.includes(task.id) &&
                        selected.length >= MAX_BATCH_TASKS,
                      toggle: () => selection.toggle(task.id),
                    }
                  : undefined
              }
            />
          ))}
        </ul>
      ) : (
        children
      )}
    </div>
  );
}
