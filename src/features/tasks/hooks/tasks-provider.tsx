"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { StorageMode } from "../client/task-gateway";
import type { TaskStatus } from "../domain/task";
import { useTasks } from "./use-tasks";

type ListFilters = { status: TaskStatus; query: string; focusToday: boolean };
const initialFilters: ListFilters = {
  status: "todo",
  query: "",
  focusToday: false,
};
function useNotebook(mode: StorageMode) {
  const tasks = useTasks(mode);
  const [listFilters, setListFilters] = useState(initialFilters);
  return { ...tasks, mode, listFilters, setListFilters };
}
const TasksContext = createContext<ReturnType<typeof useNotebook> | null>(null);

export function TasksProvider({
  mode,
  children,
}: {
  mode: StorageMode;
  children: ReactNode;
}) {
  const notebook = useNotebook(mode);
  return (
    <TasksContext.Provider value={notebook}>{children}</TasksContext.Provider>
  );
}

export function useTaskContext() {
  const context = useContext(TasksContext);
  if (!context)
    throw new Error("Task components must be inside TasksProvider.");
  return context;
}
