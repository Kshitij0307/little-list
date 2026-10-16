import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { TaskRepositoryError } from "./repository";

export function checkMutationOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  try {
    if (
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && new URL(origin).host !== host)
    ) {
      return NextResponse.json(
        { error: "Cross-site requests are not allowed." },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  }
  return null;
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new TypeError("Send JSON.");
  const text = await request.text();
  if (text.length > 20_000) throw new TypeError("Request is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new TypeError("Invalid JSON.");
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Invalid task." },
      { status: 400 },
    );
  if (error instanceof TypeError)
    return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof TaskRepositoryError)
    return NextResponse.json(
      { error: `${error.message} Please try again.` },
      { status: 503 },
    );
  console.error(
    "Task request failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
