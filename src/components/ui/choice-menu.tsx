"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import styles from "./choice-menu.module.css";
import menuStyles from "./dropdown-menu.module.css";

export function ChoiceMenu({
  id,
  value,
  options,
  onChange,
  placeholder,
  menuLabel,
  disabled = false,
}: {
  id: string;
  value: string;
  options: { value: string; label: string; description?: string }[];
  onChange(value: string): void;
  placeholder?: string;
  menuLabel: string;
  disabled?: boolean;
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          id={id}
          aria-describedby={`${id}-value`}
          type="button"
          variant="secondary"
          className={styles.trigger}
          disabled={disabled || !options.length}
        >
          <span id={`${id}-value`} className={styles.value}>
            <span className={styles.title}>
              {selected?.label ?? placeholder}
            </span>
            {selected?.description && (
              <span className={styles["trigger-status"]}>
                {selected.description}
              </span>
            )}
          </span>
          <ChevronDown
            className={styles.chevron}
            size={18}
            aria-hidden="true"
          />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(menuStyles["dropdown-content"], styles.content)}
          align="start"
          sideOffset={7}
          collisionPadding={12}
        >
          <DropdownMenu.Label className={styles.label}>
            {menuLabel}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={value} onValueChange={onChange}>
            {options.map((option) => (
              <DropdownMenu.RadioItem
                key={option.value}
                value={option.value}
                textValue={[option.label, option.description]
                  .filter(Boolean)
                  .join(" ")}
                className={cn(
                  menuStyles["dropdown-item"],
                  styles.option,
                  value === option.value && styles.selected,
                )}
              >
                <span className={styles.check} aria-hidden="true">
                  <DropdownMenu.ItemIndicator>
                    <Check size={15} strokeWidth={2.4} />
                  </DropdownMenu.ItemIndicator>
                </span>
                <span className={styles.copy}>
                  <span className={styles.title}>{option.label}</span>
                  {option.description && (
                    <span className={styles.status}>{option.description}</span>
                  )}
                </span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
