import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createOutbox } from "./outbox.js";

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
});
