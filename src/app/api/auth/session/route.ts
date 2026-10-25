import { NextResponse } from "next/server";
import { currentSession } from "@/features/auth/server/session";
import { storageMode } from "@/lib/supabase/config";

export async function GET() {
  const session = storageMode() === "cloud" ? await currentSession() : null;
  return NextResponse.json(
    { userId: session?.user.id ?? null },
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
