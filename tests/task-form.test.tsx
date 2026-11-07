// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { TaskForm } from "../src/features/tasks/components/task-form";
import {
  createTaskSchema,
  localDate,
  makeTask,
} from "../src/features/tasks/domain/task";

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
    expect(
      (
        screen.getByRole("button", {
          name: "Save changes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
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
  fireEvent.click(screen.getByRole("button", { name: "Due date" }));
  expect(
    screen.getByRole("dialog", { name: "Choose due date" }).parentElement,
  ).toBe(document.body);
  fireEvent.click(screen.getByRole("button", { name: "Clear date" }));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ due_date: null }));
});

it("selects a calendar date and saves it in the task date format", async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  render(<TaskForm task={task} busy={false} onSave={onSave} />);
  fireEvent.click(screen.getByRole("button", { name: "Due date" }));
  fireEvent.click(screen.getByRole("button", { name: "Today" }));
  expect(
    screen.getByRole("button", { name: "Due date" }).textContent,
  ).toContain(
    new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date()),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith({ due_date: localDate() }),
  );
});

it("keeps the calendar within its compressed details panel", () => {
  const { container } = render(
    <div data-overlay-boundary>
      <TaskForm task={task} busy={false} onSave={vi.fn()} />
    </div>,
  );
  const trigger = screen.getByRole("button", { name: "Due date" });
  const panel = container.querySelector<HTMLElement>("[data-overlay-boundary]");
  expect(panel).not.toBeNull();

  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
    left: 100,
    right: 500,
    top: 400,
    bottom: 444,
    width: 400,
    height: 44,
    x: 100,
    y: 400,
    toJSON: () => ({}),
  } as DOMRect);
  vi.spyOn(panel!, "getBoundingClientRect").mockReturnValue({
    left: 80,
    right: 360,
    top: 100,
    bottom: 700,
    width: 280,
    height: 600,
    x: 80,
    y: 100,
    toJSON: () => ({}),
  } as DOMRect);

  fireEvent.click(trigger);
  const calendar = screen.getByRole("dialog", { name: "Choose due date" });
  expect(calendar.parentElement).toBe(document.body);
  expect((calendar as HTMLDivElement).style.left).toBe("100px");
  expect((calendar as HTMLDivElement).style.width).toBe("248px");
});

it("keeps task options in one responsive group and shows move-to-main-list only when available", () => {
  const onSave = vi.fn();
  const onMoveToMainList = vi.fn().mockResolvedValue(true);
  const view = render(<TaskForm task={task} busy={false} onSave={onSave} />);
  const options = screen.getByRole("group", { name: "Task options" });
  expect(within(options).getByRole("button", { name: "Pin" })).toBeTruthy();
  expect(
    within(options).getByRole("button", { name: "Focus today" }),
  ).toBeTruthy();
  expect(within(options).queryByRole("checkbox")).toBeNull();
  expect(
    within(options).queryByRole("button", { name: "Move to main list" }),
  ).toBeNull();

  view.rerender(
    <TaskForm
      task={task}
      busy={false}
      onSave={onSave}
      onMoveToMainList={onMoveToMainList}
    />,
  );
  const moveButton = within(options).getByRole("button", {
    name: "Move to main list",
  });
  fireEvent.click(moveButton);
  expect(onMoveToMainList).toHaveBeenCalledOnce();
});

it("toggles pin and focus as draft buttons and saves both values", async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  render(<TaskForm task={task} busy={false} onSave={onSave} />);
  fireEvent.click(screen.getByRole("button", { name: "Pin" }));
  fireEvent.click(screen.getByRole("button", { name: "Focus today" }));

  expect(
    screen.getByRole("button", { name: "Unpin" }).getAttribute("aria-pressed"),
  ).toBe("true");
  expect(
    screen
      .getByRole("button", { name: "Remove focus" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith({ pinned: true, focus_today: true }),
  );
});

it("offers unpin and remove-focus actions when both options are active", async () => {
  const onSave = vi.fn().mockResolvedValue(true);
  render(
    <TaskForm
      task={{ ...task, pinned: true, focus_today: true }}
      busy={false}
      onSave={onSave}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Unpin" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove focus" }));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith({ pinned: false, focus_today: false }),
  );
});

describe("saved task links", () => {
  const link = "https://www.instagram.com/reel/example/";
  it("saves a link with context and exposes the saved URL in a new tab", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const view = render(<TaskForm task={task} busy={false} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/Link/), {
      target: { value: link },
    });
    fireEvent.change(screen.getByLabelText(/Notes/), {
      target: { value: "Try this exercise later" },
    });
    expect(screen.queryByRole("link", { name: /Open saved link/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        link_url: link,
        notes: "Try this exercise later",
      }),
    );
    view.rerender(
      <TaskForm
        task={{ ...task, link_url: link, notes: "Try this exercise later" }}
        busy={false}
        onSave={onSave}
      />,
    );
    const anchor = screen.getByRole("link", { name: /Open saved link/ });
    expect(anchor.getAttribute("href")).toBe(link);
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.getAttribute("rel")).toBe("noopener noreferrer");
  });
  it("removes links explicitly and follows the saved value after undo", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const linked = { ...task, link_url: link };
    const view = render(
      <TaskForm task={linked} busy={false} onSave={onSave} />,
    );
    fireEvent.change(screen.getByLabelText(/Link/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ link_url: null }),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Save changes",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    view.rerender(<TaskForm task={task} busy={false} onSave={onSave} />);
    expect(screen.queryByRole("link", { name: /Open saved link/ })).toBeNull();
    view.rerender(<TaskForm task={linked} busy={false} onSave={onSave} />);
    expect((screen.getByLabelText(/Link/) as HTMLInputElement).value).toBe(
      link,
    );
  });
  it("preserves an invalid draft for correction without saving it", async () => {
    const onSave = vi.fn();
    render(<TaskForm task={task} busy={false} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(/Link/), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Save changes" }).closest("form")!,
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "http:// or https://",
    );
    expect(onSave).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/Link/) as HTMLInputElement).value).toBe(
      "javascript:alert(1)",
    );
  });
});
