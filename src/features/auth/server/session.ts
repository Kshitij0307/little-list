import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { storageMode } from "@/lib/supabase/config";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Please sign in to access your notebook.");
  }
}

export async function currentSession() {
  const client = await createSupabaseServerClient();
  // Verify with Auth, rather than trusting user data embedded in a session cookie.
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  return !error && user ? { client, user } : null;
}

export async function requireTaskSession() {
  // Local storage never opens a server database connection.
  if (storageMode() !== "cloud") throw new AuthenticationRequiredError();
  const session = await currentSession();
  if (!session) throw new AuthenticationRequiredError();
  return session;
}
