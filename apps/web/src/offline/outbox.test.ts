import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createOutbox,
  type ExpenseCreatePayload
} from "./outbox.js";
import {
  openIndexedDatabase,
  runStoreRequest
} from "./indexed-db.js";

describe("createOutbox", () => {
  let databaseName: string;

  beforeEach(() => {
    databaseName = `owebee-test-${crypto.randomUUID()}`;
  });

  it("persists pending mutations in IndexedDB", async () => {
    const outbox = createOutbox(databaseName);

    await outbox.enqueue({
      clientMutationId: "00000000-0000-0000-0000-000000000001",
      type: "sync.test",
      createdAt: "2026-07-01T10:00:00.000Z",
      payload: { message: "hello" }
    });

    const pending = await outbox.listPending();

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      clientMutationId: "00000000-0000-0000-0000-000000000001",
      status: "pending"
    });
  });

  it("removes synced mutations from the pending list", async () => {
    const outbox = createOutbox(databaseName);
    const clientMutationId = "00000000-0000-0000-0000-000000000001";

    await outbox.enqueue({
      clientMutationId,
      type: "sync.test",
      createdAt: "2026-07-01T10:00:00.000Z",
      payload: { message: "hello" }
    });
    await outbox.markSynced(clientMutationId);

    await expect(outbox.listPending()).resolves.toEqual([]);
  });

  it("persists a complete expense.create mutation across repository instances", async () => {
    const payload: ExpenseCreatePayload = {
      payerMemberId: "00000000-0000-0000-0000-000000000010",
      amount: "48.20",
      currencyCode: "EUR",
      expenseDate: "2026-07-01",
      description: "Ужин",
      splitTargets: [
        {
          type: "member",
          id: "00000000-0000-0000-0000-000000000010"
        },
        {
          type: "family",
          id: "00000000-0000-0000-0000-000000000020"
        }
      ]
    };

    await createOutbox(databaseName).enqueue({
      clientMutationId: "00000000-0000-0000-0000-000000000001",
      tripId: "00000000-0000-0000-0000-000000000100",
      type: "expense.create",
      createdAt: "2026-07-01T10:00:00.000Z",
      payload
    });

    await expect(
      createOutbox(databaseName).listPendingExpenses(
        "00000000-0000-0000-0000-000000000100"
      )
    ).resolves.toEqual([
      {
        clientMutationId: "00000000-0000-0000-0000-000000000001",
        tripId: "00000000-0000-0000-0000-000000000100",
        type: "expense.create",
        createdAt: "2026-07-01T10:00:00.000Z",
        payload,
        status: "pending"
      }
    ]);
  });

  it("isolates pending expenses by trip and ignores legacy sync.test records", async () => {
    const outbox = createOutbox(databaseName);
    const memberId = "00000000-0000-0000-0000-000000000010";
    const tripAId = "00000000-0000-0000-0000-000000000100";
    const tripBId = "00000000-0000-0000-0000-000000000200";
    const payload: ExpenseCreatePayload = {
      payerMemberId: memberId,
      amount: "10",
      currencyCode: "RUB",
      expenseDate: "2026-07-01",
      description: "Такси",
      splitTargets: [{ type: "member", id: memberId }]
    };

    await outbox.enqueue({
      clientMutationId: "00000000-0000-0000-0000-000000000001",
      tripId: tripAId,
      type: "expense.create",
      createdAt: "2026-07-01T10:00:00.000Z",
      payload
    });
    await outbox.enqueue({
      clientMutationId: "00000000-0000-0000-0000-000000000002",
      tripId: tripBId,
      type: "expense.create",
      createdAt: "2026-07-01T10:01:00.000Z",
      payload
    });
    await outbox.enqueue({
      clientMutationId: "legacy",
      type: "sync.test",
      createdAt: "2026-07-01T10:02:00.000Z",
      payload: { message: "still supported" }
    });

    const tripA = await outbox.listPendingExpenses(tripAId);

    expect(tripA.map((mutation) => mutation.clientMutationId)).toEqual([
      "00000000-0000-0000-0000-000000000001"
    ]);
    await expect(outbox.listPending()).resolves.toHaveLength(3);
  });

  it("rejects a transaction when the payload cannot be cloned", async () => {
    const outbox = createOutbox(databaseName);

    await expect(
      outbox.enqueue({
        clientMutationId: "bad-payload",
        type: "sync.test",
        createdAt: "2026-07-01T10:00:00.000Z",
        payload: { invalid: (() => undefined) as unknown }
      })
    ).rejects.toBeDefined();

    await expect(outbox.listPending()).resolves.toEqual([]);
  });

  it("rejects a colliding mutation ID without overwriting the first expense", async () => {
    const outbox = createOutbox(databaseName);
    const clientMutationId = "00000000-0000-0000-0000-000000000001";
    const tripId = "00000000-0000-0000-0000-000000000100";
    const memberId = "00000000-0000-0000-0000-000000000010";
    const payload: ExpenseCreatePayload = {
      payerMemberId: memberId,
      amount: "10",
      currencyCode: "RUB",
      expenseDate: "2026-07-01",
      description: "Первый расход",
      splitTargets: [{ type: "member", id: memberId }]
    };

    await outbox.enqueue({
      clientMutationId,
      tripId,
      type: "expense.create",
      createdAt: "2026-07-01T10:00:00.000Z",
      payload
    });
    await expect(
      outbox.enqueue({
        clientMutationId,
        tripId,
        type: "expense.create",
        createdAt: "2026-07-01T10:01:00.000Z",
        payload: { ...payload, description: "Не должен перезаписать" }
      })
    ).rejects.toBeDefined();

    await expect(outbox.listPendingExpenses(tripId)).resolves.toMatchObject([
      { payload: { description: "Первый расход" } }
    ]);
  });

  it("isolates a malformed record and keeps valid pending expenses visible", async () => {
    const outbox = createOutbox(databaseName);
    const tripId = "00000000-0000-0000-0000-000000000100";
    const memberId = "00000000-0000-0000-0000-000000000010";
    await outbox.enqueue({
      clientMutationId: "00000000-0000-0000-0000-000000000001",
      tripId,
      type: "expense.create",
      createdAt: "2026-07-01T10:00:00.000Z",
      payload: {
        payerMemberId: memberId,
        amount: "10",
        currencyCode: "RUB",
        expenseDate: "2026-07-01",
        description: "Валидный расход",
        splitTargets: [{ type: "member", id: memberId }]
      }
    });
    await runStoreRequest({
      open: () =>
        openIndexedDatabase({
          name: databaseName,
          version: 1,
          upgrade: () => undefined
        }),
      storeName: "mutations",
      mode: "readwrite",
      operation: (store) =>
        store.put({
          clientMutationId: "malformed",
          type: "expense.create",
          tripId,
          status: "pending"
        })
    });

    await expect(outbox.listPendingExpenses(tripId)).resolves.toMatchObject([
      { payload: { description: "Валидный расход" } }
    ]);
  });

  it("does not allow expense.create to transition to synced", async () => {
    const outbox = createOutbox(databaseName);
    const tripId = "00000000-0000-0000-0000-000000000100";
    const memberId = "00000000-0000-0000-0000-000000000010";
    const clientMutationId = "00000000-0000-0000-0000-000000000001";
    await outbox.enqueue({
      clientMutationId,
      tripId,
      type: "expense.create",
      createdAt: "2026-07-01T10:00:00.000Z",
      payload: {
        payerMemberId: memberId,
        amount: "10",
        currencyCode: "RUB",
        expenseDate: "2026-07-01",
        description: "Локальный расход",
        splitTargets: [{ type: "member", id: memberId }]
      }
    });

    await expect(outbox.markSynced(clientMutationId)).rejects.toThrow(
      "STORY-017"
    );
    await expect(outbox.listPendingExpenses(tripId)).resolves.toHaveLength(1);
  });
});
