import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTaskSchema, makeTask } from "../src/features/tasks/domain/task";
import {
  listTasks,
  storageMode,
} from "../src/features/tasks/server/repository";

const mocks = vi.hoisted(() => ({ range: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        is: () => {
          const query = { order: () => query, range: mocks.range };
          return query;
        },
      }),
    }),
  }),
}));

const task = makeTask(
  createTaskSchema.parse({
    id: "be7f3440-3868-4e48-90fb-f2e8dbce5b26",
    title: "An older task",
  }),
);
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_STORAGE_MODE", "cloud");
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-placeholder");
});
afterEach(() => vi.unstubAllEnvs());

describe("server storage", () => {
  it("explains a publishable key mismatch without making a database request", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_publishable_test_placeholder");
    await expect(listTasks()).rejects.toThrow(
      "Set SUPABASE_SERVICE_ROLE_KEY to a server secret key",
    );
    expect(mocks.range).not.toHaveBeenCalled();
  });
  it("requires both credentials when cloud storage is selected", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(storageMode).toThrow("Cloud storage requires");
  });
  it("uses the explicit mode instead of inferring it from credentials", () => {
    vi.stubEnv("APP_STORAGE_MODE", "local");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(storageMode()).toBe("local");

    vi.stubEnv("APP_STORAGE_MODE", "preview");
    expect(storageMode).toThrow('either "local" or "cloud"');
  });
  it("loads beyond an individual database response limit", async () => {
    mocks.range.mockResolvedValueOnce({
      data: Array.from({ length: 500 }, () => task),
      error: null,
    });
    mocks.range.mockResolvedValueOnce({ data: [task], error: null });
    expect(await listTasks()).toHaveLength(501);
    expect(mocks.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(mocks.range).toHaveBeenNthCalledWith(2, 500, 999);
  });
  it("fails rather than serving an incomplete list when a later page fails", async () => {
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
});
