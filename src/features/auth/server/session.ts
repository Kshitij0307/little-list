import "server-only";
import {
  isAuthApiError,
  isAuthError,
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
  // Verify the signed access token instead of trusting cookie contents.
  const { data, error } = await client.auth.getClaims().catch(() => {
    throw new AuthenticationUnavailableError();
  });
  if (error) {
    if (
      isAuthSessionMissingError(error) ||
      (isAuthError(error) && error.code === "invalid_jwt") ||
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
  return data?.claims && typeof data.claims.sub === "string" && data.claims.sub
    ? {
        client,
        user: { id: data.claims.sub, email: data.claims.email },
      }
    : null;
}

export async function requireTaskSession() {
  // Local storage never opens a server database connection.
  if (storageMode() !== "cloud") throw new AuthenticationRequiredError();
  const session = await currentSession();
  if (!session) throw new AuthenticationRequiredError();
  return session;
}
