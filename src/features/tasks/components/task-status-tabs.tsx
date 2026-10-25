"use client";
import tabsStyles from "./task-status-tabs.module.css";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import {
  STATUSES,
  STATUS_LABELS,
  type Task,
  type TaskStatus,
} from "../domain/task";

export function TaskStatusTabs({
  value,
  onChange,
  tasks,
  idPrefix,
  label,
}: {
  value: TaskStatus;
  onChange(status: TaskStatus): void;
  tasks: Task[];
  idPrefix: string;
  label: string;
}) {
  const buttons = useRef<Partial<Record<TaskStatus, HTMLButtonElement | null>>>(
    {},
  );
  return (
    <div
      className={tabsStyles["status-tabs"]}
      role="tablist"
      aria-label={label}
    >
      {STATUSES.map((status, index) => (
        <button
          key={status}
          ref={(button) => {
            buttons.current[status] = button;
          }}
          id={`${idPrefix}-tab-${status}`}
          type="button"
          role="tab"
          aria-controls={`${idPrefix}-panel`}
          aria-selected={value === status}
          tabIndex={value === status ? 0 : -1}
          className={cn(
            tabsStyles["status-tab"],
            value === status && tabsStyles["active"],
          )}
          onClick={() => onChange(status)}
          onKeyDown={(event) => {
            const nextIndex =
              event.key === "ArrowRight"
                ? (index + 1) % STATUSES.length
                : event.key === "ArrowLeft"
                  ? (index + STATUSES.length - 1) % STATUSES.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? STATUSES.length - 1
                      : null;
            if (nextIndex === null) return;
            event.preventDefault();
            const next = STATUSES[nextIndex];
            onChange(next);
            buttons.current[next]?.focus();
          }}
        >
          {STATUS_LABELS[status]}
          <span className={tabsStyles["tab-count"]}>
            {tasks.filter((task) => task.status === status).length}
          </span>
        </button>
      ))}
    </div>
  );
}
