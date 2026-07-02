import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { openIndexedDatabase, runStoreRequest } from "./indexed-db.js";
import {
  buildWorkspaceReferenceSnapshot,
  createWorkspaceReferenceCache
} from "./workspace-reference-cache.js";

describe("workspace reference cache", () => {
  let databaseName: string;
  const tripId = "00000000-0000-0000-0000-000000000100";

  beforeEach(() => {
    databaseName = `owebee-references-${crypto.randomUUID()}`;
  });

  it("persists a validated snapshot across repository instances", async () => {
    const snapshot = buildWorkspaceReferenceSnapshot(
      {
        tripId,
        members: [
          {
            id: "00000000-0000-0000-0000-000000000010",
            displayName: "Елена",
            email: "must-not-be-cached@example.com",
            role: "participant",
            status: "active"
          },
          {
            id: "00000000-0000-0000-0000-000000000011",
            displayName: "Старый участник",
            email: null,
            role: "participant",
            status: "archived"
          }
        ],
        families: [
          {
            id: "00000000-0000-0000-0000-000000000020",
            tripId,
            displayName: "Семья Ивановых",
            shareCount: "2",
            status: "active"
          }
        ]
      },
      [
        {
          code: "RUB",
          displayName: "Российский рубль",
          symbol: "₽",
          minorUnits: 2
        }
      ],
      "2026-07-01T10:00:00.000Z"
    );

    await createWorkspaceReferenceCache(databaseName).put(snapshot);
    const restored =
      await createWorkspaceReferenceCache(databaseName).get(tripId);

    expect(restored).toEqual(snapshot);
    expect(restored?.members.map((member) => member.id)).toEqual([
      "00000000-0000-0000-0000-000000000010"
    ]);
    expect(JSON.stringify(restored)).not.toContain("must-not-be-cached");
  });

  it("returns null for a malformed stored snapshot", async () => {
    const open = () =>
      openIndexedDatabase({
        name: databaseName,
        version: 1,
        upgrade(database) {
          database.createObjectStore("snapshots", { keyPath: "tripId" });
        }
      });
    await runStoreRequest({
      open,
      storeName: "snapshots",
      mode: "readwrite",
      operation: (store) =>
        store.put({
          tripId,
          members: "wrong",
          families: [],
          currencies: [],
          updatedAt: "not-a-date"
        })
    });

    await expect(
      createWorkspaceReferenceCache(databaseName).get(tripId)
    ).resolves.toBeNull();
  });

  it("rejects duplicate reference identifiers", async () => {
    const member = {
      id: "00000000-0000-0000-0000-000000000010",
      displayName: "Елена",
      role: "participant" as const
    };

    await expect(
      createWorkspaceReferenceCache(databaseName).put({
        tripId,
        members: [member, member],
        families: [],
        currencies: [
          {
            code: "RUB",
            displayName: "Рубль",
            symbol: "₽",
            minorUnits: 2
          }
        ],
        updatedAt: "2026-07-01T10:00:00.000Z"
      })
    ).rejects.toThrow("invalid");
  });

  it("closes the database after a synchronous transaction setup failure", async () => {
    const openV1 = () =>
      openIndexedDatabase({
        name: databaseName,
        version: 1,
        upgrade(database) {
          if (!database.objectStoreNames.contains("present")) {
            database.createObjectStore("present");
          }
        }
      });
    const initial = await openV1();
    initial.close();

    await expect(
      runStoreRequest({
        open: openV1,
        storeName: "missing",
        mode: "readonly",
        operation: (store) => store.get("key")
      })
    ).rejects.toBeDefined();

    const upgraded = await openIndexedDatabase({
      name: databaseName,
      version: 2,
      upgrade(database) {
        database.createObjectStore("added-after-failure");
      }
    });
    expect(upgraded.objectStoreNames.contains("added-after-failure")).toBe(true);
    upgraded.close();
  });

  it("rejects an upgrade callback failure without leaking the connection", async () => {
    await expect(
      openIndexedDatabase({
        name: databaseName,
        version: 1,
        upgrade() {
          throw new Error("upgrade failed");
        }
      })
    ).rejects.toThrow("upgrade failed");

    const recovered = await openIndexedDatabase({
      name: databaseName,
      version: 1,
      upgrade(database) {
        database.createObjectStore("snapshots", { keyPath: "tripId" });
      }
    });
    expect(recovered.objectStoreNames.contains("snapshots")).toBe(true);
    recovered.close();
  });
});
