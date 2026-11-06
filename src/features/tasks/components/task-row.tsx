"use client";
import rowStyles from "./task-row.module.css";
import menuStyles from "@/components/ui/dropdown-menu.module.css";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Circle,
  Copy,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Pin,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  localDate,
  STATUS_LABELS,
  STATUSES,
  type PinColor,
  type Task,
  type TaskPatch,
} from "../domain/task";

const pinColorClasses: Record<PinColor, string> = {
  olive: rowStyles["pin-olive"],
  berry: rowStyles["pin-berry"],
  sage: rowStyles["pin-sage"],
  slate: rowStyles["pin-slate"],
  cream: rowStyles["pin-cream"],
};

export function TaskRow({
  task,
  busy,
  onEdit,
  onUpdate,
  selection,
  reorderInteraction,
  dragging,
  dragOffsetY,
  justDropped,
  dropPosition,
  shiftDirection,
}: {
  task: Task;
  busy: boolean;
  onEdit(): void;
  onUpdate(patch: TaskPatch, label?: string): void;
  selection?: { selected: boolean; disabled?: boolean; toggle(): void };
  reorderInteraction?: {
    onPointerDown(event: React.PointerEvent<HTMLButtonElement>): void;
    onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>): void;
    consumeClick(): boolean;
  };
  dragging?: boolean;
  dragOffsetY?: number;
  justDropped?: boolean;
  dropPosition?: "before" | "after";
  shiftDirection?: "up" | "down";
}) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  async function copyTitle() {
    try {
      await navigator.clipboard.writeText(task.title);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => {
        setCopied(false);
        copyTimer.current = null;
      }, 1400);
    } catch {
      setCopied(false);
    }
  }
  return (
    <li
      data-task-row
      data-task-id={task.id}
      data-dragging={dragging || undefined}
      data-shift={shiftDirection}
      className={cn(
        rowStyles["task-row"],
        done && rowStyles["task-done"],
        selection && rowStyles["selecting"],
        selection?.selected && rowStyles["task-selected"],
        dragging && rowStyles.dragging,
        justDropped && rowStyles.settled,
        dropPosition === "before" && rowStyles["drop-before"],
        dropPosition === "after" && rowStyles["drop-after"],
        shiftDirection === "up" && rowStyles["shift-up"],
        shiftDirection === "down" && rowStyles["shift-down"],
      )}
      style={
        dragging
          ? ({ "--drag-offset-y": `${dragOffsetY ?? 0}px` } as CSSProperties)
          : undefined
      }
    >
      <div data-task-primary className={rowStyles["task-primary"]}>
        <div className={rowStyles["check-stack"]}>
          <span
            className={cn(
              rowStyles["pin-marker"],
              pinColorClasses[task.pin_color ?? "olive"],
              task.pinned && rowStyles.visible,
            )}
            role={task.pinned ? "img" : undefined}
            aria-label={task.pinned ? "Pinned" : undefined}
            aria-hidden={task.pinned ? undefined : "true"}
          >
            <Pin size={13} fill="currentColor" />
          </span>
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
        </div>
        <button
          className={cn(
            rowStyles["task-copy"],
            reorderInteraction && rowStyles["reorder-surface"],
          )}
          onClick={() => {
            if (reorderInteraction?.consumeClick()) return;
            if (selection) selection.toggle();
            else onEdit();
          }}
          onPointerDown={reorderInteraction?.onPointerDown}
          onKeyDown={reorderInteraction?.onKeyDown}
          onContextMenu={(event) => {
            if (reorderInteraction) event.preventDefault();
          }}
          disabled={busy || selection?.disabled}
          aria-pressed={selection ? selection.selected : undefined}
          aria-label={selection ? `Select ${task.title}` : `Edit ${task.title}`}
          aria-keyshortcuts={
            reorderInteraction ? "Alt+ArrowUp Alt+ArrowDown" : undefined
          }
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
                  <Star size={12} fill="currentColor" /> Today’s focus
                </span>
              )}
            </span>
          )}
        </button>
      </div>
      {!selection && (
        <div data-task-actions className={rowStyles["task-actions"]}>
          {!done && (
            <Button
              variant="secondary"
              size="sm"
              data-advance
              className={rowStyles["advance-button"]}
              aria-label={
                task.status === "todo"
                  ? `Start ${task.title}`
                  : `Finish ${task.title}`
              }
              disabled={busy}
              onClick={() =>
                onUpdate(
                  { status: task.status === "todo" ? "in_progress" : "done" },
                  task.status === "todo" ? "Task started" : "Task completed",
                )
              }
            >
              <span data-advance-label className={rowStyles["advance-label"]}>
                {task.status === "todo" ? "Start" : "Finish"}
              </span>
              {task.status === "todo" ? (
                <ArrowRight size={14} />
              ) : (
                <Check size={14} />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={copied ? "Task title copied" : `Copy ${task.title}`}
            title={copied ? "Copied" : "Copy task title"}
            disabled={busy}
            onClick={() => void copyTitle()}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </Button>
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
                  <Star
                    size={15}
                    fill={task.focus_today ? "currentColor" : "none"}
                  />
                  {task.focus_today
                    ? "Remove from today"
                    : "Focus on this today"}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={menuStyles["dropdown-item"]}
                  onSelect={() =>
                    onUpdate(
                      { pinned: !task.pinned },
                      task.pinned ? "Task unpinned" : "Task pinned",
                    )
                  }
                >
                  <Pin size={15} fill={task.pinned ? "currentColor" : "none"} />
                  {task.pinned ? "Unpin task" : "Pin task"}
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
