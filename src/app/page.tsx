import { TaskWorkspace } from "@/features/tasks/components/task-workspace";
import { storageMode } from "@/features/tasks/server/repository";

export const dynamic = "force-dynamic";

export default function Home() {
  return <TaskWorkspace mode={storageMode()} />;
}
