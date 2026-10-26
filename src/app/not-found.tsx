import { NotebookNotice } from "@/components/notebook-notice";
import { PageShell } from "@/components/page-shell";

export default function NotFound() {
  return (
    <PageShell>
      <NotebookNotice kind="not-found" />
    </PageShell>
  );
}
