import { describe, expect, it } from "vitest";
import {
  checkMutationOrigin,
  readJson,
} from "../src/features/tasks/server/http";

describe("request boundary", () => {
  it("blocks another browser site's writes", () => {
    const request = new Request("https://list.example/api/tasks", {
      headers: {
        host: "list.example",
        origin: "https://other.example",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(checkMutationOrigin(request)?.status).toBe(403);
  });
  it("allows same-origin writes", () => {
    const request = new Request("https://list.example/api/tasks", {
      headers: { host: "list.example", origin: "https://list.example" },
    });
    expect(checkMutationOrigin(request)).toBeNull();
  });
  it("rejects malformed or oversized JSON", async () => {
    const request = (body: string) =>
      new Request("https://list.example/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
    await expect(readJson(request("{"))).rejects.toThrow("Invalid JSON");
    await expect(readJson(request("a".repeat(20_001)))).rejects.toThrow(
      "too large",
    );
  });
});
