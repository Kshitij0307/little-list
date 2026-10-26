import { expect, it } from "vitest";
import config from "../next.config";

it("keeps native Server Action forms compatible with origin checks without sending cross-site referrers", async () => {
  const rules = await config.headers!();
  const appHeaders = rules.find((rule) => rule.source === "/:path*");

  // no-referrer produces Origin: null on native form POSTs, so login and
  // sign-out fail when submitted before hydration (or without JavaScript).
  expect(appHeaders?.headers).toContainEqual({
    key: "Referrer-Policy",
    value: "same-origin",
  });
});
