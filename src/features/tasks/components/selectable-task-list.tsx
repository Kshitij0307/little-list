"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
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

let touchDragLockCount = 0;

function lockTouchSelection() {
  touchDragLockCount += 1;
  document.documentElement.classList.add("task-drag-lock");
}

function unlockTouchSelection() {
  touchDragLockCount = Math.max(0, touchDragLockCount - 1);
  if (!touchDragLockCount)
    document.documentElement.classList.remove("task-drag-lock");
}

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
  reorderEnabled = true,
}: {
  tasks: Task[];
  status: TaskStatus;
  parentId?: string | null;
  className: string;
  onOpenTask(id: string): void;
  children: ReactNode;
  selection: TaskSelection;
  externalTrigger?: boolean;
  reorderEnabled?: boolean;
}) {
  const { busy, update, move, remove, reorder } = useTaskContext();
  const { active, ids, selected, allSelected, target, chooseTarget } =
    selection;
  const [pending, setPending] = useState<"move" | "delete" | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    id: string;
    pointerId: number;
    pointerType: string;
    startX: number;
    startY: number;
    centerOffsetY: number;
    active: boolean;
    timer: ReturnType<typeof setTimeout> | null;
    positions: { id: string; top: number; height: number }[];
  } | null>(null);
  const drop = useRef<{ position: number } | null>(null);
  const suppressClick = useRef(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [settledId, setSettledId] = useState<string | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dropPosition, setDropPosition] = useState<number | null>(null);
  const idPrefix = parentId ? "subtask" : "task";

  useEffect(
    () => () => {
      if (drag.current?.timer) clearTimeout(drag.current.timer);
      if (drag.current?.pointerType === "touch") unlockTouchSelection();
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  function resetDrag() {
    if (drag.current?.timer) clearTimeout(drag.current.timer);
    if (drag.current?.pointerType === "touch") unlockTouchSelection();
    drag.current = null;
    drop.current = null;
    setDraggingId(null);
    setDragOffsetY(0);
    setDropPosition(null);
  }

  function snapshotPositions(id: string) {
    const dragged = tasks.find((task) => task.id === id);
    if (!dragged) return [];
    return tasks
      .filter((task) => task.id !== id && task.pinned === dragged.pinned)
      .flatMap((task) => {
        const row = document.querySelector<HTMLElement>(
          `[data-task-id="${task.id}"]`,
        );
        if (!row) return [];
        const rect = row.getBoundingClientRect();
        return [
          {
            id: task.id,
            top: rect.top + window.scrollY,
            height: rect.height,
          },
        ];
      });
  }

  function savePosition(id: string, position: number) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return false;
    const group = tasks.filter((item) => item.pinned === task.pinned);
    const source = group.findIndex((item) => item.id === id);
    const ordered = group.filter((item) => item.id !== id);
    if (source < 0 || position === source) return false;
    ordered.splice(position, 0, task);
    const index = ordered.findIndex((item) => item.id === id);
    void reorder({
      id,
      before_id: ordered[index - 1]?.id ?? null,
      after_id: ordered[index + 1]?.id ?? null,
      status,
      parent_id: parentId,
      pinned: task.pinned,
    });
    return true;
  }

  function moveByKey(id: string, key: string) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const group = tasks.filter((item) => item.pinned === task.pinned);
    const index = group.findIndex((item) => item.id === id);
    const target = index + (key === "ArrowUp" ? -1 : 1);
    if (target < 0 || target >= group.length) return;
    savePosition(id, target);
  }

  function trackPointer(event: PointerEvent<HTMLUListElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const distance = Math.hypot(
      event.clientX - drag.current.startX,
      event.clientY - drag.current.startY,
    );
    if (!drag.current.active) {
      if (drag.current.pointerType === "touch") {
        if (distance > 8) resetDrag();
        return;
      }
      if (distance < 4) return;
      drag.current.positions = snapshotPositions(drag.current.id);
      drag.current.active = true;
      suppressClick.current = true;
      setDraggingId(drag.current.id);
    }
    if (drag.current.pointerType === "touch") event.preventDefault();
    setDragOffsetY(event.clientY - drag.current.startY);
    if (event.clientY < 64) window.scrollBy(0, -14);
    else if (event.clientY > window.innerHeight - 64) window.scrollBy(0, 14);
    const draggedCenterY =
      event.clientY + window.scrollY + drag.current.centerOffsetY;
    if (!drag.current.positions.length) {
      drop.current = null;
      setDropPosition(null);
      return;
    }
    const position = drag.current.positions.filter(
      (item) => draggedCenterY >= item.top + item.height / 2,
    ).length;
    drop.current = { position };
    setDropPosition(position);
  }

  function finishDrag(event: PointerEvent<HTMLUListElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    if (drag.current.active && drop.current) {
      if (savePosition(drag.current.id, drop.current.position)) {
        setSettledId(drag.current.id);
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => {
          setSettledId(null);
          settleTimer.current = null;
        }, 480);
      }
    }
    resetDrag();
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }
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
  const draggedTask = draggingId
    ? tasks.find((task) => task.id === draggingId)
    : undefined;
  const dragGroup = draggedTask
    ? tasks.filter((task) => task.pinned === draggedTask.pinned)
    : [];
  const draggingIndex = draggedTask
    ? dragGroup.findIndex((task) => task.id === draggedTask.id)
    : -1;
  const remainingDragGroup = dragGroup.filter((task) => task.id !== draggingId);
  const indicatorTarget =
    dropPosition === null
      ? null
      : dropPosition < remainingDragGroup.length
        ? {
            id: remainingDragGroup[dropPosition].id,
            position: "before" as const,
          }
        : remainingDragGroup.length
          ? {
              id: remainingDragGroup.at(-1)!.id,
              position: "after" as const,
            }
          : null;
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
        <ul
          className={[className, draggingId && styles["dragging-list"]]
            .filter(Boolean)
            .join(" ")}
          onPointerMove={trackPointer}
          onPointerUp={finishDrag}
          onPointerCancel={() => {
            resetDrag();
            suppressClick.current = false;
          }}
        >
          {tasks.map((task) => {
            const taskDragIndex = dragGroup.findIndex(
              (item) => item.id === task.id,
            );
            return (
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
                dragging={draggingId === task.id}
                dragOffsetY={draggingId === task.id ? dragOffsetY : 0}
                justDropped={settledId === task.id}
                dropPosition={
                  indicatorTarget?.id === task.id
                    ? indicatorTarget.position
                    : undefined
                }
                shiftDirection={
                  draggingIndex >= 0 &&
                  dropPosition !== null &&
                  dropPosition > draggingIndex &&
                  taskDragIndex > draggingIndex &&
                  taskDragIndex <= dropPosition
                    ? "up"
                    : draggingIndex >= 0 &&
                        dropPosition !== null &&
                        dropPosition < draggingIndex &&
                        taskDragIndex >= dropPosition &&
                        taskDragIndex < draggingIndex
                      ? "down"
                      : undefined
                }
                reorderInteraction={
                  reorderEnabled &&
                  !active &&
                  tasks.filter((item) => item.pinned === task.pinned).length > 1
                    ? {
                        onPointerDown: (event) => {
                          if (busy || event.button !== 0) return;
                          const rowRect = event.currentTarget
                            .closest("[data-task-row]")
                            ?.getBoundingClientRect();
                          const activate = () => {
                            if (!drag.current) return;
                            drag.current.positions = snapshotPositions(task.id);
                            drag.current.active = true;
                            drag.current.timer = null;
                            suppressClick.current = true;
                            setDraggingId(task.id);
                          };
                          drag.current = {
                            id: task.id,
                            pointerId: event.pointerId,
                            pointerType: event.pointerType,
                            startX: event.clientX,
                            startY: event.clientY,
                            centerOffsetY:
                              (rowRect?.top ?? event.clientY) +
                              (rowRect?.height ?? 0) / 2 -
                              event.clientY,
                            active: false,
                            positions: [],
                            timer:
                              event.pointerType === "touch"
                                ? setTimeout(activate, 360)
                                : null,
                          };
                          if (event.pointerType === "touch")
                            lockTouchSelection();
                          event.currentTarget.setPointerCapture(
                            event.pointerId,
                          );
                        },
                        onKeyDown: (event) => {
                          if (
                            busy ||
                            !event.altKey ||
                            !["ArrowUp", "ArrowDown"].includes(event.key)
                          )
                            return;
                          event.preventDefault();
                          moveByKey(task.id, event.key);
                        },
                        consumeClick: () => {
                          if (!suppressClick.current) return false;
                          suppressClick.current = false;
                          return true;
                        },
                      }
                    : undefined
                }
              />
            );
          })}
        </ul>
      ) : (
        children
      )}
    </div>
  );
}
