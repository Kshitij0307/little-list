"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NotebookStatus } from "@/components/notebook-status";

// Another tab can sign out or change accounts without remounting this layout.
export function SessionBoundary({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<"ready" | "checking" | "unavailable">(
    "ready",
  );
  const activeRequest = useRef<AbortController | null>(null);
  const verify = useCallback(async () => {
    if (document.visibilityState === "hidden" || activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    // A focus event can precede the click that opens a task. Hiding an already
    // visible notebook here removes that click target and cancels navigation.
    // Hidden-tab returns are masked by visibility(), and retries keep the mask.
    setPhase((current) => (current === "unavailable" ? "checking" : current));
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Session unavailable");
      const session: unknown = await response.json();
      if (activeRequest.current !== controller) return;
      if (
        !session ||
        typeof session !== "object" ||
        !("userId" in session) ||
        (session.userId !== null && typeof session.userId !== "string")
      ) {
        throw new Error("Invalid session response");
      }
      if (session.userId !== userId) {
        window.location.replace(session.userId ? "/" : "/login");
        return;
      }
      setPhase(document.hidden ? "checking" : "ready");
    } catch {
      if (activeRequest.current === controller) setPhase("unavailable");
    } finally {
      window.clearTimeout(timeout);
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }, [userId]);

  useEffect(() => {
    function visibility() {
      if (document.visibilityState === "hidden") setPhase("checking");
      else void verify();
    }
    function restored(event: PageTransitionEvent) {
      if (event.persisted) {
        setPhase("checking");
        void verify();
      }
    }
    window.addEventListener("focus", verify);
    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("focus", verify);
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", visibility);
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [verify]);
  return (
    <>
      {phase !== "ready" && (
        <NotebookStatus
          onRetry={phase === "unavailable" ? verify : undefined}
        />
      )}
      <div hidden={phase !== "ready"}>{children}</div>
    </>
  );
}
