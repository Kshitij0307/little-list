import type { ReactNode } from "react";
import { TasksProvider } from "@/features/tasks/hooks/tasks-provider";
import { TaskWorkspace } from "@/features/tasks/components/task-workspace";
import { storageMode } from "@/features/tasks/server/repository";

export const dynamic = "force-dynamic";

export default function NotebookLayout({ children }: { children: ReactNode }) {
  return (
    <TasksProvider mode={storageMode()}>
      <TaskWorkspace>{children}</TaskWorkspace>
    </TasksProvider>
  );
}
