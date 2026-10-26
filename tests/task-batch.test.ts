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
  it("repairs legacy browser orphans once without reviving old deleted branches", async () => {
    const parent = { ...first, deleted_at: "2026-10-20T00:00:00Z" };
    const child = { ...second, parent_id: first.id };
    const grandchild = {
      ...second,
      id: crypto.randomUUID(),
      parent_id: second.id,
    };
    const oldDeleted = {
      ...child,
      id: crypto.randomUUID(),
      deleted_at: "2026-10-19T00:00:00Z",
    };
    const oldOrphan = {
      ...grandchild,
      id: crypto.randomUUID(),
      parent_id: oldDeleted.id,
    };
    let stored = JSON.stringify([
      parent,
      child,
      grandchild,
      oldDeleted,
      oldOrphan,
    ]);
    const setItem = vi.fn((_key: string, value: string) => {
      stored = value;
    });
    vi.stubGlobal("localStorage", { getItem: () => stored, setItem });
    try {
      const gateway = createGateway("local");
      expect((await gateway.list()).tasks).toEqual([]);
      expect(setItem).toHaveBeenCalledOnce();
      const repaired = JSON.parse(stored);
      expect(
        repaired.find((task: { id: string }) => task.id === child.id)
          .deleted_at,
      ).toBe(parent.deleted_at);
      expect(
        repaired.find((task: { id: string }) => task.id === oldOrphan.id)
          .deleted_at,
      ).toBe(oldDeleted.deleted_at);
      await gateway.list();
      expect(setItem).toHaveBeenCalledOnce();
      await gateway.update(parent.id, { deleted_at: null });
      expect((await gateway.list()).tasks.map((task) => task.id)).toEqual([
        parent.id,
        child.id,
        grandchild.id,
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("deletes nested tasks across statuses and restores only this deletion's tree", () => {
    const child = {
      ...first,
      id: crypto.randomUUID(),
      parent_id: first.id,
      status: "done" as const,
      completed_at: "2026-10-25T00:00:00Z",
    };
    const grandchild = {
      ...second,
      id: crypto.randomUUID(),
      parent_id: child.id,
      status: "in_progress" as const,
    };
    const previouslyDeleted = {
      ...child,
      id: crypto.randomUUID(),
      deleted_at: "2026-10-24T00:00:00Z",
    };
    const oldGrandchild = {
      ...grandchild,
      id: crypto.randomUUID(),
      parent_id: previouslyDeleted.id,
      deleted_at: previouslyDeleted.deleted_at,
    };
    const original = [
      first,
      second,
      child,
      grandchild,
      previouslyDeleted,
      oldGrandchild,
    ];
    const input = taskDeletionSchema.parse({
      ids: [first.id],
      from_status: "todo",
      parent_id: null,
      deleted_at: "2026-10-27T10:00:00Z",
      restore: false,
    });
    const deleted = applyTaskDeletion(original, input);
    for (const id of [first.id, child.id, grandchild.id]) {
      expect(deleted.find((task) => task.id === id)?.deleted_at).toBe(
        input.deleted_at,
      );
    }
    expect(deleted.find((task) => task.id === second.id)).toEqual(second);
    expect(deleted.slice(-2)).toEqual(original.slice(-2));
    const affected = deleted.filter(
      (task) => task.deleted_at === input.deleted_at,
    );
    expect(parseDeletedTasks(affected, input)).toEqual(affected);
    expect(() =>
      parseDeletedTasks(
        [...affected, { ...second, deleted_at: input.deleted_at }],
        input,
      ),
    ).toThrow("Could not confirm");
    const restored = applyTaskDeletion(deleted, { ...input, restore: true });
    expect(restored).toEqual(
      original.map((task) => ({
        ...task,
        updated_at: restored.find((item) => item.id === task.id)!.updated_at,
      })),
    );
    expect(restored.find((task) => task.id === child.id)?.completed_at).toBe(
      child.completed_at,
    );
    // Restoring a nested task on its own cannot leave it under a deleted parent.
    expect(() =>
      applyTaskDeletion(deleted, {
        ...input,
        ids: [child.id],
        from_status: "done",
        parent_id: first.id,
        restore: true,
      }),
    ).toThrow("Parent task not found");
  });

  it("supports trees larger than the root selection limit and direct local deletion", async () => {
    const children = Array.from({ length: 1001 }, () => ({
      ...second,
      id: crypto.randomUUID(),
      parent_id: first.id,
    }));
    let stored = JSON.stringify([first, ...children, second]);
    vi.stubGlobal("localStorage", {
      getItem: () => stored,
      setItem: (_key: string, value: string) => {
        stored = value;
      },
    });
    try {
      const gateway = createGateway("local");
      const deletionTime = "2026-10-27T10:00:00Z";
      await gateway.update(first.id, { deleted_at: deletionTime });
      expect((await gateway.list()).tasks).toEqual([second]);
      await expect(
        gateway.create(
          createTaskSchema.parse({
            id: crypto.randomUUID(),
            title: "Too late",
            parent_id: children[0].id,
          }),
        ),
      ).rejects.toThrow("Parent task not found");
      await gateway.update(first.id, { deleted_at: null });
      expect((await gateway.list()).tasks).toHaveLength(1003);
      const input = taskDeletionSchema.parse({
        ids: [first.id],
        from_status: "todo",
        parent_id: null,
        deleted_at: deletionTime,
        restore: false,
      });
      const saved = await gateway.remove(input);
      expect(saved).toHaveLength(1002);
      expect(parseDeletedTasks(saved, input)).toHaveLength(1002);
      expect(await gateway.remove({ ...input, restore: true })).toHaveLength(
        1002,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
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
      expect((await gateway.list()).tasks).toEqual([]);
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
