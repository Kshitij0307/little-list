"use client";
import workspaceStyles from "./task-workspace.module.css";
import feedbackStyles from "@/components/ui/feedback.module.css";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownToLine,
  Check,
  Cloud,
  HardDrive,
  LoaderCircle,
  Sun,
  X,
} from "lucide-react";
import { ThemeMenu } from "@/components/theme-menu";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import paper from "@/components/ui/paper.module.css";
import { NotebookStatus } from "@/components/notebook-status";
import { localDate, mainTasks } from "../domain/task";
import { useTaskContext } from "../hooks/tasks-provider";
export function TaskWorkspace({
  children,
  account,
}: {
  children: ReactNode;
  account?: ReactNode;
}) {
  const {
    mode,
    tasks,
    loading,
    refreshing,
    busy,
    error,
    undoAction,
    undo,
    dismissUndo,
  } = useTaskContext();
  const isDetail = usePathname() !== "/";
  const [today, setToday] = useState("");
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setToday(
          new Intl.DateTimeFormat("en", {
            weekday: "long",
            month: "long",
            day: "numeric",
          }).format(new Date()),
        ),
      0,
    );
    return () => clearTimeout(timer);
  }, []);
  if (isDetail && loading) return <NotebookStatus />;
  const completedToday = mainTasks(tasks).filter(
    (task) =>
      task.completed_at &&
      localDate(new Date(task.completed_at)) === localDate(),
  ).length;
  function exportTasks() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { version: 1, exported_at: new Date().toISOString(), tasks },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `little-list-${localDate()}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className={workspaceStyles["app-shell"]}>
      <header className={workspaceStyles["site-header"]}>
        <Link href="/" aria-label="Little list home">
          <Brand />
        </Link>
        <div className={workspaceStyles["header-actions"]}>
          <span className={workspaceStyles["header-caption"]}>
            Less noise. More doing.
          </span>
          <ThemeMenu />
          {account}
        </div>
      </header>

      <main className={workspaceStyles["workspace"]}>
        <section
          className={workspaceStyles["intro"]}
          aria-labelledby="page-title"
        >
          <p className={workspaceStyles["eyebrow"]}>
            <span className={workspaceStyles["small-line"]} /> YOUR EVERYDAY
            COMPANION
          </p>
          <div className={workspaceStyles["intro-heading"]}>
            <div>
              <h1 className={workspaceStyles["intro-title"]} id="page-title">
                A little list.
                <br />
                <span>A clearer mind.</span>
              </h1>
              <p className={workspaceStyles["intro-copy"]}>
                Get it out of your head. Take it one task at a time.
              </p>
            </div>
            <div className={workspaceStyles["date-note"]}>
              <Sun size={24} strokeWidth={1.2} />
              <span>{today || "Make a little room for today."}</span>
              <span className={workspaceStyles["date-note-small"]}>
                A good day to begin.
              </span>
            </div>
          </div>
        </section>

        <section
          className={`${paper.surface} ${paper.margin} ${workspaceStyles["notebook"]}`}
          aria-label="Your tasks"
        >
          {children}
          <div className={workspaceStyles["notebook-footer"]}>
            <span className={workspaceStyles["save-status"]} role="status">
              {busy ? (
                <>
                  <LoaderCircle size={13} className={feedbackStyles["spin"]} />
                  Saving…
                </>
              ) : loading ? (
                "Loading…"
              ) : refreshing ? (
                <>
                  <Cloud size={13} />
                  Syncing…
                </>
              ) : error ? (
                "Changes need attention"
              ) : (
                <>
                  <Check size={14} />
                  {mode === "local"
                    ? "Saved on this browser"
                    : "Saved to your notebook"}
                </>
              )}
            </span>
            <span>
              {completedToday
                ? `${completedToday} ${completedToday === 1 ? "task" : "tasks"} finished today`
                : "Every small step counts."}
            </span>
          </div>
        </section>

        <footer className={workspaceStyles["workspace-footer"]}>
          <span className={workspaceStyles["storage-note"]}>
            {mode === "cloud" ? <Cloud size={14} /> : <HardDrive size={14} />}
            {mode === "cloud"
              ? "Private notebook · Cloud storage"
              : "Local notebook · This browser only"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={exportTasks}
            disabled={loading || busy || !!error}
          >
            <ArrowDownToLine size={14} />
            Export list
          </Button>
        </footer>
        {mode === "local" && (
          <p className={workspaceStyles["local-note"]}>
            Connect Supabase to keep the same list on your phone and laptop.
          </p>
        )}
        <p className={workspaceStyles["keyboard-note"]}>
          {isDetail ? (
            "Every task deserves a clear next step."
          ) : (
            <>
              <kbd>N</kbd> new task <span>·</span> <kbd>/</kbd> search{" "}
              <span>·</span> Make space for what matters.
            </>
          )}
        </p>
      </main>

      {undoAction && (
        <div className={workspaceStyles["undo-toast"]} role="status">
          <Check size={16} />
          <span>{undoAction.label}</span>
          <button disabled={busy} onClick={() => void undo()}>
            Undo
          </button>
          <button aria-label="Dismiss notification" onClick={dismissUndo}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
