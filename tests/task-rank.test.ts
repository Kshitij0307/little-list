import { describe, expect, it } from "vitest";
import {
  applyLocalRankMove,
  rankBetween,
  spacedRanks,
} from "../src/features/tasks/domain/task-rank";
import {
  createTaskSchema,
  makeTask,
  sortTasks,
} from "../src/features/tasks/domain/task";

const make = (id: string, rank: string, pinned = false) =>
  makeTask(
    createTaskSchema.parse({ id, title: id, pinned }),
    "2026-11-05T00:00:00.000Z",
    rank,
  );

describe("task ranks", () => {
  it("creates deterministic ranks at the beginning, middle, and end", () => {
    const [first, second] = spacedRanks(2);
    expect(rankBetween(null, first) < first).toBe(true);
    expect(rankBetween(first, second)).toSatisfy(
      (rank: string) => first < rank && rank < second,
    );
    expect(rankBetween(second, null) > second).toBe(true);
  });

  it("updates only the moved task during a normal local reorder", () => {
    const [firstRank, secondRank, thirdRank] = spacedRanks(3);
    const first = make("be7f3440-3868-4e48-90fb-f2e8dbce5b26", firstRank);
    const second = make("d2e80888-53ec-419d-aea0-54beb67d77b3", secondRank);
    const third = make("e595cb27-c6f2-4f01-81dd-c17c0d0b650e", thirdRank);
    const result = applyLocalRankMove([first, second, third], {
      id: third.id,
      before_id: first.id,
      after_id: second.id,
      status: "todo",
      parent_id: null,
      pinned: false,
    });
    expect(result.tasks.find((task) => task.id === first.id)?.rank).toBe(
      firstRank,
    );
    expect(result.tasks.find((task) => task.id === second.id)?.rank).toBe(
      secondRank,
    );
    expect(sortTasks(result.tasks, "todo").map((task) => task.id)).toEqual([
      first.id,
      third.id,
      second.id,
    ]);
  });

  it("rejects neighbours from the other pinned group", () => {
    const [firstRank, secondRank] = spacedRanks(2);
    const regular = make("be7f3440-3868-4e48-90fb-f2e8dbce5b26", firstRank);
    const pinned = make(
      "d2e80888-53ec-419d-aea0-54beb67d77b3",
      secondRank,
      true,
    );
    expect(() =>
      applyLocalRankMove([regular, pinned], {
        id: regular.id,
        before_id: null,
        after_id: pinned.id,
        status: "todo",
        parent_id: null,
        pinned: false,
      }),
    ).toThrow("list changed");
  });
});
