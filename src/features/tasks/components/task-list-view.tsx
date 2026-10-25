"use client";
import listStyles from "./task-list-view.module.css";
import feedbackStyles from "@/components/ui/feedback.module.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCheck,
  Feather,
  LoaderCircle,
  Plus,
  Search,
  Sun,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mainTasks, sortTasks, type TaskStatus } from "../domain/task";
import { useTaskContext } from "../hooks/tasks-provider";
import { TaskRow } from "./task-row";
import { TaskStatusTabs } from "./task-status-tabs";
import { TaskErrorBanner } from "./task-error-banner";
const TAB_NOTES: Record<TaskStatus, string> = {
  todo: "A little space for what’s next.",
  in_progress: "One step at a time. You’re making progress.",
  done: "Small wins, well earned.",
};

export function TaskListView() {
  const router = useRouter();
  const {
    tasks,
    loading,
    busy,
    error,
    create,
    update,
    listFilters,
    setListFilters,
  } = useTaskContext();
  const { status, query, focusToday } = listFilters;
  const changeFilters = (patch: Partial<typeof listFilters>) =>
    setListFilters((filters) => ({ ...filters, ...patch }));
  const [draft, setDraft] = useState("");
  const addInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            "input, textarea, select, [contenteditable=true], [role=menu], [role=dialog]",
          ))
      )
        return;
      if (event.key === "/") {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        addInput.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const roots = mainTasks(tasks);
  const visible = sortTasks(
    roots.filter(
      (task) =>
        task.status === status &&
        (!focusToday || task.focus_today) &&
        `${task.title} ${task.notes}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    ),
    status,
  );

  return (
    <>
      <form
        className={listStyles["quick-add"]}
        onSubmit={async (event) => {
          event.preventDefault();
          if (await create(draft)) {
            setDraft("");
            changeFilters({ status: "todo", query: "", focusToday: false });
            addInput.current?.focus();
          }
        }}
      >
        <Plus size={21} strokeWidth={1.5} className={listStyles["add-icon"]} />
        <input
          ref={addInput}
          aria-label="New task title"
          placeholder="What’s on your mind?"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          required
          disabled={loading || busy || (!!error && !tasks.length)}
        />
        <kbd className={listStyles["enter-hint"]}>↵</kbd>
        <Button type="submit" disabled={!draft.trim() || loading || busy}>
          Add task <Plus size={16} />
        </Button>
      </form>
      <div className={listStyles["list-controls"]}>
        <TaskStatusTabs
          value={status}
          onChange={(status) => changeFilters({ status })}
          tasks={roots}
          idPrefix="task"
          label="Task status"
        />
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            listStyles["focus-filter"],
            focusToday && listStyles["selected"],
          )}
          aria-pressed={focusToday}
          onClick={() => changeFilters({ focusToday: !focusToday })}
        >
          <Sun size={15} />
          Focus today
        </Button>
      </div>
      <div className={listStyles["list-subheader"]}>
        <p>{TAB_NOTES[status]}</p>
        <div className={listStyles["search-box"]}>
          <Search size={15} />
          <input
            ref={searchInput}
            aria-label="Search tasks"
            placeholder="Find a task…"
            value={query}
            onChange={(e) => changeFilters({ query: e.target.value })}
          />
          {query ? (
            <button
              onClick={() => changeFilters({ query: "" })}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </div>
      </div>

      <TaskErrorBanner />
      <div
        role="tabpanel"
        id="task-panel"
        aria-labelledby={`task-tab-${status}`}
        className={listStyles["task-panel"]}
        tabIndex={0}
      >
        {loading ? (
          <div className={feedbackStyles["empty-state"]}>
            <LoaderCircle className={feedbackStyles["spin"]} size={25} />
            <h2>Opening your notebook…</h2>
          </div>
        ) : visible.length ? (
          <ul className={listStyles["task-list"]}>
            {visible.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                busy={busy}
                onEdit={() => router.push(`/tasks/${task.id}`)}
                onUpdate={(patch, label) => void update(task.id, patch, label)}
              />
            ))}
          </ul>
        ) : (
          <div className={feedbackStyles["empty-state"]}>
            <span className={feedbackStyles["empty-icon"]}>
              {status === "done" ? (
                <CheckCheck size={30} strokeWidth={1.3} />
              ) : focusToday ? (
                <Sun size={30} strokeWidth={1.3} />
              ) : (
                <Feather size={30} strokeWidth={1.3} />
              )}
            </span>
            <h2>
              {error
                ? "Your list is waiting."
                : query
                  ? "Nothing by that name."
                  : focusToday
                    ? "Choose a little focus."
                    : status === "todo"
                      ? "Good things start with a little list."
                      : status === "in_progress"
                        ? "Ready when you are."
                        : "Your wins will live here."}
            </h2>
            <p>
              {error
                ? "Retry to load your saved tasks."
                : query
                  ? "Try another search or check the other tabs."
                  : focusToday
                    ? "Open a task’s menu to add it to today’s focus."
                    : status === "todo"
                      ? "Add your first task above. Big plans or small errands—all welcome."
                      : status === "in_progress"
                        ? "Hit Start on a task in Todo to give it your attention."
                        : "Complete a task and take a moment to enjoy the progress."}
            </p>
            {!query && !focusToday && status !== "todo" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => changeFilters({ status: "todo" })}
              >
                Back to Todo <ArrowRight size={14} />
              </Button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
