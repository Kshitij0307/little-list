import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGateway } from "../src/features/tasks/client/task-gateway";
import { createTaskSchema, makeTask } from "../src/features/tasks/domain/task";

const input = createTaskSchema.parse({
  id: "be7f3440-3868-4e48-90fb-f2e8dbce5b26",
  title: "Write something",
});
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("storage adapters", () => {
  it("persists task links and removal across local adapter instances", async () => {
    const link_url = "https://www.linkedin.com/posts/example";
    await createGateway("local").create({ ...input, link_url });
    const gateway = createGateway("local");
    expect((await gateway.list()).tasks[0].link_url).toBe(link_url);
    await gateway.update(input.id, { link_url: null });
    expect((await createGateway("local").list()).tasks[0].link_url).toBeNull();
  });
  it("persists, hides deleted tasks, and supports restoring across adapter instances", async () => {
    const gateway = createGateway("local");
    await gateway.create(input);
    const reopened = createGateway("local");
    expect((await reopened.list()).tasks).toHaveLength(1);
    await reopened.update(input.id, { deleted_at: new Date().toISOString() });
    expect((await gateway.list()).tasks).toHaveLength(0);
    await gateway.update(input.id, { deleted_at: null });
    expect((await reopened.list()).tasks[0].title).toBe(input.title);
  });
  it("leaves corrupt stored data untouched instead of replacing it with an empty list", async () => {
    values.set("little-list.tasks.v1", "not-json");
    await expect(createGateway("local").list()).rejects.toThrow(
      "left untouched",
    );
    await expect(createGateway("local").create(input)).rejects.toThrow();
    expect(values.get("little-list.tasks.v1")).toBe("not-json");
  });
  it("surfaces storage quota failures", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("Quota");
      },
    });
    await expect(createGateway("local").create(input)).rejects.toThrow(
      "could not save",
    );
  });
  it("reports cloud errors without writing to local storage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Database paused" }), {
          status: 503,
        }),
      ),
    );
    await expect(createGateway("cloud").create(input)).rejects.toThrow(
      "Database paused",
    );
    expect(values.size).toBe(0);
  });
  it("reads the verified account ID alongside cloud tasks", async () => {
    const task = makeTask(input);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ userId: "verified-owner", tasks: [task] }),
        ),
    );
    expect(await createGateway("cloud").list()).toEqual({
      userId: "verified-owner",
      tasks: [task],
    });
    expect(fetch).toHaveBeenCalledWith("/api/tasks", {
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
  });
  it("returns to login when a task request has no valid session", async () => {
    const replace = vi.fn();
    vi.stubGlobal("window", { location: { replace } });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: "Sign in" }, { status: 401 }),
        ),
    );
    await expect(createGateway("cloud").list()).rejects.toThrow(
      "session expired",
    );
    expect(replace).toHaveBeenCalledWith("/login");
  });
});

describe("subtask persistence", () => {
  const childInput = createTaskSchema.parse({
    id: "d2e80888-53ec-419d-aea0-54beb67d77b3",
    title: "Smaller step",
    notes: "Keep these details",
    starred: true,
  });
  it("creates subtasks and preserves the relationship after reload", async () => {
    const gateway = createGateway("local");
    await gateway.create(input);
    await gateway.create({ ...childInput, parent_id: input.id });
    expect((await createGateway("local").list()).tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: childInput.id, parent_id: input.id }),
      ]),
    );
  });
  it("moves an existing task under a parent and can undo without losing details", async () => {
    const gateway = createGateway("local");
    await gateway.create(input);
    const original = await gateway.create(childInput);
    const moved = await gateway.update(childInput.id, { parent_id: input.id });
    expect(moved).toMatchObject({
      title: original.title,
      notes: original.notes,
      starred: true,
      parent_id: input.id,
    });
    expect(
      await gateway.update(childInput.id, { parent_id: null }),
    ).toMatchObject({ parent_id: null, notes: original.notes });
  });
  it("rejects missing parents, self-parenting, and cycles without changing storage", async () => {
    const gateway = createGateway("local");
    await gateway.create(input);
    await expect(
      gateway.update(input.id, { parent_id: childInput.id }),
    ).rejects.toThrow("Parent task not found");
    await expect(
      gateway.update(input.id, { parent_id: input.id }),
    ).rejects.toThrow("own subtask");
    await gateway.create({ ...childInput, parent_id: input.id });
    await expect(
      gateway.update(input.id, { parent_id: childInput.id }),
    ).rejects.toThrow("own subtask");
    expect(
      (await gateway.list()).tasks.find((item) => item.id === input.id)
        ?.parent_id,
    ).toBeNull();
    await gateway.update(input.id, { deleted_at: new Date().toISOString() });
    await expect(
      gateway.create({
        ...childInput,
        id: "e595cb27-c6f2-4f01-81dd-c17c0d0b650e",
        parent_id: input.id,
      }),
    ).rejects.toThrow("Parent task not found");
    await gateway.update(input.id, { deleted_at: null });
    expect((await gateway.list()).tasks).toHaveLength(2);
  });
  it("reads older saved tasks as main-list tasks", async () => {
    const gateway = createGateway("local");
    await gateway.create(input);
    const oldTasks = JSON.parse(values.get("little-list.tasks.v1")!);
    delete oldTasks[0].parent_id;
    values.set("little-list.tasks.v1", JSON.stringify(oldTasks));
    expect((await gateway.list()).tasks[0].parent_id).toBeNull();
  });
});
