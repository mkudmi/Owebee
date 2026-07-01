import { describe, expect, it, vi } from "vitest";
import {
  loadWorkspaceSession,
  parseWorkspaceSession,
  type SessionStorage
} from "./session.js";

describe("workspace session", () => {
  it("returns null when no session was stored", () => {
    expect(parseWorkspaceSession(null)).toBeNull();
  });

  it("parses and normalizes a valid versioned session", () => {
    expect(
      parseWorkspaceSession(
        JSON.stringify({
          version: 1,
          tripId: " trip-123 ",
          token: " secret-token ",
          tripName: " Georgia 2026 "
        })
      )
    ).toEqual({
      version: 1,
      tripId: "trip-123",
      token: "secret-token",
      tripName: "Georgia 2026"
    });
  });

  it.each([
    "{broken",
    JSON.stringify({ version: 2, tripId: "trip", token: "token" }),
    JSON.stringify({ version: 1, tripId: "", token: "token" }),
    JSON.stringify({ version: 1, tripId: "trip", token: " " }),
    JSON.stringify(["not", "an", "object"])
  ])("rejects malformed or unsupported session value", (raw) => {
    expect(parseWorkspaceSession(raw)).toBeNull();
  });

  it("removes an invalid stored session", () => {
    const storage: SessionStorage = {
      getItem: vi.fn(() => "{broken"),
      removeItem: vi.fn()
    };

    expect(loadWorkspaceSession(storage)).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith("owebee.session.v1");
  });
});
