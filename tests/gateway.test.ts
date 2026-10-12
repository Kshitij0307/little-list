import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGateway } from "../src/features/tasks/client/task-gateway";
import { createTaskSchema } from "../src/features/tasks/domain/task";

const input = createTaskSchema.parse({ id: "be7f3440-3868-4e48-90fb-f2e8dbce5b26", title: "Write something" });
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());

describe("storage adapters", () => {
  it("persists, hides deleted tasks, and supports restoring across adapter instances", async () => {
    const gateway = createGateway("local");
    await gateway.create(input);
    const reopened = createGateway("local");
    expect(await reopened.list()).toHaveLength(1);
    await reopened.update(input.id, { deleted_at: new Date().toISOString() });
    expect(await gateway.list()).toHaveLength(0);
    await gateway.update(input.id, { deleted_at: null });
    expect((await reopened.list())[0].title).toBe(input.title);
  });
  it("leaves corrupt stored data untouched instead of replacing it with an empty list", async () => {
    values.set("little-list.tasks.v1", "not-json");
    await expect(createGateway("local").list()).rejects.toThrow("left untouched");
    await expect(createGateway("local").create(input)).rejects.toThrow();
    expect(values.get("little-list.tasks.v1")).toBe("not-json");
  });
  it("surfaces storage quota failures", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => { throw new Error("Quota"); } });
    await expect(createGateway("local").create(input)).rejects.toThrow("could not save");
  });
  it("reports cloud errors without writing to local storage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Database paused" }), { status: 503 })));
    await expect(createGateway("cloud").create(input)).rejects.toThrow("Database paused");
    expect(values.size).toBe(0);
  });
});
