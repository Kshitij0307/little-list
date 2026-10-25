import type { ReactNode } from "react";
import { TasksProvider } from "@/features/tasks/hooks/tasks-provider";
import { TaskWorkspace } from "@/features/tasks/components/task-workspace";
import { storageMode } from "@/features/tasks/server/repository";
import { redirect } from "next/navigation";
import { currentSession } from "@/features/auth/server/session";
import { AccountMenu } from "@/features/auth/components/account-menu";
import { SessionBoundary } from "@/features/auth/components/session-boundary";

export const dynamic = "force-dynamic";

export default async function NotebookLayout({
  children,
}: {
  children: ReactNode;
}) {
  const mode = storageMode();
  const session = mode === "cloud" ? await currentSession() : null;
  if (mode === "cloud" && !session) redirect("/login");
  const notebook = (
    <TasksProvider key={session?.user.id ?? "local"} mode={mode}>
      <TaskWorkspace
        account={session ? <AccountMenu email={session.user.email} /> : null}
      >
        {children}
      </TaskWorkspace>
    </TasksProvider>
  );
  return session ? (
    <SessionBoundary key={session.user.id} userId={session.user.id}>
      {notebook}
    </SessionBoundary>
  ) : (
    notebook
  );
}
