import { describe, expect, it, vi } from "vitest";
import {
  applyTaskMove,
  parseMovedTasks,
  taskMoveSchema,
  applyTaskDeletion,
  parseDeletedTasks,
  taskDeletionSchema,
} from "../src/features/tasks/domain/task-batch";
import {
  STATUSES,
  createTaskSchema,
  makeTask,
} from "../src/features/tasks/domain/task";
import { createGateway } from "../src/features/tasks/client/task-gateway";

const first = makeTask(
  createTaskSchema.parse({
    id: "be7f3440-3868-4e48-90fb-f2e8dbce5b26",
    title: "First",
  }),
);
const second = {
  ...first,
  id: "d2e80888-53ec-419d-aea0-54beb67d77b3",
  title: "Second",
};
const move = {
  ids: [first.id, second.id],
  from_status: "todo" as const,
  to_status: "done" as const,
  parent_id: null,
};

describe("batch status moves", () => {
  it("accepts 500 unique tasks and rejects empty, oversized, and duplicate selections", () => {
    const ids = Array.from({ length: 500 }, () => crypto.randomUUID());
    const deletion = {
      ids,
      from_status: "todo",
      parent_id: null,
      deleted_at: "2026-10-27T10:00:00.000Z",
      restore: false,
    };
    expect(taskMoveSchema.safeParse({ ...move, ids }).success).toBe(true);
    expect(taskDeletionSchema.safeParse(deletion).success).toBe(true);
    for (const invalid of [
      [],
      [...ids, crypto.randomUUID()],
      [first.id, first.id],
    ]) {
      expect(taskMoveSchema.safeParse({ ...move, ids: invalid }).success).toBe(
        false,
      );
      expect(
        taskDeletionSchema.safeParse({ ...deletion, ids: invalid }).success,
      ).toBe(false);
    }
  });

  it("validates the complete cloud deletion response before accepting success", async () => {
    const deletion = taskDeletionSchema.parse({
      ids: [first.id, second.id],
      from_status: "todo",
      parent_id: null,
      deleted_at: "2026-10-27T10:00:00.000Z",
      restore: false,
    });
    const saved = applyTaskDeletion([first, second], deletion);
    for (const invalid of [
      saved.slice(0, 1),
      [saved[0], saved[0]],
      [saved[0], { ...saved[1], parent_id: first.id }],
      [saved[0], { ...saved[1], deleted_at: null }],
      [saved[0], { ...saved[1], deleted_at: "2026-10-27T11:00:00.000Z" }],
    ])
      expect(() => parseDeletedTasks(invalid, deletion)).toThrow(
        "Could not confirm",
      );
    const fetch = vi.fn().mockResolvedValue(Response.json(saved));
    vi.stubGlobal("fetch", fetch);
    try {
      expect(await createGateway("cloud").remove(deletion)).toEqual(saved);
      expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/tasks/batch", {
        method: "PATCH",
        body: JSON.stringify(deletion),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("deletes and restores local batches once, preserving details and refusing stale restores", async () => {
    const child = { ...first, id: crypto.randomUUID(), parent_id: first.id };
    const tasks = [first, second, child];
    const deletion = taskDeletionSchema.parse({
      ids: [first.id, second.id],
      from_status: "todo",
      parent_id: null,
      deleted_at: "2026-10-27T10:00:00.000Z",
      restore: false,
    });
    let stored = JSON.stringify(tasks);
    const setItem = vi.fn((_key: string, value: string) => {
      stored = value;
    });
    vi.stubGlobal("localStorage", { getItem: () => stored, setItem });
    try {
      const gateway = createGateway("local");
      await gateway.remove(deletion);
      expect((await gateway.list()).tasks).toEqual([child]);
      expect(setItem).toHaveBeenCalledOnce();
      const before = stored;
      await expect(
        gateway.remove({
          ...deletion,
          restore: true,
          deleted_at: "2026-10-27T11:00:00.000Z",
        }),
      ).rejects.toThrow("Selected tasks changed");
      expect(stored).toBe(before);
      await gateway.remove({ ...deletion, restore: true });
      expect((await gateway.list()).tasks).toEqual(
        expect.arrayContaining(
          tasks.map((task) =>
            expect.objectContaining({
              id: task.id,
              title: task.title,
              status: task.status,
              parent_id: task.parent_id,
              deleted_at: null,
            }),
          ),
        ),
      );
      expect(setItem).toHaveBeenCalledTimes(2);
      expect(() => applyTaskDeletion([first], deletion)).toThrow(
        "Selected tasks changed",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  for (const from of STATUSES)
    for (const to of STATUSES.filter((value) => value !== from)) {
      it(`moves ${from} to ${to} without changing other details or descendants`, () => {
        const tasks = [first, second].map((task) => ({
          ...task,
          status: from,
          notes: "Keep",
          link_url: "https://example.com",
          completed_at: from === "done" ? "2026-10-25T00:00:00Z" : null,
        }));
        const child = {
          ...first,
          id: crypto.randomUUID(),
          parent_id: first.id,
        };
        const result = applyTaskMove([...tasks, child], {
          ...move,
          from_status: from,
          to_status: to,
        });
        expect(result.slice(0, 2).map((task) => task.status)).toEqual([to, to]);
        expect(result[0]).toMatchObject({
          notes: "Keep",
          link_url: "https://example.com",
        });
        expect(result[0].completed_at === null).toBe(to !== "done");
        expect(result[2]).toEqual(child);
      });
    }
  it("rejects mixed tabs, mixed parents, deleted or missing tasks before writing", () => {
    for (const changed of [
      { ...second, status: "done" as const },
      { ...second, parent_id: first.id },
      { ...second, deleted_at: new Date().toISOString() },
    ]) {
      expect(() => applyTaskMove([first, changed], move)).toThrow(
        "Selected tasks changed",
      );
    }
    expect(() => applyTaskMove([first], move)).toThrow(
      "Selected tasks changed",
    );
    expect(
      taskMoveSchema.safeParse({ ...move, ids: [first.id, first.id] }).success,
    ).toBe(false);
    expect(
      taskMoveSchema.safeParse({ ...move, to_status: "todo" }).success,
    ).toBe(false);
    expect(() => parseMovedTasks([{ ...first, status: "done" }], move)).toThrow(
      "Could not confirm",
    );
  });
  it("persists a local batch once, restores it in one reverse move, and leaves storage untouched on failure", async () => {
    let stored = JSON.stringify([first, second]);
    const setItem = vi.fn((_key: string, value: string) => {
      stored = value;
    });
    vi.stubGlobal("localStorage", { getItem: () => stored, setItem });
    try {
      const gateway = createGateway("local");
      expect((await gateway.move(move)).map((task) => task.status)).toEqual([
        "done",
        "done",
      ]);
      expect(setItem).toHaveBeenCalledOnce();
      await gateway.move({ ...move, from_status: "done", to_status: "todo" });
      expect((await gateway.list()).tasks.map((task) => task.status)).toEqual([
        "todo",
        "todo",
      ]);
      const before = stored;
      await expect(
        gateway.move({ ...move, ids: [first.id, crypto.randomUUID()] }),
      ).rejects.toThrow("Selected tasks changed");
      expect(stored).toBe(before);
      expect(setItem).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("sends one cloud request for the full selection", async () => {
    const saved = applyTaskMove([first, second], move);
    const fetch = vi.fn().mockResolvedValue(Response.json(saved));
    vi.stubGlobal("fetch", fetch);
    try {
      expect(await createGateway("cloud").move(move)).toEqual(saved);
      expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/tasks/batch", {
        method: "PATCH",
        body: expect.any(String),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      });
      expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(move);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
