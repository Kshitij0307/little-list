"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { StorageMode } from "../client/task-gateway";
import { useTasks, type InitialTaskState } from "./use-tasks";
import { UnsavedChangesProvider } from "@/components/unsaved-changes-provider";

type ListFilters = { query: string };
const initialFilters: ListFilters = { query: "" };
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
    <UnsavedChangesProvider>
      <TasksContext.Provider value={notebook}>{children}</TasksContext.Provider>
    </UnsavedChangesProvider>
  );
}

export function useTaskContext() {
  const context = useContext(TasksContext);
  if (!context)
    throw new Error("Task components must be inside TasksProvider.");
  return context;
}
