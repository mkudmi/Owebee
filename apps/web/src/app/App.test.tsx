import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  App,
  createClientMutationId,
  createInitialWorkspaceState,
  loadLocalWorkspace
} from "./App.js";
import type { Outbox } from "../offline/outbox.js";
import type { WorkspaceReferenceCache } from "../offline/workspace-reference-cache.js";

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

  it("restores pending expenses and cached references before the network", async () => {
    const pending = {
      clientMutationId: "mutation-1",
      tripId: "trip-1",
      type: "expense.create" as const,
      createdAt: "2026-07-01T12:00:00.000Z",
      status: "pending" as const,
      payload: {
        payerMemberId: "member-1",
        amount: "12.50",
        currencyCode: "RUB",
        expenseDate: "2026-07-01",
        description: "Кофе",
        splitTargets: [{ type: "member" as const, id: "member-1" }]
      }
    };
    const references = {
      tripId: "trip-1",
      members: [
        {
          id: "member-1",
          displayName: "Елена",
          role: "owner" as const
        }
      ],
      families: [],
      currencies: [
        {
          code: "RUB",
          displayName: "Российский рубль",
          symbol: "₽",
          minorUnits: 2
        }
      ],
      updatedAt: "2026-07-01T12:00:00.000Z"
    };
    const outbox = {
      listPendingExpenses: async () => [pending]
    } as unknown as Outbox;
    const cache = {
      get: async () => references,
      put: async () => undefined
    } as WorkspaceReferenceCache;

    await expect(
      loadLocalWorkspace(outbox, cache, "trip-1")
    ).resolves.toEqual({
      pendingExpenses: [pending],
      pendingLoadFailed: false,
      references
    });
  });

  it("keeps startup usable when local storage reads fail", async () => {
    const outbox = {
      listPendingExpenses: async () => {
        throw new Error("IndexedDB unavailable");
      }
    } as unknown as Outbox;
    const cache = {
      get: async () => {
        throw new Error("IndexedDB unavailable");
      }
    } as unknown as WorkspaceReferenceCache;

    await expect(
      loadLocalWorkspace(outbox, cache, "trip-1")
    ).resolves.toEqual({
      pendingExpenses: [],
      pendingLoadFailed: true,
      references: null
    });
  });

  it("never falls back to an API-incompatible mutation ID", () => {
    expect(
      createClientMutationId(() =>
        "00000000-0000-0000-0000-000000000001"
      )
    ).toBe("00000000-0000-0000-0000-000000000001");
    expect(() => createClientMutationId(null)).toThrow(
      "Secure UUID generation is unavailable"
    );
  });
});
