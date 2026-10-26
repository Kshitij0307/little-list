import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../src/app/api/tasks/route";
import { PATCH } from "../src/app/api/tasks/[id]/route";
import {
  createTask,
  listTasks,
  TaskRepositoryError,
  updateTask,
} from "../src/features/tasks/server/repository";
import { createTaskSchema, makeTask } from "../src/features/tasks/domain/task";

vi.mock("../src/features/tasks/server/repository", () => ({
  createTask: vi.fn(),
  listTasks: vi.fn(),
  updateTask: vi.fn(),
  TaskRepositoryError: class extends Error {},
}));

const input = createTaskSchema.parse({
  id: "be7f3440-3868-4e48-90fb-f2e8dbce5b26",
  title: "Try the notebook",
});
const task = makeTask(input);
function request(body: unknown, method = "POST") {
  return new Request("https://list.example/api/tasks", {
    method,
    headers: {
      "content-type": "application/json",
      host: "list.example",
      origin: "https://list.example",
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => vi.resetAllMocks());

describe("task API", () => {
  it("returns an uncached list", async () => {
    vi.mocked(listTasks).mockResolvedValue({
      userId: "verified-owner",
      tasks: [task],
    });
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      userId: "verified-owner",
      tasks: [task],
    });
  });
  it("validates before persisting a new task", async () => {
    expect((await POST(request({ id: input.id, title: " " }))).status).toBe(
      400,
    );
    expect(createTask).not.toHaveBeenCalled();
    vi.mocked(createTask).mockResolvedValue(task);
    expect(
      (await POST(request({ id: input.id, title: input.title }))).status,
    ).toBe(201);
    expect(createTask).toHaveBeenCalledWith(input);
  });
  it("does not add defaults to partial updates", async () => {
    vi.mocked(updateTask).mockResolvedValue({ ...task, status: "in_progress" });
    const response = await PATCH(request({ status: "in_progress" }, "PATCH"), {
      params: Promise.resolve({ id: task.id }),
    });
    expect(response.status).toBe(200);
    expect(updateTask).toHaveBeenCalledWith(task.id, { status: "in_progress" });
  });
  it("persists parent links for new and existing subtasks", async () => {
    const parentId = "d2e80888-53ec-419d-aea0-54beb67d77b3";
    const subtask = { ...task, parent_id: parentId };
    vi.mocked(createTask).mockResolvedValue(subtask);
    expect(
      (await POST(request({ ...input, parent_id: parentId }))).status,
    ).toBe(201);
    expect(createTask).toHaveBeenCalledWith({ ...input, parent_id: parentId });
    vi.mocked(updateTask).mockResolvedValue(subtask);
    expect(
      (
        await PATCH(request({ parent_id: parentId }, "PATCH"), {
          params: Promise.resolve({ id: task.id }),
        })
      ).status,
    ).toBe(200);
    expect(updateTask).toHaveBeenCalledWith(task.id, { parent_id: parentId });
  });
  it("returns not-found and malformed-ID responses", async () => {
    vi.mocked(updateTask).mockResolvedValue(null);
    expect(
      (
        await PATCH(request({ status: "done" }, "PATCH"), {
          params: Promise.resolve({ id: task.id }),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await PATCH(request({ status: "done" }, "PATCH"), {
          params: Promise.resolve({ id: "invalid" }),
        })
      ).status,
    ).toBe(400);
  });
  it("reports backend failures instead of returning false success", async () => {
    vi.mocked(listTasks).mockRejectedValue(
      new TaskRepositoryError("Unable to load tasks."),
    );
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Unable to load tasks. Please try again.",
    });
  });
});
