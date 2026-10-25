"use client";

import { useEffect, useState, type ReactNode } from "react";

// Another tab can sign out or change accounts without remounting this layout.
export function SessionBoundary({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    let disposed = false;
    let pending = false;
    async function verify() {
      if (document.visibilityState === "hidden" || pending) return;
      pending = true;
      setChecking(true);
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Session unavailable");
        const session = await response.json();
        if (disposed) return;
        if (session.userId !== userId) {
          window.location.replace(session.userId ? "/" : "/login");
          return;
        }
        setChecking(false);
      } catch {
        if (!disposed) window.location.reload();
      } finally {
        pending = false;
      }
    }
    function visibility() {
      if (document.visibilityState === "hidden") setChecking(true);
      else void verify();
    }
    function restored(event: PageTransitionEvent) {
      if (event.persisted) void verify();
    }
    window.addEventListener("focus", verify);
    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      window.removeEventListener("focus", verify);
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [userId]);
  return (
    <>
      {checking && <p role="status">Checking your session…</p>}
      <div hidden={checking}>{children}</div>
    </>
  );
}
