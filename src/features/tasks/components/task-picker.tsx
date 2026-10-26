"use client";
import { ChoiceMenu } from "@/components/ui/choice-menu";
import { STATUS_LABELS, type Task } from "../domain/task";

export function TaskPicker({
  id,
  candidates,
  value,
  onChange,
  disabled,
}: {
  id: string;
  candidates: Task[];
  value: string;
  onChange(value: string): void;
  disabled: boolean;
}) {
  return (
    <ChoiceMenu
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      menuLabel="Available main-list tasks"
      placeholder={
        candidates.length ? "Choose a task…" : "No other tasks available"
      }
      options={candidates.map((task) => ({
        value: task.id,
        label: task.title,
        description: STATUS_LABELS[task.status],
      }))}
    />
  );
}
