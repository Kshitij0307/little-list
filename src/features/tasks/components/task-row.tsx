"use client";
import rowStyles from "./task-row.module.css";
import menuStyles from "@/components/ui/dropdown-menu.module.css";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Circle,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Star,
  Sun,
  Trash2,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  localDate,
  STATUS_LABELS,
  STATUSES,
  type Task,
  type TaskPatch,
} from "../domain/task";

export function TaskRow({
  task,
  busy,
  onEdit,
  onUpdate,
  onDetach,
  selection,
}: {
  task: Task;
  busy: boolean;
  onEdit(): void;
  onUpdate(patch: TaskPatch, label?: string): void;
  onDetach?(): void;
  selection?: { selected: boolean; disabled?: boolean; toggle(): void };
}) {
  const done = task.status === "done";
  const overdue = !!task.due_date && task.due_date < localDate() && !done;
  const dateLabel = task.due_date
    ? task.due_date === localDate()
      ? "Today"
      : new Intl.DateTimeFormat("en", {
          month: "short",
          day: "numeric",
        }).format(new Date(`${task.due_date}T12:00:00`))
    : null;
  return (
    <li
      data-task-row
      className={cn(
        rowStyles["task-row"],
        done && rowStyles["task-done"],
        selection && rowStyles["selecting"],
        selection?.selected && rowStyles["task-selected"],
      )}
    >
      <button
        className={rowStyles["task-check"]}
        role={selection ? "checkbox" : undefined}
        aria-checked={selection ? selection.selected : undefined}
        aria-label={
          selection
            ? `Select ${task.title}`
            : done
              ? `Reopen ${task.title}`
              : `Complete ${task.title}`
        }
        disabled={busy || selection?.disabled}
        onClick={() =>
          selection
            ? selection.toggle()
            : onUpdate(
                { status: done ? "todo" : "done" },
                done ? "Task reopened" : "Task completed",
              )
        }
      >
        <span className={rowStyles["check-icon"]} aria-hidden="true">
          {(selection ? selection.selected : done) ? (
            <Check size={18} strokeWidth={2.2} />
          ) : (
            <Circle size={22} strokeWidth={1.3} />
          )}
        </span>
      </button>
      <button
        className={rowStyles["task-copy"]}
        onClick={() => (selection ? selection.toggle() : onEdit())}
        disabled={busy || selection?.disabled}
        aria-pressed={selection ? selection.selected : undefined}
        aria-label={selection ? `Select ${task.title}` : `Edit ${task.title}`}
      >
        <span className={rowStyles["task-title"]}>{task.title}</span>
        {task.notes && (
          <span className={rowStyles["task-note"]}>{task.notes}</span>
        )}
        {(dateLabel || task.focus_today) && (
          <span className={rowStyles["task-meta"]}>
            {dateLabel && (
              <span
                className={cn(
                  rowStyles["date-badge"],
                  overdue && rowStyles["overdue"],
                )}
              >
                <CalendarDays size={12} />
                {overdue ? "Overdue · " : ""}
                {dateLabel}
              </span>
            )}
            {task.focus_today && !done && (
              <span>
                <Sun size={12} /> Today’s focus
              </span>
            )}
          </span>
        )}
      </button>
      {!selection && (
        <div data-task-actions className={rowStyles["task-actions"]}>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              rowStyles["star-button"],
              task.starred && rowStyles["is-starred"],
            )}
            aria-label={
              task.starred ? `Unstar ${task.title}` : `Star ${task.title}`
            }
            aria-pressed={task.starred}
            disabled={busy}
            onClick={() =>
              onUpdate(
                { starred: !task.starred },
                task.starred ? "Star removed" : "Task starred",
              )
            }
          >
            <Star size={17} fill={task.starred ? "currentColor" : "none"} />
          </Button>
          {!done && (
            <Button
              variant="secondary"
              size="sm"
              data-advance
              className={rowStyles["advance-button"]}
              disabled={busy}
              onClick={() =>
                onUpdate(
                  { status: task.status === "todo" ? "in_progress" : "done" },
                  task.status === "todo" ? "Task started" : "Task completed",
                )
              }
            >
              {task.status === "todo" ? "Start" : "Finish"}
              {task.status === "todo" ? (
                <ArrowRight size={14} />
              ) : (
                <Check size={14} />
              )}
            </Button>
          )}
          {onDetach && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Move ${task.title} to main list`}
              title="Move to main list"
              disabled={busy}
              onClick={onDetach}
            >
              <Unlink size={16} />
            </Button>
          )}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`More options for ${task.title}`}
                disabled={busy}
              >
                <MoreHorizontal size={19} />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className={menuStyles["dropdown-content"]}
                align="end"
                sideOffset={6}
              >
                <DropdownMenu.Item
                  className={menuStyles["dropdown-item"]}
                  onSelect={onEdit}
                >
                  <Pencil size={15} />
                  Edit details
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={menuStyles["dropdown-item"]}
                  onSelect={() =>
                    onUpdate(
                      { focus_today: !task.focus_today },
                      "Focus updated",
                    )
                  }
                >
                  <Sun size={15} />
                  {task.focus_today
                    ? "Remove from today"
                    : "Focus on this today"}
                </DropdownMenu.Item>
                <DropdownMenu.Separator
                  className={menuStyles["dropdown-separator"]}
                />
                <DropdownMenu.Label className={menuStyles["dropdown-label"]}>
                  Move to
                </DropdownMenu.Label>
                {STATUSES.filter((status) => status !== task.status).map(
                  (status) => (
                    <DropdownMenu.Item
                      key={status}
                      className={menuStyles["dropdown-item"]}
                      onSelect={() =>
                        onUpdate(
                          { status },
                          `Moved to ${STATUS_LABELS[status]}`,
                        )
                      }
                    >
                      {status === "done" ? (
                        <Check size={15} />
                      ) : status === "todo" ? (
                        <RotateCcw size={15} />
                      ) : (
                        <ArrowRight size={15} />
                      )}
                      {STATUS_LABELS[status]}
                    </DropdownMenu.Item>
                  ),
                )}
                <DropdownMenu.Separator
                  className={menuStyles["dropdown-separator"]}
                />
                <DropdownMenu.Item
                  className={[
                    menuStyles["dropdown-item"],
                    menuStyles["destructive"],
                  ].join(" ")}
                  onSelect={() =>
                    onUpdate(
                      { deleted_at: new Date().toISOString() },
                      "Task deleted",
                    )
                  }
                >
                  <Trash2 size={15} />
                  Delete task
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      )}
    </li>
  );
}
