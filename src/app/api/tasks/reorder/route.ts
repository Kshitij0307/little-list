import { NextResponse } from "next/server";
import { taskRankMoveSchema } from "@/features/tasks/domain/task-rank";
import { reorderTask } from "@/features/tasks/server/repository";
import {
  checkMutationOrigin,
  errorResponse,
  readJson,
} from "@/features/tasks/server/http";

export async function PATCH(request: Request) {
  const blocked = checkMutationOrigin(request);
  if (blocked) return blocked;
  try {
    return NextResponse.json(
      await reorderTask(taskRankMoveSchema.parse(await readJson(request))),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
