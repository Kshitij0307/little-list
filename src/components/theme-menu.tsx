"use client";
import themeStyles from "./theme-menu.module.css";
import menuStyles from "./ui/dropdown-menu.module.css";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";

export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Choose color theme">
          <Sun size={18} className={themeStyles["theme-sun"]} />
          <Moon size={18} className={themeStyles["theme-moon"]} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={menuStyles["dropdown-content"]}
          align="end"
          sideOffset={8}
        >
          <DropdownMenu.Label className={menuStyles["dropdown-label"]}>
            Appearance
          </DropdownMenu.Label>
          {[
            { value: "light", label: "Light", Icon: Sun },
            { value: "dark", label: "Dark", Icon: Moon },
            { value: "system", label: "System", Icon: Monitor },
          ].map(({ value, label, Icon }) => (
            <DropdownMenu.Item
              key={value}
              className={menuStyles["dropdown-item"]}
              onSelect={() => setTheme(value)}
            >
              <Icon size={16} />
              {label}
              {theme === value && (
                <Check size={15} className={themeStyles["theme-check"]} />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
