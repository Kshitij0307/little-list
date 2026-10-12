import { NextResponse } from "next/server";
import { z } from "zod";
import { updateTaskSchema } from "@/features/tasks/domain/task";
import { updateTask } from "@/features/tasks/server/repository";
import { checkMutationOrigin, errorResponse, readJson } from "@/features/tasks/server/http";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = checkMutationOrigin(request);
  if (blocked) return blocked;
  try {
    const id = z.uuid().parse((await context.params).id);
    const task = await updateTask(id, updateTaskSchema.parse(await readJson(request)));
    return task ? NextResponse.json(task) : NextResponse.json({ error: "Task not found." }, { status: 404 });
  } catch (error) { return errorResponse(error); }
}
