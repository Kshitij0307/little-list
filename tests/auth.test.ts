import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentSession,
  requireTaskSession,
  AuthenticationRequiredError,
  AuthenticationUnavailableError,
} from "../src/features/auth/server/session";
import { appOrigin } from "../src/lib/supabase/config";
import { GET as callback } from "../src/app/auth/callback/route";
import { errorResponse } from "../src/features/tasks/server/http";
import {
  AuthApiError,
  AuthInvalidJwtError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), exchange: vi.fn() }));
vi.mock("../src/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getClaims: mocks.getClaims,
      exchangeCodeForSession: mocks.exchange,
    },
  }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_STORAGE_MODE", "cloud");
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_placeholder");
  vi.stubEnv("APP_URL", "https://list.example");
});
afterEach(() => vi.unstubAllEnvs());

describe("authentication boundary", () => {
  it("uses only verified signed claims for the task owner", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "verified-owner", email: "owner@example.com" } },
      error: null,
    });
    expect((await requireTaskSession()).user.id).toBe("verified-owner");
    expect((await currentSession())?.user.email).toBe("owner@example.com");
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "untrusted" } },
      error: new AuthApiError("Invalid token", 401, "bad_jwt"),
    });
    expect(await currentSession()).toBeNull();
    await expect(requireTaskSession()).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
  });
  it("rejects missing, expired and invalid sessions without trusting returned claims", async () => {
    for (const error of [
      new AuthSessionMissingError(),
      new AuthInvalidJwtError("JWT has expired"),
      new AuthInvalidJwtError("Invalid JWT signature"),
      new AuthApiError("Invalid token", 401, "bad_jwt"),
    ]) {
      mocks.getClaims.mockResolvedValue({
        data: { claims: { sub: "untrusted" } },
        error,
      });
      expect(await currentSession()).toBeNull();
      await expect(requireTaskSession()).rejects.toBeInstanceOf(
        AuthenticationRequiredError,
      );
    }
  });
  it("rejects a missing token without opening a task session", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    expect(await currentSession()).toBeNull();
    await expect(requireTaskSession()).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
  });
  it.each([
    new AuthRetryableFetchError("Sensitive upstream detail", 503),
    new AuthApiError("Rate limit detail", 429, "over_request_rate_limit"),
  ])(
    "reports unavailable verification separately from sign-out",
    async (error) => {
      mocks.getClaims.mockResolvedValue({ data: null, error });
      await expect(requireTaskSession()).rejects.toBeInstanceOf(
        AuthenticationUnavailableError,
      );
      expect(errorResponse(new AuthenticationUnavailableError()).status).toBe(
        503,
      );
    },
  );
  it("handles a rejected Auth request without reporting a missing session", async () => {
    mocks.getClaims.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(currentSession()).rejects.toBeInstanceOf(
      AuthenticationUnavailableError,
    );
  });
  it("never opens the cloud database from local mode", async () => {
    vi.stubEnv("APP_STORAGE_MODE", "local");
    await expect(requireTaskSession()).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
    expect(mocks.getClaims).not.toHaveBeenCalled();
  });
  it("returns a non-cacheable 401 for missing sessions", async () => {
    const response = errorResponse(new AuthenticationRequiredError());
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("validates the configured application origin", () => {
    for (const invalid of [
      "http://evil.example",
      "https://user:pass@list.example",
      "https://list.example/path",
    ]) {
      vi.stubEnv("APP_URL", invalid);
      expect(appOrigin).toThrow();
    }
    vi.stubEnv("APP_URL", "http://localhost:3000");
    expect(appOrigin()).toBe("http://localhost:3000");
  });
  it("exchanges the OAuth code and redirects only to the configured origin", async () => {
    mocks.exchange.mockResolvedValue({ error: null });
    const response = await callback(
      new Request(
        "https://untrusted.example/auth/callback?code=example&next=https://evil.example",
      ),
    );
    expect(mocks.exchange).toHaveBeenCalledWith("example");
    expect(response.headers.get("location")).toBe("https://list.example/");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("handles cancelled, missing and rejected OAuth codes without exposing errors", async () => {
    const cancelled = await callback(
      new Request("https://list.example/auth/callback?error=access_denied"),
    );
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(cancelled.headers.get("location")).toBe(
      "https://list.example/login?error=callback",
    );
    mocks.exchange.mockResolvedValue({
      error: new Error("Sensitive provider error"),
    });
    const rejected = await callback(
      new Request("https://list.example/auth/callback?code=bad"),
    );
    expect(rejected.headers.get("location")).toBe(
      "https://list.example/login?error=callback",
    );
  });
});
