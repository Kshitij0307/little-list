import { z } from "zod";
import type { Task } from "./task";

export const RANK_WIDTH = 12;
const BASE = 36n;
const MAX_RANK = BASE ** BigInt(RANK_WIDTH) - 1n;
const RANK_STEP = BASE ** 6n;
export const taskRankSchema = z
  .string()
  .regex(/^[0-9a-z]{12}$/, "Invalid task rank.");

function decode(rank: string): bigint {
  taskRankSchema.parse(rank);
  let value = 0n;
  for (const character of rank)
    value = value * BASE + BigInt(parseInt(character, 36));
  return value;
}

function encode(value: bigint): string {
  if (value <= 0n || value >= MAX_RANK)
    throw new Error("No task rank is available in this gap.");
  return value.toString(36).padStart(RANK_WIDTH, "0");
}

export function rankBetween(
  previous: string | null,
  next: string | null,
): string {
  const lower = previous ? decode(previous) : 0n;
  if (!next && previous) {
    const after = decode(previous) + RANK_STEP;
    if (after < MAX_RANK) return encode(after);
  }
  const upper = next ? decode(next) : MAX_RANK;
  if (lower >= upper) throw new Error("Task rank boundaries are out of order.");
  const middle = (lower + upper) / 2n;
  if (middle === lower || middle === upper)
    throw new Error("No task rank is available in this gap.");
  return encode(middle);
}

export function spacedRanks(count: number): string[] {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error("Invalid task count.");
  const step = RANK_STEP;
  if (BigInt(count + 1) * step >= MAX_RANK)
    throw new Error("Too many tasks to rank.");
  return Array.from({ length: count }, (_, index) =>
    encode(step * BigInt(index + 1)),
  );
}

export type TaskRankMove = {
  id: string;
  before_id: string | null;
  after_id: string | null;
  status: Task["status"];
  parent_id: string | null;
  pinned: boolean;
};

export const taskRankMoveSchema = z
  .object({
    id: z.uuid(),
    before_id: z.uuid().nullable(),
    after_id: z.uuid().nullable(),
    status: z.enum(["todo", "in_progress", "done"]),
    parent_id: z.uuid().nullable(),
    pinned: z.boolean(),
  })
  .strict()
  .refine((move) => move.id !== move.before_id && move.id !== move.after_id, {
    message: "A task cannot be its own neighbour.",
  });

export function sameRankScope(task: Task, move: TaskRankMove): boolean {
  return (
    !task.deleted_at &&
    task.status === move.status &&
    task.parent_id === move.parent_id &&
    task.pinned === move.pinned
  );
}

export function applyLocalRankMove(
  tasks: Task[],
  input: TaskRankMove,
): { tasks: Task[]; moved: Task } {
  const move = taskRankMoveSchema.parse(input);
  const current = tasks.find((task) => task.id === move.id);
  if (!current || !sameRankScope(current, move))
    throw new Error("The task changed. Refresh your list and try again.");
  const siblings = tasks
    .filter((task) => task.id !== move.id && sameRankScope(task, move))
    .sort((a, b) => a.rank.localeCompare(b.rank) || a.id.localeCompare(b.id));
  const beforeIndex = move.before_id
    ? siblings.findIndex((task) => task.id === move.before_id)
    : -1;
  const afterIndex = move.after_id
    ? siblings.findIndex((task) => task.id === move.after_id)
    : siblings.length;
  if (
    (move.before_id && beforeIndex < 0) ||
    (move.after_id && afterIndex < 0) ||
    afterIndex !== beforeIndex + 1
  )
    throw new Error("The task list changed. Refresh and try again.");

  let rank: string;
  try {
    rank = rankBetween(
      beforeIndex >= 0 ? siblings[beforeIndex].rank : null,
      afterIndex < siblings.length ? siblings[afterIndex].rank : null,
    );
  } catch {
    const ordered = [...siblings];
    ordered.splice(afterIndex, 0, current);
    const ranks = spacedRanks(ordered.length);
    const byId = new Map(ordered.map((task, index) => [task.id, ranks[index]]));
    const rebalanced = tasks.map((task) =>
      byId.has(task.id) ? { ...task, rank: byId.get(task.id)! } : task,
    );
    return {
      tasks: rebalanced,
      moved: rebalanced.find((task) => task.id === move.id)!,
    };
  }
  const moved = { ...current, rank };
  return {
    tasks: tasks.map((task) => (task.id === move.id ? moved : task)),
    moved,
  };
}
