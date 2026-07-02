import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { createOutbox } from "./outbox.js";
import {
  createDefaultExpenseDraft,
  createOfflineExpenseSaver,
  validateExpenseDraft
} from "./expense-draft.js";
import type { WorkspaceReferenceSnapshot } from "./workspace-reference-cache.js";

const MEMBER_1 = "00000000-0000-0000-0000-000000000010";
const MEMBER_2 = "00000000-0000-0000-0000-000000000011";
const FAMILY_1 = "00000000-0000-0000-0000-000000000020";
const TRIP_1 = "00000000-0000-0000-0000-000000000100";
const MUTATION_1 = "00000000-0000-0000-0000-000000000001";

const references: WorkspaceReferenceSnapshot = {
  tripId: TRIP_1,
  members: [
    { id: MEMBER_1, displayName: "Елена", role: "participant" },
    { id: MEMBER_2, displayName: "Иван", role: "participant" }
  ],
  families: [
    { id: FAMILY_1, displayName: "Семья Ивановых", shareCount: "2" }
  ],
  currencies: [
    {
      code: "EUR",
      displayName: "Евро",
      symbol: "€",
      minorUnits: 2
    },
    {
      code: "RUB",
      displayName: "Российский рубль",
      symbol: "₽",
      minorUnits: 2
    }
  ],
  updatedAt: "2026-07-01T10:00:00.000Z"
};

describe("offline expense draft", () => {
  it("creates safe payer, currency, date and all-target defaults", () => {
    expect(createDefaultExpenseDraft(references, "2026-07-02")).toEqual({
      amount: "",
      currencyCode: "RUB",
      expenseDate: "2026-07-02",
      description: "",
      payerMemberId: MEMBER_1,
      selectedTargetKeys: [
        `member:${MEMBER_1}`,
        `member:${MEMBER_2}`,
        `family:${FAMILY_1}`
      ]
    });
  });

  it("normalizes a locale comma without converting exact decimals to Number", () => {
    const result = validateExpenseDraft(
      {
        ...createDefaultExpenseDraft(references, "2026-07-02"),
        amount: " 48,20 ",
        description: " Ужин "
      },
      references
    );

    expect(result).toEqual({
      ok: true,
      payload: {
        payerMemberId: MEMBER_1,
        amount: "48.20",
        currencyCode: "RUB",
        expenseDate: "2026-07-02",
        description: "Ужин",
        splitTargets: [
          { type: "member", id: MEMBER_1 },
          { type: "member", id: MEMBER_2 },
          { type: "family", id: FAMILY_1 }
        ]
      }
    });
  });

  it.each([
    [{ amount: "0" }, "amount"],
    [{ amount: "1.1234567890123" }, "amount"],
    [{ expenseDate: "2026-02-30" }, "expenseDate"],
    [{ description: " " }, "description"],
    [{ description: "x".repeat(501) }, "description"],
    [{ payerMemberId: "archived-member" }, "payerMemberId"],
    [{ currencyCode: "USD" }, "currencyCode"],
    [{ selectedTargetKeys: [] }, "splitTargets"],
    [
      {
        selectedTargetKeys: [
          `member:${MEMBER_1}`,
          `member:${MEMBER_1}`
        ]
      },
      "splitTargets"
    ],
    [{ selectedTargetKeys: ["family:missing"] }, "splitTargets"]
  ])("rejects invalid draft field %s", (override, expectedField) => {
    const result = validateExpenseDraft(
      {
        ...createDefaultExpenseDraft(references, "2026-07-02"),
        amount: "10",
        description: "Такси",
        ...override
      },
      references
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveProperty(expectedField);
    }
  });

  it("uses one mutation ID for concurrent duplicate saves", async () => {
    const outbox = createOutbox(`expense-save-${crypto.randomUUID()}`);
    const persistStorage = vi.fn(async () => true);
    const save = createOfflineExpenseSaver({
      outbox,
      createId: () => MUTATION_1,
      now: () => "2026-07-01T10:00:00.000Z",
      persistStorage
    });
    const payload = expectValidPayload();

    const [first, second] = await Promise.all([
      save({ tripId: TRIP_1, payload }),
      save({ tripId: TRIP_1, payload })
    ]);

    expect(first.clientMutationId).toBe(MUTATION_1);
    expect(second.clientMutationId).toBe(MUTATION_1);
    await expect(outbox.listPendingExpenses(TRIP_1)).resolves.toHaveLength(1);
    expect(persistStorage).toHaveBeenCalledTimes(1);
  });

  it("keeps a confirmed save successful when persistent storage is denied", async () => {
    const outbox = createOutbox(`expense-save-${crypto.randomUUID()}`);
    const save = createOfflineExpenseSaver({
      outbox,
      createId: () => MUTATION_1,
      now: () => "2026-07-01T10:00:00.000Z",
      persistStorage: vi.fn(async () => {
        throw new Error("not allowed");
      })
    });

    await expect(
      save({ tripId: TRIP_1, payload: expectValidPayload() })
    ).resolves.toMatchObject({
      clientMutationId: MUTATION_1,
      status: "pending"
    });
  });

  it("does not wait for a hanging persistent-storage request", async () => {
    const outbox = createOutbox(`expense-save-${crypto.randomUUID()}`);
    const save = createOfflineExpenseSaver({
      outbox,
      createId: () => MUTATION_1,
      now: () => "2026-07-01T10:00:00.000Z",
      persistStorage: () => new Promise<boolean>(() => undefined)
    });

    await expect(
      save({ tripId: TRIP_1, payload: expectValidPayload() })
    ).resolves.toMatchObject({
      clientMutationId: MUTATION_1,
      status: "pending"
    });
  });
});

function expectValidPayload() {
  const result = validateExpenseDraft(
    {
      ...createDefaultExpenseDraft(references, "2026-07-02"),
      amount: "10",
      description: "Такси"
    },
    references
  );
  if (!result.ok) {
    throw new Error("Expected test draft to be valid");
  }
  return result.payload;
}
