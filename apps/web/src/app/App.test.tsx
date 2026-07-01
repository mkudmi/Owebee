import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App, createInitialWorkspaceState } from "./App.js";

describe("App integration", () => {
  it("starts without a session when rendered outside a browser", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Откройте свою поездку");
  });

  it("starts loading when a workspace session exists", () => {
    expect(
      createInitialWorkspaceState({
        version: 1,
        tripId: "trip-1",
        token: "secret",
        tripName: "Georgia 2026"
      })
    ).toMatchObject({
      kind: "loading",
      session: { tripName: "Georgia 2026" }
    });
  });
});
