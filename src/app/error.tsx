"use client";
import { NotebookNotice } from "@/components/notebook-notice";
import styles from "./error.module.css";

export default function ErrorPage({ retry }: { retry(): void }) {
  return (
    <div className={styles.page}>
      <NotebookNotice kind="error" onRetry={retry} />
    </div>
  );
}
