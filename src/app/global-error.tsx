"use client";

import { NotebookNotice } from "@/components/notebook-notice";
import { PageShell } from "@/components/page-shell";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export default function GlobalError({ retry }: { retry(): void }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <title>Little list — Something went wrong</title>
        <ThemeProvider>
          <PageShell>
            <NotebookNotice kind="error" onRetry={retry} />
          </PageShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
