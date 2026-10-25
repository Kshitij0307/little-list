"use client";
import feedbackStyles from "@/components/ui/feedback.module.css";

import { Button } from "@/components/ui/button";
import { useTaskContext } from "../hooks/tasks-provider";

export function TaskErrorBanner() {
  const { error, busy, reload } = useTaskContext();
  if (!error) return null;
  return (
    <div className={feedbackStyles["error-banner"]} role="alert">
      <span>{error}</span>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => void reload()}
      >
        Retry
      </Button>
    </div>
  );
}
