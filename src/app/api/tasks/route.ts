import { NextResponse } from "next/server";
import { createTaskSchema } from "@/features/tasks/domain/task";
import { createTask, listTasks } from "@/features/tasks/server/repository";
import {
  checkMutationOrigin,
  errorResponse,
  readJson,
} from "@/features/tasks/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listTasks(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const blocked = checkMutationOrigin(request);
  if (blocked) return blocked;
  try {
    return NextResponse.json(
      await createTask(createTaskSchema.parse(await readJson(request))),
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
