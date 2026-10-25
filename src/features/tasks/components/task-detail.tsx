"use client";
import feedbackStyles from "@/components/ui/feedback.module.css";
import detailStyles from "./task-detail.module.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Feather, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTaskContext } from "../hooks/tasks-provider";
import { TaskForm } from "./task-form";
import { SubtaskSection } from "./subtask-section";
import { TaskErrorBanner } from "./task-error-banner";
export function TaskDetail({ taskId }: { taskId: string }) {
  const { tasks, loading, busy, error, update } = useTaskContext();
  const router = useRouter();
  const task = tasks.find((item) => item.id === taskId && !item.deleted_at);
  if (loading)
    return (
      <div
        className={[
          feedbackStyles["empty-state"],
          feedbackStyles["task-route-state"],
        ].join(" ")}
      >
        <LoaderCircle className={feedbackStyles["spin"]} size={25} />
        <h2>Opening task details…</h2>
      </div>
    );
  if (!task)
    return (
      <div
        className={[
          feedbackStyles["empty-state"],
          feedbackStyles["task-route-state"],
        ].join(" ")}
      >
        {error ? (
          <>
            <h2>Your task could not be loaded.</h2>
            <TaskErrorBanner />
          </>
        ) : (
          <>
            <span className={feedbackStyles["empty-icon"]}>
              <Feather size={30} strokeWidth={1.3} />
            </span>
            <h2>This task could not be found.</h2>
            <p>It may have been deleted or moved from this notebook.</p>
          </>
        )}
        <Button variant="secondary" size="sm" asChild>
          <Link href="/">
            <ArrowRight size={14} /> Back to all tasks
          </Link>
        </Button>
      </div>
    );
  const parent = tasks.find(
    (item) => item.id === task.parent_id && !item.deleted_at,
  );
  return (
    <div className={detailStyles["task-detail"]}>
      <TaskErrorBanner />
      <header className={detailStyles["task-detail-header"]}>
        <div
          className={detailStyles["task-breadcrumbs"]}
          aria-label="Task breadcrumb"
        >
          <Link href="/">
            <ArrowLeft size={14} /> All tasks
          </Link>
          {parent && (
            <>
              <span>/</span>
              <Link href={`/tasks/${parent.id}`}>{parent.title}</Link>
            </>
          )}
        </div>
        <p className={detailStyles["eyebrow"]}>A little more detail</p>
        <h2 className={detailStyles["task-detail-title"]}>{task.title}</h2>
        <p className={detailStyles["task-detail-description"]}>
          Shape the task, then move each smaller step at its own pace.
        </p>
      </header>
      <div className={detailStyles["task-detail-content"]}>
        <TaskForm
          key={`form-${task.id}`}
          task={task}
          busy={busy}
          onSave={(patch) => update(task.id, patch)}
        />
        <SubtaskSection
          key={`subtasks-${task.id}`}
          taskId={task.id}
          onOpenTask={(id) => router.push(`/tasks/${id}`)}
        />
      </div>
    </div>
  );
}
