"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import styles from "./date-picker.module.css";

type DatePickerProps = {
  id: string;
  labelId: string;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
};

type CalendarPosition = { top: number; left: number; width: number };

const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "long",
});

function parseDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

function toDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getCalendarDays(month: Date): (Date | null)[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const cells: (Date | null)[] = Array.from({ length: firstDay }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DatePicker({
  id,
  labelId,
  value,
  onChange,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [calendarPosition, setCalendarPosition] =
    useState<CalendarPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const selectedDate = parseDate(value);
  const days = getCalendarDays(visibleMonth);
  const todayValue = toDateValue(new Date());

  useEffect(() => {
    if (!open) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !calendarRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setCalendarPosition(null);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    function positionCalendar() {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const calendar = calendarRef.current;
      if (!trigger || !calendar) return;

      const edge = 12;
      const gap = 8;
      const boundary = rootRef.current
        ?.closest<HTMLElement>("[data-overlay-boundary]")
        ?.getBoundingClientRect();
      const boundaryLeft = Math.max(edge, boundary?.left ?? edge);
      const boundaryRight = Math.min(
        window.innerWidth - edge,
        boundary?.right ?? window.innerWidth - edge,
      );
      const left = Math.max(boundaryLeft + edge, trigger.left);
      const width = Math.max(0, Math.min(304, boundaryRight - left - edge));
      const height = calendar.getBoundingClientRect().height;
      const spaceBelow = window.innerHeight - trigger.bottom;
      const spaceAbove = trigger.top;
      const opensBelow = spaceBelow >= height + gap || spaceBelow >= spaceAbove;
      const preferredTop = opensBelow
        ? trigger.bottom + gap
        : trigger.top - height - gap;
      const top = Math.max(
        edge,
        Math.min(preferredTop, window.innerHeight - height - edge),
      );
      setCalendarPosition({ top, left, width });
    }

    positionCalendar();
    window.addEventListener("resize", positionCalendar);
    window.addEventListener("scroll", positionCalendar, true);
    const boundary = rootRef.current?.closest<HTMLElement>(
      "[data-overlay-boundary]",
    );
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(positionCalendar);
    if (boundary) observer?.observe(boundary);
    if (triggerRef.current) observer?.observe(triggerRef.current);
    return () => {
      window.removeEventListener("resize", positionCalendar);
      window.removeEventListener("scroll", positionCalendar, true);
      observer?.disconnect();
    };
  }, [open, visibleMonth]);

  function showCalendar() {
    const baseDate = selectedDate ?? new Date();
    setVisibleMonth(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
    setCalendarPosition(null);
    setOpen((current) => !current);
  }

  function shiftMonth(amount: number) {
    setVisibleMonth(
      (month) => new Date(month.getFullYear(), month.getMonth() + amount, 1),
    );
  }

  function chooseDate(date: Date) {
    onChange(toDateValue(date));
    setOpen(false);
    setCalendarPosition(null);
    triggerRef.current?.focus();
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={styles.trigger}
        aria-labelledby={labelId}
        aria-haspopup="dialog"
        aria-controls={`${id}-calendar`}
        aria-expanded={open}
        disabled={disabled}
        onClick={showCalendar}
      >
        <CalendarDays size={16} aria-hidden="true" />
        <span className={selectedDate ? styles.selected : styles.placeholder}>
          {selectedDate ? dateFormatter.format(selectedDate) : "Choose a date…"}
        </span>
        <ChevronRight
          className={styles.indicator}
          size={15}
          aria-hidden="true"
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={calendarRef}
            id={`${id}-calendar`}
            className={styles.calendar}
            role="dialog"
            aria-label="Choose due date"
            style={{
              top: calendarPosition?.top ?? 0,
              left: calendarPosition?.left ?? 0,
              width: calendarPosition?.width ?? 304,
              visibility: calendarPosition ? "visible" : "hidden",
            }}
          >
            <div className={styles.header}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={styles.navButton}
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
              >
                <ChevronLeft size={17} />
              </Button>
              <p aria-live="polite">{monthFormatter.format(visibleMonth)}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={styles.navButton}
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
              >
                <ChevronRight size={17} />
              </Button>
            </div>
            <div className={styles.grid}>
              {weekdays.map((weekday) => (
                <span className={styles.weekday} key={weekday}>
                  {weekday}
                </span>
              ))}
              {days.map((date, index) => {
                if (!date) {
                  return (
                    <span className={styles.emptyDay} key={`empty-${index}`} />
                  );
                }

                const dateValue = toDateValue(date);
                const isSelected = dateValue === value;
                const isToday = dateValue === todayValue;
                return (
                  <button
                    type="button"
                    key={dateValue}
                    className={[
                      styles.day,
                      isSelected ? styles.selectedDay : "",
                      isToday ? styles.today : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-label={dateFormatter.format(date)}
                    aria-pressed={isSelected}
                    onClick={() => chooseDate(date)}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
            <div className={styles.footer}>
              {value ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                    setCalendarPosition(null);
                    triggerRef.current?.focus();
                  }}
                >
                  Clear date
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => chooseDate(new Date())}
              >
                Today
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
