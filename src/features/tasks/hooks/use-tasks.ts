"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createGateway, type StorageMode } from "../client/task-gateway";
import { applyTaskPatch, createTaskSchema, makeTask, type Task, type TaskPatch } from "../domain/task";

type UndoAction = { id: string; patch: TaskPatch; label: string };

export function useTasks(mode: StorageMode) {
  const gateway = useMemo(() => createGateway(mode), [mode]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const lock = useRef(false);
  const loaded = useRef(false);
  const errorMessage = (value: unknown) => value instanceof Error ? value.message : "Could not save. Please try again.";

  const reload = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    try {
      setTasks(await gateway.list());
      loaded.current = true;
      setError(null);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { lock.current = false; setLoading(false); }
  }, [gateway]);

  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    const refresh = () => { if (document.visibilityState === "visible") void reload(); };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);

  const create = async (title: string) => {
    if (lock.current || !loaded.current) return false;
    let input;
    try { input = createTaskSchema.parse({ id: crypto.randomUUID(), title }); }
    catch (failure) { setError(errorMessage(failure)); return false; }
    lock.current = true;
    setBusy(true);
    setError(null);
    const previous = tasks;
    setTasks((items) => [...items, makeTask(input)]);
    try {
      const saved = await gateway.create(input);
      setTasks((items) => items.map((task) => task.id === saved.id ? saved : task));
      setUndoAction({ id: saved.id, patch: { deleted_at: new Date().toISOString() }, label: "Task added" });
      return true;
    } catch (failure) { setTasks(previous); setError(errorMessage(failure)); return false; }
    finally { lock.current = false; setBusy(false); }
  };

  const update = async (id: string, patch: TaskPatch, label = "Task updated", undoing = false) => {
    if (lock.current || !loaded.current) return false;
    const current = tasks.find((task) => task.id === id);
    // Deleted tasks are absent from the visible list but can still be restored by undo.
    if (!current && !undoing) return false;
    lock.current = true;
    setBusy(true);
    setError(null);
    const previous = tasks;
    try {
      if (current) {
        const optimistic = applyTaskPatch(current, patch);
        setTasks((items) => items.map((task) => task.id === id ? optimistic : task).filter((task) => !task.deleted_at));
      }
      const saved = await gateway.update(id, patch);
      setTasks((items) => [...items.filter((task) => task.id !== id), ...(saved.deleted_at ? [] : [saved])]);
      if (undoing) setUndoAction(null);
      else if (current) {
        const reverse: TaskPatch = {};
        for (const key of Object.keys(patch) as (keyof TaskPatch)[]) Object.assign(reverse, { [key]: current[key] });
        setUndoAction({ id, patch: reverse, label });
      }
      return true;
    } catch (failure) { setTasks(previous); setError(errorMessage(failure)); return false; }
    finally { lock.current = false; setBusy(false); }
  };

  return { tasks, loading, busy, error, reload, create, update, undoAction,
    undo: () => undoAction ? update(undoAction.id, undoAction.patch, "Undone", true) : Promise.resolve(false),
    dismissUndo: () => setUndoAction(null),
  };
}
