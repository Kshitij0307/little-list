"use client";
import listStyles from "./task-list-view.module.css";
import feedbackStyles from "@/components/ui/feedback.module.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCheck,
  Feather,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mainTasks, sortTasks, type TaskStatus } from "../domain/task";
import { useTaskContext } from "../hooks/tasks-provider";
import {
  useFlagQueryParam,
  useStatusQueryParam,
} from "../hooks/use-status-query-param";
import {
  SelectableTaskList,
  TaskSelectionToggle,
} from "./selectable-task-list";
import { useTaskSelection } from "../hooks/use-task-selection";
import { TaskStatusTabs } from "./task-status-tabs";
import { TaskErrorBanner } from "./task-error-banner";
import { TaskListSkeleton } from "./task-list-skeleton";
const TAB_NOTES: Record<TaskStatus, string> = {
  todo: "A little space for what’s next.",
  in_progress: "One step at a time. You’re making progress.",
  done: "Small wins, well earned.",
};

export function TaskListView() {
  const router = useRouter();
  const [status, setStatus] = useStatusQueryParam("status");
  const [focusToday, setFocusToday] = useFlagQueryParam("focus");
  const { tasks, loading, busy, error, create, listFilters, setListFilters } =
    useTaskContext();
  const { query } = listFilters;
  const changeFilters = (patch: {
    status?: TaskStatus;
    query?: string;
    focusToday?: boolean;
  }) => {
    if (patch.status !== undefined) setStatus(patch.status);
    if (patch.focusToday !== undefined) setFocusToday(patch.focusToday);
    if (patch.query !== undefined)
      setListFilters((filters) => ({ ...filters, query: patch.query ?? "" }));
  };
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
  const hasSearchQuery = !!query.trim();
  const showAllStatuses = focusToday || hasSearchQuery;
  const visible = sortTasks(
    tasks.filter(
      (task) =>
        !task.deleted_at &&
        (!task.parent_id || showAllStatuses) &&
        (showAllStatuses || task.status === status) &&
        (!focusToday || task.focus_today) &&
        `${task.title} ${task.notes}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    ),
    status,
  );
  const selectableVisible = showAllStatuses
    ? []
    : visible.filter((task) => !task.parent_id);
  const scope = JSON.stringify([status, query, focusToday]);
  const selection = useTaskSelection(selectableVisible, scope);

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
        <div
          className={cn(
            listStyles["status-tabs-slot"],
            showAllStatuses && listStyles["status-tabs-hidden"],
          )}
          aria-hidden={showAllStatuses || undefined}
        >
          <TaskStatusTabs
            value={status}
            onChange={(status) => changeFilters({ status })}
            tasks={roots}
            idPrefix="task"
            label="Task status"
            loading={loading}
          />
        </div>
        <div
          className={cn(
            listStyles["list-actions"],
            showAllStatuses && listStyles["list-actions-unified"],
          )}
        >
          {!showAllStatuses && (
            <TaskSelectionToggle
              selection={selection}
              idPrefix="task"
              disabled={loading || busy || !selectableVisible.length}
            />
          )}
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
            <Star size={15} fill={focusToday ? "currentColor" : "none"} />
            Focus today
          </Button>
        </div>
      </div>
      <div className={listStyles["list-subheader"]}>
        <p>
          {focusToday
            ? hasSearchQuery
              ? "Focused tasks matching your search."
              : "Focused tasks across all stages."
            : hasSearchQuery
              ? "Search across every status and subtask."
              : TAB_NOTES[status]}
        </p>
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={listStyles["clear-search"]}
              onClick={() => {
                changeFilters({ query: "" });
                searchInput.current?.focus();
              }}
              aria-label="Clear search"
            >
              <X size={14} />
            </Button>
          ) : (
            <kbd>/</kbd>
          )}
        </div>
      </div>

      <TaskErrorBanner />
      <div
        role={showAllStatuses ? "region" : "tabpanel"}
        id="task-panel"
        aria-labelledby={showAllStatuses ? undefined : `task-tab-${status}`}
        aria-label={
          showAllStatuses
            ? focusToday
              ? "Focused tasks"
              : "Search results"
            : undefined
        }
        className={listStyles["task-panel"]}
        tabIndex={0}
        aria-busy={loading}
      >
        {loading ? (
          <TaskListSkeleton />
        ) : (
          <SelectableTaskList
            key={scope}
            selection={selection}
            externalTrigger
            tasks={visible}
            status={status}
            showStatus={showAllStatuses}
            compactView={showAllStatuses}
            focusView={focusToday}
            searchView={hasSearchQuery && !focusToday}
            reorderEnabled={!query.trim() && !focusToday}
            className={listStyles["task-list"]}
            onOpenTask={(id) => router.push(`/tasks/${id}`)}
          >
            <div className={feedbackStyles["empty-state"]}>
              <span className={feedbackStyles["empty-icon"]}>
                {focusToday ? (
                  <Star size={30} strokeWidth={1.3} />
                ) : hasSearchQuery ? (
                  <Search size={30} strokeWidth={1.3} />
                ) : status === "done" ? (
                  <CheckCheck size={30} strokeWidth={1.3} />
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
          </SelectableTaskList>
        )}
      </div>
    </>
  );
}
