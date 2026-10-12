"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowRight, Check, CheckCheck, Cloud, Feather, HardDrive, LoaderCircle, Plus, Search, Sun, X } from "lucide-react";
import { ThemeMenu } from "@/components/theme-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { localDate, sortTasks, STATUSES, STATUS_LABELS, type TaskStatus } from "../domain/task";
import type { StorageMode } from "../client/task-gateway";
import { useTasks } from "../hooks/use-tasks";
import { TaskEditor } from "./task-editor";
import { TaskRow } from "./task-row";

const TAB_NOTES: Record<TaskStatus, string> = { todo: "A little space for what’s next.", in_progress: "One step at a time. You’re making progress.", done: "Small wins, well earned." };

export function TaskWorkspace({ mode }: { mode: StorageMode }) {
  const { tasks, loading, busy, error, reload, create, update, undoAction, undo, dismissUndo } = useTasks(mode);
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [focusToday, setFocusToday] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const addInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const editTask = tasks.find((task) => task.id === editId);

  useEffect(() => {
    const timer = setTimeout(() => setToday(new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date())), 0);
    const shortcut = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.closest("input, textarea, select, [contenteditable=true], [role=dialog]"))) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "/") { event.preventDefault(); searchInput.current?.focus(); }
      if (event.key.toLowerCase() === "n") { event.preventDefault(); addInput.current?.focus(); }
    };
    window.addEventListener("keydown", shortcut);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", shortcut); };
  }, []);

  const visible = sortTasks(tasks.filter((task) => task.status === status && (!focusToday || task.focus_today) && `${task.title} ${task.notes}`.toLowerCase().includes(query.trim().toLowerCase())), status);
  const completedToday = tasks.filter((task) => task.completed_at && localDate(new Date(task.completed_at)) === localDate()).length;

  function exportTasks() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, exported_at: new Date().toISOString(), tasks }, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `little-list-${localDate()}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="app-shell">
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Little list home"><span className="brand-mark"><Feather size={20} /></span>little list<span className="brand-dot">.</span></Link>
      <div className="header-actions"><span className="header-caption">Less noise. More doing.</span><ThemeMenu /></div>
    </header>

    <main className="workspace">
      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow"><span className="small-line" /> YOUR EVERYDAY COMPANION</p>
        <div className="intro-heading"><div><h1 id="page-title">A little list.<br /><span>A clearer mind.</span></h1><p className="intro-copy">Get it out of your head. Take it one task at a time.</p></div>
          <div className="date-note"><Sun size={24} strokeWidth={1.2} /><span>{today || "Make a little room for today."}</span><span className="date-note-small">A good day to begin.</span></div>
        </div>
      </section>

      <section className="notebook" aria-label="Your tasks">
        <form className="quick-add" onSubmit={async (event) => {
          event.preventDefault();
          if (await create(draft)) { setDraft(""); setStatus("todo"); setQuery(""); setFocusToday(false); addInput.current?.focus(); }
        }}>
          <Plus size={21} strokeWidth={1.5} className="add-icon" />
          <input ref={addInput} aria-label="New task title" placeholder="What’s on your mind?" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={200} required disabled={loading || busy || (!!error && !tasks.length)} />
          <kbd className="enter-hint">↵</kbd><Button type="submit" disabled={!draft.trim() || loading || busy}>Add task <Plus size={16} /></Button>
        </form>
        <div className="list-controls">
          <div className="status-tabs" role="tablist" aria-label="Task status">
            {STATUSES.map((tab, index) => <button key={tab} id={`tab-${tab}`} role="tab" aria-controls="task-panel" aria-selected={status === tab} tabIndex={status === tab ? 0 : -1} className={cn("status-tab", status === tab && "active")} onClick={() => setStatus(tab)} onKeyDown={(event) => {
              const nextIndex = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : null;
              if (nextIndex !== null) { event.preventDefault(); setStatus(STATUSES[nextIndex]); document.getElementById(`tab-${STATUSES[nextIndex]}`)?.focus(); }
            }}>{STATUS_LABELS[tab]}<span className="tab-count">{tasks.filter((task) => task.status === tab).length}</span></button>)}
          </div>
          <Button variant="ghost" size="sm" className={cn("focus-filter", focusToday && "selected")} aria-pressed={focusToday} onClick={() => setFocusToday(!focusToday)}><Sun size={15} />Focus today</Button>
        </div>
        <div className="list-subheader"><p>{TAB_NOTES[status]}</p><div className="search-box"><Search size={15} /><input ref={searchInput} aria-label="Search tasks" placeholder="Find a task…" value={query} onChange={(e) => setQuery(e.target.value)} />{query ? <button onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button> : <kbd>/</kbd>}</div></div>

        {error && <div className="error-banner" role="alert"><span>{error}</span><Button variant="secondary" size="sm" disabled={busy} onClick={() => void reload()}>Retry</Button></div>}
        <div role="tabpanel" id="task-panel" aria-labelledby={`tab-${status}`} className="task-panel" tabIndex={0}>
          {loading ? <div className="empty-state"><LoaderCircle className="spin" size={25} /><h2>Opening your notebook…</h2></div> : visible.length ? <ul className="task-list">{visible.map((task) => <TaskRow key={task.id} task={task} busy={busy} onEdit={() => setEditId(task.id)} onUpdate={(patch, label) => void update(task.id, patch, label)} />)}</ul> : <div className="empty-state">
            <span className="empty-icon">{status === "done" ? <CheckCheck size={30} strokeWidth={1.3} /> : focusToday ? <Sun size={30} strokeWidth={1.3} /> : <Feather size={30} strokeWidth={1.3} />}</span>
            <h2>{error ? "Your list is waiting." : query ? "Nothing by that name." : focusToday ? "Choose a little focus." : status === "todo" ? "Good things start with a little list." : status === "in_progress" ? "Ready when you are." : "Your wins will live here."}</h2>
            <p>{error ? "Retry to load your saved tasks." : query ? "Try another search or check the other tabs." : focusToday ? "Open a task’s menu to add it to today’s focus." : status === "todo" ? "Add your first task above. Big plans or small errands—all welcome." : status === "in_progress" ? "Hit Start on a task in Todo to give it your attention." : "Complete a task and take a moment to enjoy the progress."}</p>
            {!query && !focusToday && status !== "todo" && <Button variant="secondary" size="sm" onClick={() => setStatus("todo")}>Back to Todo <ArrowRight size={14} /></Button>}
          </div>}
        </div>
        <div className="notebook-footer"><span className="save-status" role="status">{busy ? <><LoaderCircle size={13} className="spin" />Saving…</> : error ? "Changes need attention" : loading ? "Loading…" : <><Check size={14} />{mode === "local" ? "Saved on this browser" : "Saved to your notebook"}</>}</span><span>{completedToday ? `${completedToday} ${completedToday === 1 ? "task" : "tasks"} finished today` : "Every small step counts."}</span></div>
      </section>

      <footer className="workspace-footer"><span className="storage-note">{mode === "cloud" ? <Cloud size={14} /> : <HardDrive size={14} />}{mode === "cloud" ? "Shared notebook · Cloud storage" : "Local notebook · This browser only"}</span><Button variant="ghost" size="sm" onClick={exportTasks} disabled={loading || busy || !!error}><ArrowDownToLine size={14} />Export list</Button></footer>
      {mode === "local" && <p className="local-note">Connect Supabase to keep the same list on your phone and laptop.</p>}
      <p className="keyboard-note"><kbd>N</kbd> new task <span>·</span> <kbd>/</kbd> search <span>·</span> Make space for what matters.</p>
    </main>


    {editTask && <TaskEditor key={editTask.id} task={editTask} busy={busy} onClose={() => setEditId(null)} onSave={(patch) => update(editTask.id, patch)} />}
    {undoAction && <div className="undo-toast" role="status"><Check size={16} /><span>{undoAction.label}</span><button disabled={busy} onClick={() => void undo()}>Undo</button><button aria-label="Dismiss notification" onClick={dismissUndo}><X size={15} /></button></div>}
  </div>;
}
