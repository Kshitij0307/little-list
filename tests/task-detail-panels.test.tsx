// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { TaskDetailPanels } from "../src/features/tasks/components/task-detail-panels";

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("resizes both panels with pointer and keyboard while preserving editor input", async () => {
  render(
    <TaskDetailPanels
      details={<input aria-label="Task draft" defaultValue="Original" />}
      subtasks={<p>Subtasks stay mounted</p>}
    />,
  );
  const separator = screen.getByRole("separator", {
    name: "Resize task details and subtasks",
  });
  const container = separator.parentElement!;
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
    left: 100,
    width: 1000,
  } as DOMRect);
  const draft = screen.getByRole("textbox", { name: "Task draft" });
  fireEvent.change(draft, { target: { value: "Unsaved draft" } });

  for (const [type, clientX] of [
    ["pointerdown", 520],
    ["pointermove", 800],
    ["pointerup", 800],
  ] as const) {
    fireEvent(
      separator,
      Object.assign(new Event(type, { bubbles: true }), {
        pointerId: 1,
        button: 0,
        clientX,
      }),
    );
  }
  expect(container.style.getPropertyValue("--details-width")).toBe("66.8%");
  expect(separator.getAttribute("aria-valuenow")).toBe("67");
  await waitFor(() =>
    expect(
      window.localStorage.getItem("little-list.task-detail-width.v1"),
    ).toBe("66.8"),
  );
  expect((draft as HTMLInputElement).value).toBe("Unsaved draft");

  fireEvent.keyDown(separator, { key: "ArrowLeft" });
  expect(container.style.getPropertyValue("--details-width")).toBe("61.8%");
  fireEvent.keyDown(separator, { key: "Home" });
  expect(container.style.getPropertyValue("--details-width")).toBe("32%");
  fireEvent.keyDown(separator, { key: "End" });
  expect(container.style.getPropertyValue("--details-width")).toBe("66.8%");
  fireEvent.doubleClick(separator);
  expect(container.style.getPropertyValue("--details-width")).toBe("42%");
});

it("restores a previously chosen panel width", async () => {
  window.localStorage.setItem("little-list.task-detail-width.v1", "55");
  render(
    <TaskDetailPanels
      details={<p>Task details</p>}
      subtasks={<p>Subtasks</p>}
    />,
  );
  const separator = screen.getByRole("separator");
  await waitFor(() =>
    expect(
      separator.parentElement?.style.getPropertyValue("--details-width"),
    ).toBe("55%"),
  );
});
