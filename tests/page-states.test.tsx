// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ErrorPage from "../src/app/error";
import NotFound from "../src/app/not-found";

afterEach(cleanup);

it("offers route recovery through Next's retry function and an independent notebook link", () => {
  const retry = vi.fn();
  render(<ErrorPage retry={retry} />);
  expect(
    screen.getByRole("heading", { name: "Something went wrong." }),
  ).toBeTruthy();
  expect(screen.getByText("An unexpected error")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledOnce();
  expect(
    screen.getByRole("link", { name: "Back to notebook" }).getAttribute("href"),
  ).toBe("/");
});

it("provides a distinct missing-page state without a misleading retry action", () => {
  render(<NotFound />);
  expect(screen.getByText("404")).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "A page out of place." }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Back to notebook" }).getAttribute("href"),
  ).toBe("/");
});
