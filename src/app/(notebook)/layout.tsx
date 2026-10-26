import type { ReactNode } from "react";
import { TasksProvider } from "@/features/tasks/hooks/tasks-provider";
import { TaskWorkspace } from "@/features/tasks/components/task-workspace";
import {
  listTasks,
  storageMode,
  TaskRepositoryError,
} from "@/features/tasks/server/repository";
import type { InitialTaskState } from "@/features/tasks/hooks/use-tasks";
import { redirect } from "next/navigation";
import { currentSession } from "@/features/auth/server/session";
import { AccountMenu } from "@/features/auth/components/account-menu";

export const dynamic = "force-dynamic";

export default async function NotebookLayout({
  children,
}: {
  children: ReactNode;
}) {
  const mode = storageMode();
  const session = mode === "cloud" ? await currentSession() : null;
  if (mode === "cloud" && !session) redirect("/login");
  let initialState: InitialTaskState | undefined;
  if (session) {
    try {
      initialState = { tasks: (await listTasks(session)).tasks };
    } catch (error) {
      if (!(error instanceof TaskRepositoryError)) throw error;
      initialState = { error: `${error.message} Please try again.` };
    }
  }
  return (
    <TasksProvider
      key={session?.user.id ?? "local"}
      mode={mode}
      userId={session?.user.id}
      initialState={initialState}
    >
      <TaskWorkspace
        account={session ? <AccountMenu email={session.user.email} /> : null}
      >
        {children}
      </TaskWorkspace>
    </TasksProvider>
  );
}
