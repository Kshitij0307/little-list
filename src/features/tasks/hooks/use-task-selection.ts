"use client";

import { useState } from "react";
import { MAX_BATCH_TASKS } from "../domain/task-batch";
import type { Task } from "../domain/task";

export function useTaskSelection(tasks: Task[], scope: string) {
  const [state, setState] = useState({
    scope,
    active: false,
    ids: [] as string[],
    target: "",
  });
  // Reset before rendering a new scope, including when returning to a previous tab.
  if (state.scope !== scope)
    setState({ scope, active: false, ids: [], target: "" });
  const active = state.scope === scope && state.active;
  const ids = state.scope === scope ? state.ids : [];
  const selected = tasks.filter((task) => ids.includes(task.id));
  const allSelected =
    !!tasks.length &&
    selected.length === Math.min(tasks.length, MAX_BATCH_TASKS);
  return {
    active,
    ids,
    selected,
    allSelected,
    target: state.scope === scope ? state.target : "",
    chooseTarget: (target: string) =>
      setState((current) => ({ ...current, target })),
    start: () => setState({ scope, active: true, ids: [], target: "" }),
    clear: () => setState({ scope, active: false, ids: [], target: "" }),
    toggleAll: () =>
      setState({
        target: state.target,
        scope,
        active: true,
        ids: allSelected
          ? []
          : tasks.slice(0, MAX_BATCH_TASKS).map((task) => task.id),
      }),
    toggle: (id: string) =>
      setState({
        target: state.target,
        scope,
        active: true,
        ids: ids.includes(id)
          ? ids.filter((value) => value !== id)
          : [...selected.map((task) => task.id), id],
      }),
  };
}
export type TaskSelection = ReturnType<typeof useTaskSelection>;
