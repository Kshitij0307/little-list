import { NextResponse } from "next/server";
import { appOrigin, storageMode } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const origin = appOrigin();
  const code = new URL(request.url).searchParams.get("code");
  if (storageMode() === "cloud" && code) {
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(`${origin}/`, {
        headers: { "Cache-Control": "no-store" },
      });
  }
  return NextResponse.redirect(`${origin}/login?error=callback`, {
    headers: { "Cache-Control": "no-store" },
  });
}
