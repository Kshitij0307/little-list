import { NextResponse } from "next/server";
import {
  AuthenticationUnavailableError,
  currentSession,
} from "@/features/auth/server/session";
import { storageMode } from "@/lib/supabase/config";

export async function GET() {
  try {
    const session = storageMode() === "cloud" ? await currentSession() : null;
    return NextResponse.json(
      { userId: session?.user.id ?? null },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    if (!(error instanceof AuthenticationUnavailableError)) throw error;
    return NextResponse.json(
      { error: error.message },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
