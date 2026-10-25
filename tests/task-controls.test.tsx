// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TaskStatusTabs } from "../src/features/tasks/components/task-status-tabs";
import { TaskPicker } from "../src/features/tasks/components/task-picker";
import {
  createTaskSchema,
  makeTask,
  type TaskStatus,
} from "../src/features/tasks/domain/task";

afterEach(cleanup);
const task = makeTask(
  createTaskSchema.parse({
    id: "be7f3440-3868-4e48-90fb-f2e8dbce5b26",
    title: "Read a chapter",
  }),
);
function Tabs() {
  const [status, setStatus] = useState<TaskStatus>("todo");
  return (
    <>
      <TaskStatusTabs
        value={status}
        onChange={setStatus}
        tasks={[task]}
        idPrefix="test"
        label="Task status"
      />
      <div
        id="test-panel"
        role="tabpanel"
        aria-labelledby={`test-tab-${status}`}
      />
    </>
  );
}

describe("shared task controls", () => {
  it("moves focus and selection together, wraps arrows, and supports Home and End", () => {
    render(<Tabs />);
    const todo = screen.getByRole("tab", { name: "Todo 1" });
    const progress = screen.getByRole("tab", { name: "In progress 0" });
    const done = screen.getByRole("tab", { name: "Done 0" });
    fireEvent.keyDown(todo, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(done);
    expect(done.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(done, { key: "ArrowRight" });
    expect(document.activeElement).toBe(todo);
    fireEvent.keyDown(todo, { key: "ArrowRight" });
    expect(document.activeElement).toBe(progress);
    fireEvent.keyDown(progress, { key: "End" });
    expect(document.activeElement).toBe(done);
    fireEvent.keyDown(done, { key: "Home" });
    expect(document.activeElement).toBe(todo);
    expect(progress.tabIndex).toBe(-1);
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(
      todo.id,
    );
  });

  it("selects an existing task through the keyboard and reports its selected state", async () => {
    function Picker() {
      const [value, setValue] = useState("");
      return (
        <>
          <label htmlFor="test-picker">Choose an existing task</label>
          <TaskPicker
            id="test-picker"
            candidates={[task]}
            value={value}
            onChange={setValue}
            disabled={false}
          />
        </>
      );
    }
    render(<Picker />);
    const trigger = screen.getByLabelText("Choose an existing task");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const option = await screen.findByRole("menuitemradio", {
      name: "Read a chapter Todo",
    });
    fireEvent.keyDown(option, { key: "Enter" });
    expect(trigger.textContent).toContain(task.title);
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(
      (
        await screen.findByRole("menuitemradio", {
          name: "Read a chapter Todo",
        })
      ).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("disables an empty picker", () => {
    render(
      <TaskPicker
        id="empty"
        candidates={[]}
        value=""
        onChange={vi.fn()}
        disabled={false}
      />,
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText("No other tasks available")).toBeTruthy();
  });
});
