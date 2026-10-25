"use server";

import { redirect } from "next/navigation";
import { appOrigin, storageMode } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signInWithGoogle() {
  if (storageMode() !== "cloud") redirect("/");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appOrigin()}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/login?error=signin");
  redirect(data.url);
}

export async function signOut() {
  const client = await createSupabaseServerClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new Error("Could not sign out. Please try again.");
  // Cookie changes invalidate Next's router cache; the notebook provider unmounts.
  redirect("/login");
}
