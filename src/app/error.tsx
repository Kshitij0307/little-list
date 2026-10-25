"use client";
import styles from "./error.module.css";
import feedbackStyles from "@/components/ui/feedback.module.css";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset(): void }) {
  return (
    <main
      className={[styles.container, feedbackStyles["empty-state"]].join(" ")}
    >
      <h1>Let’s try that again.</h1>
      <p>
        The notebook could not open. If you’re connecting Supabase, check that
        the storage mode and required credentials are configured.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
