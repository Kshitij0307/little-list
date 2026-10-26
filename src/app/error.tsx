"use client";
import { NotebookNotice } from "@/components/notebook-notice";
import { PageShell } from "@/components/page-shell";

export default function ErrorPage({ retry }: { retry(): void }) {
  return (
    <PageShell>
      <NotebookNotice kind="error" onRetry={retry} />
    </PageShell>
  );
}
