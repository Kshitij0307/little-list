import "server-only";

export function storageMode(): "local" | "cloud" {
  const mode = process.env.APP_STORAGE_MODE;
  if (mode !== "local" && mode !== "cloud")
    throw new Error('Set APP_STORAGE_MODE to either "local" or "cloud".');
  if (mode === "cloud") supabaseConfig();
  return mode;
}

export function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Cloud storage requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.",
    );
  if (!key.startsWith("sb_publishable_"))
    throw new Error(
      "Use a Supabase publishable key (sb_publishable_...), never a secret key.",
    );
  return { url, key };
}

export function appOrigin() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("Set APP_URL to the app's full URL.");
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new Error(
      "APP_URL must be an HTTPS origin, or HTTP localhost for development.",
    );
  return url.origin;
}

// All authentication is server-side; no browser SDK needs access to these cookies.
export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};
