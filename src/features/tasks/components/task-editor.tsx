"use client";

import { useState } from "react";
import { CalendarDays, Star, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { STATUS_LABELS, STATUSES, taskFieldsSchema, type Task, type TaskPatch } from "../domain/task";

export function TaskEditor({ task, busy, onClose, onSave }: {
  task: Task; busy: boolean; onClose(): void; onSave(patch: TaskPatch): Promise<boolean>;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [status, setStatus] = useState(task.status);
  const [starred, setStarred] = useState(task.starred);
  const [focus, setFocus] = useState(task.focus_today);
  const [error, setError] = useState<string | null>(null);

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent>
      <p className="eyebrow">A little more detail</p>
      <DialogTitle className="dialog-title">Make room for the plan.</DialogTitle>
      <DialogDescription className="dialog-description">A clear next step goes a long way.</DialogDescription>
      <form onSubmit={async (event) => {
        event.preventDefault();
        const dueDate = new FormData(event.currentTarget).get("due_date");
        const result = taskFieldsSchema.safeParse({ title, notes, due_date: dueDate || null, status, starred, focus_today: focus });
        if (!result.success) { setError(result.error.issues[0].message); return; }
        setError(null);
        if (await onSave(result.data)) onClose();
        else setError("Your changes weren't saved. Please try again.");
      }} className="editor-form">
        <label className="field-label" htmlFor="task-title">Task</label>
        <input className="field" id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required autoFocus disabled={busy} />
        <label className="field-label" htmlFor="task-notes">Notes <span className="optional">optional</span></label>
        <textarea className="field notes-field" id="task-notes" placeholder="A few thoughts, a link, or where to start…" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} disabled={busy} />
        <div className="editor-grid">
          <div><label className="field-label" htmlFor="task-status">Status</label><select className="field" id="task-status" value={status} onChange={(e) => setStatus(e.target.value as Task["status"])} disabled={busy}>{STATUSES.map((item) => <option key={item} value={item}>{STATUS_LABELS[item]}</option>)}</select></div>
          <div><label className="field-label" htmlFor="task-due"><CalendarDays size={14} /> Due date</label><input className="field" id="task-due" name="due_date" type="date" defaultValue={task.due_date ?? ""} disabled={busy} /></div>
        </div>
        <div className="editor-toggles">
          <label><input type="checkbox" checked={starred} onChange={(e) => setStarred(e.target.checked)} disabled={busy} /><Star size={15} /> Important</label>
          <label><input type="checkbox" checked={focus} onChange={(e) => setFocus(e.target.checked)} disabled={busy} /><Sun size={15} /> Focus today</label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="editor-footer"><Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
