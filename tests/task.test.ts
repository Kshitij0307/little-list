import { describe, expect, it } from "vitest";
import {
  applyTaskPatch,
  childTasks,
  createTaskSchema,
  makeTask,
  mainTasks,
  subtaskCandidates,
  sortTasks,
  taskFieldsSchema,
  taskSchema,
} from "../src/features/tasks/domain/task";

const input = createTaskSchema.parse({
  id: "be7f3440-3868-4e48-90fb-f2e8dbce5b26",
  title: "  Read a chapter  ",
});
const first = "2026-10-12T10:00:00.000Z";
const later = "2026-10-13T10:00:00.000Z";

describe("task lifecycle", () => {
  it("captures a title-only task in Todo with safe defaults", () => {
    expect(makeTask(input, first)).toMatchObject({
      title: "Read a chapter",
      status: "todo",
      notes: "",
      due_date: null,
      completed_at: null,
      starred: false,
    });
  });
  it("allows direct completion, preserves completion time on edits, and clears it on reopening", () => {
    const done = applyTaskPatch(
      makeTask(input, first),
      { status: "done" },
      later,
    );
    expect(done.completed_at).toBe(later);
    expect(
      applyTaskPatch(done, { notes: "Finished!" }, first).completed_at,
    ).toBe(later);
    expect(
      applyTaskPatch(done, { status: "todo" }, later).completed_at,
    ).toBeNull();
  });
  it("allows moving backward while preserving task details", () => {
    const task = applyTaskPatch(
      makeTask(input, first),
      { status: "in_progress", notes: "Start here", due_date: "2026-10-20" },
      later,
    );
    expect(applyTaskPatch(task, { status: "todo" }, later)).toMatchObject({
      notes: "Start here",
      due_date: "2026-10-20",
      status: "todo",
    });
  });
  it("restores a soft-deleted task without changing its identity", () => {
    const deleted = applyTaskPatch(
      makeTask(input, first),
      { deleted_at: later },
      later,
    );
    expect(applyTaskPatch(deleted, { deleted_at: null }, later)).toMatchObject({
      id: input.id,
      title: input.title,
      deleted_at: null,
    });
  });
  it("rejects empty titles, impossible dates, and unknown properties", () => {
    expect(taskFieldsSchema.safeParse({ title: "  " }).success).toBe(false);
    expect(
      taskFieldsSchema.safeParse({ title: "Plan", due_date: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      createTaskSchema.safeParse({ ...input, owner: "someone" }).success,
    ).toBe(false);
  });
  it("accepts Supabase timestamps with UTC offsets", () => {
    expect(
      taskSchema.safeParse({
        ...makeTask(input, first),
        created_at: "2026-10-13T10:00:00+00:00",
      }).success,
    ).toBe(true);
  });
  it("puts important active tasks first and recent completions first", () => {
    const plain = makeTask(input, first);
    const starred = {
      ...plain,
      id: "d2e80888-53ec-419d-aea0-54beb67d77b3",
      starred: true,
    };
    expect(sortTasks([plain, starred], "todo")[0].id).toBe(starred.id);
    expect(
      sortTasks(
        [
          { ...plain, completed_at: first },
          { ...starred, completed_at: later },
        ],
        "done",
      )[0].id,
    ).toBe(starred.id);
  });
});

describe("task hierarchy visibility", () => {
  const parent = makeTask(input, first);
  const child = makeTask(
    {
      ...input,
      id: "d2e80888-53ec-419d-aea0-54beb67d77b3",
      parent_id: parent.id,
    },
    first,
  );
  const grandchild = makeTask(
    {
      ...input,
      id: "e595cb27-c6f2-4f01-81dd-c17c0d0b650e",
      parent_id: child.id,
    },
    first,
  );
  it("keeps subtasks out of every home status, search, and focus filter", () => {
    const tasks = [parent, child, grandchild];
    expect(mainTasks(tasks)).toEqual([parent]);
    expect(
      mainTasks(
        tasks.map((task) => ({ ...task, status: "done", focus_today: true })),
      ),
    ).toHaveLength(1);
  });
  it("separates direct subtasks by status for a task route", () => {
    const inProgress = {
      ...child,
      id: "37cff14d-96d4-42e3-a5d6-e55bc80d625c",
      status: "in_progress" as const,
    };
    const done = {
      ...grandchild,
      parent_id: parent.id,
      status: "done" as const,
      completed_at: later,
    };

    expect(
      childTasks([parent, child, inProgress, done], parent.id, "todo"),
    ).toEqual([child]);
    expect(
      childTasks([parent, child, inProgress, done], parent.id, "in_progress"),
    ).toEqual([inProgress]);
    expect(
      childTasks([parent, child, inProgress, done], parent.id, "done"),
    ).toEqual([done]);
    expect(childTasks([parent, child, grandchild], parent.id)).toEqual([child]);
  });
  it("excludes the current task and its ancestors from existing-task choices", () => {
    expect(subtaskCandidates([parent, child, grandchild], parent.id)).toEqual(
      [],
    );
    expect(
      subtaskCandidates([parent, child, grandchild], grandchild.id),
    ).toEqual([]);
    expect(
      subtaskCandidates([parent, { ...child, parent_id: null }], parent.id),
    ).toEqual([{ ...child, parent_id: null }]);
  });
  it("keeps children hidden after parent deletion and restores access with undo", () => {
    const deleted = applyTaskPatch(parent, { deleted_at: later }, later);
    expect(mainTasks([deleted, child, grandchild])).toEqual([]);
    expect(
      mainTasks([
        applyTaskPatch(deleted, { deleted_at: null }),
        child,
        grandchild,
      ]),
    ).toHaveLength(1);
  });
});
