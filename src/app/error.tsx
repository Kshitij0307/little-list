"use client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset(): void }) {
  return (
    <main className="workspace empty-state">
      <h1>Let’s try that again.</h1>
      <p>
        The notebook could not open. If you’re connecting Supabase, check that
        both environment variables are set.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
