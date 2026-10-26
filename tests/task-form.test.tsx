// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { TaskForm } from "../src/features/tasks/components/task-form";
import { createTaskSchema, makeTask } from "../src/features/tasks/domain/task";

const task = makeTask(
  createTaskSchema.parse({
    id: "be7f3440-3868-4e48-90fb-f2e8dbce5b26",
    title: "Read a chapter",
    notes: "Original notes",
  }),
);
afterEach(cleanup);

describe("task draft ownership", () => {
  it("preserves unsaved edits, refreshes untouched fields, and saves only changed fields", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const view = render(<TaskForm task={task} busy={false} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "My unsaved title" },
    });
    const refreshed = {
      ...task,
      notes: "Updated on another device",
      status: "in_progress" as const,
    };
    view.rerender(<TaskForm task={refreshed} busy={false} onSave={onSave} />);
    expect((screen.getByLabelText("Task") as HTMLInputElement).value).toBe(
      "My unsaved title",
    );
    expect((screen.getByLabelText(/Notes/) as HTMLTextAreaElement).value).toBe(
      refreshed.notes,
    );
    expect(screen.getByLabelText("Status").textContent).toContain(
      "In progress",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ title: "My unsaved title" }),
    );
    view.rerender(
      <TaskForm
        task={{ ...refreshed, title: "My unsaved title" }}
        busy={false}
        onSave={onSave}
      />,
    );
    await screen.findByText("Changes saved");
    // Undo updates the saved record; the clean draft must follow it.
    view.rerender(<TaskForm task={task} busy={false} onSave={onSave} />);
    expect((screen.getByLabelText("Task") as HTMLInputElement).value).toBe(
      task.title,
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Save changes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("keeps a failed save's draft available for retry without false success", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(<TaskForm task={task} busy={false} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "Keep this edit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect((screen.getByLabelText("Task") as HTMLInputElement).value).toBe(
      "Keep this edit",
    );
    expect(screen.queryByText("Changes saved")).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Save changes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("validates locally and clears old validation feedback when editing", async () => {
    const onSave = vi.fn();
    render(<TaskForm task={task} busy={false} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "   " },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Save changes" }).closest("form")!,
    );
    await screen.findByRole("alert");
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "Valid title" },
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("treats an edit reverted to its current value as clean and follows later refreshes", () => {
    const onSave = vi.fn();
    const view = render(<TaskForm task={task} busy={false} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "Temporary" },
    });
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: task.title },
    });
    view.rerender(
      <TaskForm
        task={{ ...task, title: "Latest saved title" }}
        busy={false}
        onSave={onSave}
      />,
    );
    expect((screen.getByLabelText("Task") as HTMLInputElement).value).toBe(
      "Latest saved title",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Save changes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

it("changes status through the themed menu using the keyboard and saves the selected value", async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  render(<TaskForm task={task} busy={false} onSave={onSave} />);
  const trigger = screen.getByLabelText("Status");
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const done = await screen.findByRole("menuitemradio", { name: "Done" });
  fireEvent.keyDown(done, { key: "Enter" });
  expect(trigger.textContent).toContain("Done");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ status: "done" }));
});

it("sends an explicit null when clearing an existing due date", async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  render(
    <TaskForm
      task={{ ...task, due_date: "2026-10-25" }}
      busy={false}
      onSave={onSave}
    />,
  );
  fireEvent.change(screen.getByLabelText("Due date"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ due_date: null }));
});
