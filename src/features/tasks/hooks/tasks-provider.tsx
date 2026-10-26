"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { StorageMode } from "../client/task-gateway";
import type { TaskStatus } from "../domain/task";
import { useTasks, type InitialTaskState } from "./use-tasks";

type ListFilters = { status: TaskStatus; query: string; focusToday: boolean };
const initialFilters: ListFilters = {
  status: "todo",
  query: "",
  focusToday: false,
};
function useNotebook(
  mode: StorageMode,
  userId?: string,
  initialState?: InitialTaskState,
) {
  const tasks = useTasks(mode, userId, initialState);
  const [listFilters, setListFilters] = useState(initialFilters);
  return { ...tasks, mode, listFilters, setListFilters };
}
const TasksContext = createContext<ReturnType<typeof useNotebook> | null>(null);

export function TasksProvider({
  mode,
  userId,
  initialState,
  children,
}: {
  mode: StorageMode;
  userId?: string;
  initialState?: InitialTaskState;
  children: ReactNode;
}) {
  const notebook = useNotebook(mode, userId, initialState);
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
