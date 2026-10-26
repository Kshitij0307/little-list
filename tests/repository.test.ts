import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTaskSchema, makeTask } from "../src/features/tasks/domain/task";
import {
  createTask,
  listTasks,
  storageMode,
  updateTask,
  moveTasks,
  TaskConflictError,
  deleteTasks,
} from "../src/features/tasks/server/repository";
import { AuthenticationRequiredError } from "../src/features/auth/server/session";

const mocks = vi.hoisted(() => ({
  range: vi.fn(),
  eq: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
  session: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("../src/features/auth/server/session", () => ({
  AuthenticationRequiredError: class extends Error {},
  requireTaskSession: mocks.session,
}));
const query = {
  select: () => query,
  is: () => query,
  order: () => query,
  eq: mocks.eq,
  insert: mocks.insert,
  update: mocks.update,
  range: mocks.range,
  single: mocks.single,
  maybeSingle: mocks.maybeSingle,
};
const owner = "d2e80888-53ec-419d-aea0-54beb67d77b3";
const task = makeTask(
  createTaskSchema.parse({
    id: "be7f3440-3868-4e48-90fb-f2e8dbce5b26",
    title: "An older task",
  }),
);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.eq.mockReturnValue(query);
  mocks.insert.mockReturnValue(query);
  mocks.update.mockReturnValue(query);
  mocks.session.mockResolvedValue({
    client: { from: () => query, rpc: mocks.rpc },
    user: { id: owner },
  });
  vi.stubEnv("APP_STORAGE_MODE", "cloud");
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_placeholder");
});
afterEach(() => vi.unstubAllEnvs());

describe("private server storage", () => {
  it("soft-deletes and restores through the authenticated batch transaction", async () => {
    const input = {
      ids: [task.id],
      from_status: "todo" as const,
      parent_id: null,
      deleted_at: "2026-10-27T10:00:00Z",
      restore: false,
    };
    mocks.rpc.mockResolvedValue({
      data: [{ ...task, deleted_at: input.deleted_at }],
      error: null,
    });
    expect((await deleteTasks(input))[0].deleted_at).toBe(input.deleted_at);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("delete_tasks", {
      task_ids: input.ids,
      from_status: "todo",
      task_parent_id: null,
      deletion_time: input.deleted_at,
      restoring: false,
    });
    mocks.rpc.mockResolvedValue({ data: [task], error: null });
    expect(
      (await deleteTasks({ ...input, restore: true }))[0].deleted_at,
    ).toBeNull();
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23514" } });
    await expect(deleteTasks(input)).rejects.toBeInstanceOf(TaskConflictError);
  });
  it("uses one authenticated transactional RPC and reports conflicts without partial success", async () => {
    const move = {
      ids: [task.id],
      from_status: "todo" as const,
      to_status: "done" as const,
      parent_id: null,
    };
    const saved = { ...task, status: "done" as const };
    mocks.rpc.mockResolvedValue({ data: [saved], error: null });
    expect(await moveTasks(move)).toEqual([saved]);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("move_tasks", {
      task_ids: [task.id],
      from_status: "todo",
      to_status: "done",
      task_parent_id: null,
    });
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23514" } });
    await expect(moveTasks(move)).rejects.toBeInstanceOf(TaskConflictError);
    mocks.session.mockRejectedValue(new AuthenticationRequiredError());
    mocks.rpc.mockClear();
    await expect(moveTasks(move)).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects secret keys and missing cloud credentials", () => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_secret_test_placeholder");
    expect(storageMode).toThrow("publishable key");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    expect(storageMode).toThrow("Cloud storage requires");
  });
  it("uses the explicit mode instead of inferring it from credentials", () => {
    vi.stubEnv("APP_STORAGE_MODE", "local");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    expect(storageMode()).toBe("local");
    vi.stubEnv("APP_STORAGE_MODE", "preview");
    expect(storageMode).toThrow('either "local" or "cloud"');
  });
  it("loads all pages scoped to the verified user", async () => {
    mocks.range.mockResolvedValueOnce({
      data: Array.from({ length: 500 }, () => task),
      error: null,
    });
    mocks.range.mockResolvedValueOnce({ data: [task], error: null });
    const result = await listTasks();
    expect(result.userId).toBe(owner);
    expect(result.tasks).toHaveLength(501);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", owner);
    expect(mocks.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(mocks.range).toHaveBeenNthCalledWith(2, 500, 999);
  });
  it("fails instead of serving an incomplete list", async () => {
    mocks.range.mockResolvedValueOnce({
      data: Array.from({ length: 500 }, () => task),
      error: null,
    });
    mocks.range.mockResolvedValueOnce({
      data: null,
      error: { message: "Offline" },
    });
    await expect(listTasks()).rejects.toThrow("Unable to load tasks");
  });
  it("reuses a server-verified session when loading the initial notebook", async () => {
    const session = await mocks.session();
    mocks.session.mockClear();
    mocks.range.mockResolvedValue({ data: [task], error: null });
    expect(await listTasks(session)).toEqual({ userId: owner, tasks: [task] });
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.eq).toHaveBeenCalledWith("user_id", owner);
  });
  it("assigns ownership from the verified session", async () => {
    mocks.single.mockResolvedValue({ data: task, error: null });
    await createTask(
      createTaskSchema.parse({ id: task.id, title: task.title }),
    );
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: owner }),
    );
  });
  it("scopes updates by owner and rejects attempts to transfer ownership", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(
      updateTask(task.id, {
        title: "Changed",
        user_id: "someone-else",
      } as never),
    ).rejects.toThrow();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(await updateTask(task.id, { title: "Changed" })).toBeNull();
    expect(mocks.eq).toHaveBeenCalledWith("id", task.id);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", owner);
    expect(mocks.update).toHaveBeenCalledWith({ title: "Changed" });
  });
  it("refuses every data operation without a verified session", async () => {
    mocks.session.mockRejectedValue(new AuthenticationRequiredError());
    await expect(listTasks()).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
    await expect(
      createTask(createTaskSchema.parse({ id: task.id, title: task.title })),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
    await expect(
      updateTask(task.id, { status: "done" }),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
    expect(mocks.range).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
