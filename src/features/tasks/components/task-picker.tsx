"use client";
import pickerStyles from "./task-picker.module.css";
import menuStyles from "@/components/ui/dropdown-menu.module.css";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  const selectedCandidate = candidates.find((item) => item.id === value);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          id={id}
          type="button"
          variant="secondary"
          className={pickerStyles["task-picker-trigger"]}
          disabled={disabled || !candidates.length}
        >
          <span className={pickerStyles["task-picker-value"]}>
            <span className={pickerStyles["task-picker-title"]}>
              {selectedCandidate
                ? selectedCandidate.title
                : candidates.length
                  ? "Choose a task…"
                  : "No other tasks available"}
            </span>
            {selectedCandidate && (
              <span className={pickerStyles["task-picker-trigger-status"]}>
                {STATUS_LABELS[selectedCandidate.status]}
              </span>
            )}
          </span>
          <ChevronDown
            className={pickerStyles["task-picker-chevron"]}
            size={18}
            aria-hidden="true"
          />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={[
            menuStyles["dropdown-content"],
            pickerStyles["task-picker-content"],
          ].join(" ")}
          align="start"
          sideOffset={7}
          collisionPadding={12}
        >
          <DropdownMenu.Label className={pickerStyles["task-picker-label"]}>
            Available main-list tasks
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={value} onValueChange={onChange}>
            {candidates.map((item) => (
              <DropdownMenu.RadioItem
                key={item.id}
                value={item.id}
                textValue={`${item.title} ${STATUS_LABELS[item.status]}`}
                className={cn(
                  menuStyles["dropdown-item"],
                  pickerStyles["task-picker-option"],
                  value === item.id && pickerStyles["selected"],
                )}
              >
                <span
                  className={pickerStyles["task-picker-check"]}
                  aria-hidden="true"
                >
                  <DropdownMenu.ItemIndicator>
                    <Check size={15} strokeWidth={2.4} />
                  </DropdownMenu.ItemIndicator>
                </span>
                <span className={pickerStyles["task-picker-copy"]}>
                  <span className={pickerStyles["task-picker-title"]}>
                    {item.title}
                  </span>
                  <span className={pickerStyles["task-picker-status"]}>
                    {STATUS_LABELS[item.status]}
                  </span>
                </span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
