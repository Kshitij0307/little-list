import { NextResponse } from "next/server";
import { taskBatchSchema } from "@/features/tasks/domain/task-batch";
import { moveTasks, deleteTasks } from "@/features/tasks/server/repository";
import {
  checkMutationOrigin,
  errorResponse,
  readJson,
} from "@/features/tasks/server/http";

export async function PATCH(request: Request) {
  const blocked = checkMutationOrigin(request);
  if (blocked) return blocked;
  try {
    const input = taskBatchSchema.parse(await readJson(request));
    return NextResponse.json(
      await ("to_status" in input ? moveTasks(input) : deleteTasks(input)),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
