"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import styles from "./task-detail.module.css";

const STORAGE_KEY = "little-list.task-detail-width.v1";
const DEFAULT_WIDTH = 42;
const MIN_PANEL_WIDTH = 320;
const DIVIDER_WIDTH = 12;

function widthBounds(containerWidth: number) {
  const minimum = Math.max(25, (MIN_PANEL_WIDTH / containerWidth) * 100);
  const maximum = Math.min(
    75,
    ((containerWidth - MIN_PANEL_WIDTH - DIVIDER_WIDTH) / containerWidth) * 100,
  );
  return { minimum, maximum };
}

export function TaskDetailPanels({
  details,
  subtasks,
}: {
  details: ReactNode;
  subtasks: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const [detailsWidth, setDetailsWidth] = useState(DEFAULT_WIDTH);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = Number(window.localStorage.getItem(STORAGE_KEY));
        if (saved >= 25 && saved <= 75) setDetailsWidth(saved);
      } catch {
        // Resizing still works when browser storage is unavailable.
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(detailsWidth));
    } catch {
      // Keep the current width for this visit.
    }
  }, [detailsWidth, ready]);

  function resize(clientX: number) {
    const rect = container.current?.getBoundingClientRect();
    if (!rect?.width) return;
    const { minimum, maximum } = widthBounds(rect.width);
    setDetailsWidth(
      Math.min(
        maximum,
        Math.max(minimum, ((clientX - rect.left) / rect.width) * 100),
      ),
    );
  }

  function step(key: string) {
    const width = container.current?.getBoundingClientRect().width;
    if (!width) return;
    const { minimum, maximum } = widthBounds(width);
    if (key === "Home") setDetailsWidth(minimum);
    else if (key === "End") setDetailsWidth(maximum);
    else if (key === "ArrowLeft")
      setDetailsWidth((current) => Math.max(minimum, current - 5));
    else if (key === "ArrowRight")
      setDetailsWidth((current) => Math.min(maximum, current + 5));
  }

  return (
    <div
      ref={container}
      className={styles["task-detail-content"]}
      style={{ "--details-width": `${detailsWidth}%` } as CSSProperties}
    >
      <div id="task-details-panel" className={styles["details-panel"]}>
        {details}
      </div>
      <div
        role="separator"
        aria-label="Resize task details and subtasks"
        aria-orientation="vertical"
        aria-controls="task-details-panel"
        aria-valuemin={25}
        aria-valuemax={75}
        aria-valuenow={Math.round(detailsWidth)}
        tabIndex={0}
        className={styles["panel-divider"]}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragging.current = event.pointerId;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          event.currentTarget.focus();
          resize(event.clientX);
        }}
        onPointerMove={(event) => {
          if (dragging.current === event.pointerId) resize(event.clientX);
        }}
        onPointerUp={(event) => {
          if (dragging.current !== event.pointerId) return;
          resize(event.clientX);
          dragging.current = null;
          if (event.currentTarget.hasPointerCapture?.(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          dragging.current = null;
        }}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          step(event.key);
        }}
        onDoubleClick={() => setDetailsWidth(DEFAULT_WIDTH)}
      >
        <span aria-hidden="true" className={styles["divider-grip"]} />
      </div>
      <div id="task-subtasks-panel" className={styles["subtasks-panel"]}>
        {subtasks}
      </div>
    </div>
  );
}
