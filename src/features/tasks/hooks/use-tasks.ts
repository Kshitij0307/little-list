"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createGateway, type StorageMode } from "../client/task-gateway";
import {
  applyTaskPatch,
  createTaskSchema,
  makeTask,
  sortTasks,
  validateTaskParent,
  type Task,
  type TaskPatch,
} from "../domain/task";
import {
  applyTaskMove,
  taskMoveSchema,
  type TaskMove,
  applyTaskDeletion,
  taskDeletionSchema,
  type TaskDeletion,
} from "../domain/task-batch";
import {
  applyLocalRankMove,
  rankBetween,
  type TaskRankMove,
} from "../domain/task-rank";

type UndoAction = { label: string } & (
  | { id: string; patch: TaskPatch }
  | { move: TaskMove }
  | { deletion: TaskDeletion; tasks: Task[] }
  | { reorder: TaskRankMove }
);
const UNDO_DURATION_MS = 5_000;
export type InitialTaskState = { tasks: Task[] } | { error: string };
const errorMessage = (value: unknown) =>
  value instanceof Error ? value.message : "Could not save. Please try again.";

export function useTasks(
  mode: StorageMode,
  userId?: string,
  initialState?: InitialTaskState,
) {
  if (mode === "cloud" && !userId)
    throw new Error("Cloud tasks require a verified user ID.");
  const gateway = useMemo(() => createGateway(mode), [mode]);
  const [tasks, setTasks] = useState<Task[]>(
    initialState && "tasks" in initialState ? initialState.tasks : [],
  );
  const [loading, setLoading] = useState(!initialState);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    initialState && "error" in initialState ? initialState.error : null,
  );
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const lock = useRef(false);
  const loaded = useRef(!!initialState && "tasks" in initialState);
  const lastReturnRefreshAt = useRef(0);

  useEffect(() => {
    if (!undoAction) return;
    const timer = setTimeout(() => setUndoAction(null), UNDO_DURATION_MS);
    return () => clearTimeout(timer);
  }, [undoAction]);

  const reload = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    if (loaded.current) setRefreshing(true);
    else setLoading(true);
    let switchingAccount = false;
    try {
      const result = await gateway.list();
      if (mode === "cloud" && result.userId !== userId) {
        switchingAccount = true;
        setTasks([]);
        setUndoAction(null);
        setLoading(true);
        location.replace("/");
        return;
      }
      setTasks(result.tasks);
      loaded.current = true;
      setError(null);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      lock.current = false;
      if (!switchingAccount) setLoading(false);
      setRefreshing(false);
    }
  }, [gateway, mode, userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      lastReturnRefreshAt.current = Date.now();
      if (!initialState) void reload();
    }, 0);
    const refreshOnReturn = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastReturnRefreshAt.current < 1_000) return;
      lastReturnRefreshAt.current = now;
      void reload();
    };
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) refreshOnReturn();
    };
    window.addEventListener("focus", refreshOnReturn);
    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", refreshOnReturn);
    if (mode === "local") window.addEventListener("storage", reload);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refreshOnReturn);
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", refreshOnReturn);
      if (mode === "local") window.removeEventListener("storage", reload);
    };
  }, [mode, reload, initialState]);

  // Writes share locking, error reporting, rollback, and undo bookkeeping.
  // Overlapping writes are rejected; this is deliberately not a mutation queue.
  async function mutate(operation: () => Promise<UndoAction | null>) {
    if (lock.current || !loaded.current) return false;
    lock.current = true;
    setBusy(true);
    setError(null);
    const previous = tasks;
    try {
      setUndoAction(await operation());
      return true;
    } catch (failure) {
      setTasks(previous);
      setError(errorMessage(failure));
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const create = (title: string, parentId: string | null = null) =>
    mutate(async () => {
      const input = createTaskSchema.parse({
        id: crypto.randomUUID(),
        title,
        parent_id: parentId,
      });
      validateTaskParent(tasks, input.id, input.parent_id);
      const first = tasks
        .filter(
          (task) =>
            !task.deleted_at &&
            task.parent_id === input.parent_id &&
            task.status === input.status &&
            task.pinned === input.pinned,
        )
        .sort((a, b) => a.rank.localeCompare(b.rank))
        .at(0);
      setTasks((items) => [
        ...items,
        makeTask(input, undefined, rankBetween(null, first?.rank ?? null)),
      ]);
      const saved = await gateway.create(input);
      setTasks((items) =>
        items.map((task) => (task.id === saved.id ? saved : task)),
      );
      return {
        id: saved.id,
        patch: { deleted_at: new Date().toISOString() },
        label: "Task added",
      };
    });

  const update = (
    id: string,
    patch: TaskPatch,
    label = "Task updated",
    undoing = false,
  ) => {
    const current = tasks.find((task) => task.id === id);
    if (patch.deleted_at && current)
      return remove(
        {
          ids: [id],
          from_status: current.status,
          parent_id: current.parent_id,
          deleted_at: patch.deleted_at,
          restore: false,
        },
        [],
        undoing,
      );
    return mutate(async () => {
      const current = tasks.find((task) => task.id === id);
      // Undo can restore a deleted task that is no longer in the visible collection.
      if (!current && !undoing)
        throw new Error("Task not found. Refresh your list.");
      if (current) {
        const optimistic = applyTaskPatch(current, patch);
        if (patch.parent_id !== undefined)
          validateTaskParent(tasks, id, optimistic.parent_id);
        setTasks((items) =>
          items
            .map((task) => (task.id === id ? optimistic : task))
            .filter((task) => !task.deleted_at),
        );
      }
      const saved = await gateway.update(id, patch);
      setTasks((items) => {
        if (saved.deleted_at) return items.filter((task) => task.id !== id);
        return items.some((task) => task.id === id)
          ? items.map((task) => (task.id === id ? saved : task))
          : [...items, saved];
      });
      if (undoing || !current) return null;
      const reverse: TaskPatch = {};
      for (const key of Object.keys(patch) as (keyof TaskPatch)[])
        Object.assign(reverse, { [key]: current[key] });
      return { id, patch: reverse, label };
    });
  };

  const move = (input: TaskMove, undoing = false) =>
    mutate(async () => {
      const parsed = taskMoveSchema.parse(input);
      const optimistic = applyTaskMove(tasks, parsed);
      setTasks(optimistic);
      const saved = await gateway.move(parsed);
      const byId = new Map(saved.map((task) => [task.id, task]));
      setTasks((items) => items.map((task) => byId.get(task.id) ?? task));
      return undoing
        ? null
        : {
            label: `${parsed.ids.length} ${parsed.ids.length === 1 ? "task" : "tasks"} moved`,
            move: {
              ...parsed,
              from_status: parsed.to_status,
              to_status: parsed.from_status,
            },
          };
    });

  const remove = (
    input: TaskDeletion,
    restoringTasks: Task[] = [],
    undoing = false,
  ) =>
    mutate(async () => {
      const deletion = taskDeletionSchema.parse(input);
      const base = [
        ...tasks,
        ...restoringTasks.filter(
          (task) => !tasks.some((current) => current.id === task.id),
        ),
      ];
      const optimistic = applyTaskDeletion(base, deletion);
      setTasks(optimistic.filter((task) => !task.deleted_at));
      const saved = await gateway.remove(deletion);
      const affected = new Set(saved.map((task) => task.id));
      setTasks((items) => [
        ...items.filter((task) => !affected.has(task.id)),
        ...saved.filter((task) => !task.deleted_at),
      ]);
      return deletion.restore || undoing
        ? null
        : {
            label: `${saved.length} ${saved.length === 1 ? "task" : "tasks"} deleted`,
            deletion: { ...deletion, restore: true },
            tasks: saved,
          };
    });

  const reorder = (input: TaskRankMove, undoing = false) =>
    mutate(async () => {
      const ordered = sortTasks(
        tasks.filter(
          (task) =>
            task.status === input.status &&
            task.parent_id === input.parent_id &&
            task.pinned === input.pinned &&
            !task.deleted_at,
        ),
        input.status,
      );
      const index = ordered.findIndex((task) => task.id === input.id);
      if (index < 0) throw new Error("Task not found. Refresh your list.");
      const reverse: TaskRankMove = {
        ...input,
        before_id: ordered[index - 1]?.id ?? null,
        after_id: ordered[index + 1]?.id ?? null,
      };
      setTasks(applyLocalRankMove(tasks, input).tasks);
      const saved = await gateway.reorder(input);
      setTasks((items) =>
        items.map((task) => (task.id === saved.id ? saved : task)),
      );
      return undoing ? null : { label: "Task reordered", reorder: reverse };
    });

  return {
    tasks,
    loading,
    refreshing,
    busy,
    error,
    reload,
    create,
    update,
    move,
    remove,
    reorder,
    undoAction,
    undo: () =>
      undoAction
        ? "deletion" in undoAction
          ? remove(undoAction.deletion, undoAction.tasks)
          : "reorder" in undoAction
            ? reorder(undoAction.reorder, true)
            : "move" in undoAction
              ? move(undoAction.move, true)
              : update(undoAction.id, undoAction.patch, "Undone", true)
        : Promise.resolve(false),
    dismissUndo: () => setUndoAction(null),
  };
}
