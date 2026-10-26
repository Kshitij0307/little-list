import "server-only";
import {
  isAuthApiError,
  isAuthSessionMissingError,
} from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { storageMode } from "@/lib/supabase/config";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Please sign in to access your notebook.");
  }
}

export class AuthenticationUnavailableError extends Error {
  constructor() {
    super("We couldn’t verify your session. Please try again.");
  }
}

export async function currentSession() {
  const client = await createSupabaseServerClient();
  // Verify with Auth, rather than trusting user data embedded in a session cookie.
  const {
    data: { user },
    error,
  } = await client.auth.getUser().catch(() => {
    throw new AuthenticationUnavailableError();
  });
  if (error) {
    if (
      isAuthSessionMissingError(error) ||
      (isAuthApiError(error) &&
        (error.status === 401 ||
          error.status === 403 ||
          [
            "bad_jwt",
            "session_not_found",
            "refresh_token_not_found",
            "refresh_token_already_used",
          ].includes(error.code ?? "")))
    )
      return null;
    // An unavailable Auth service does not mean the user has signed out.
    throw new AuthenticationUnavailableError();
  }
  return user ? { client, user } : null;
}

export async function requireTaskSession() {
  // Local storage never opens a server database connection.
  if (storageMode() !== "cloud") throw new AuthenticationRequiredError();
  const session = await currentSession();
  if (!session) throw new AuthenticationRequiredError();
  return session;
}
