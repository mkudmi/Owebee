import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { applyMigrations, loadMigrations } from "../database/migrations.js";
import type { DependencyChecker } from "../dependencies.js";

const migrationsDir = `${process.cwd()}/migrations`;
const baseEnv = {
  NODE_ENV: "test",
  API_HOST: "127.0.0.1",
  API_PORT: "4000",
  DATABASE_URL: "postgres://user:pass@localhost:5432/owebee",
  REDIS_URL: "redis://localhost:6379"
};

function setTestEnv() {
  Object.assign(process.env, baseEnv);
}

function createDependencyChecker(): DependencyChecker {
  return {
    checkPostgres: async () => ({ name: "postgres", ok: true }),
    checkRedis: async () => ({ name: "redis", ok: true })
  };
}

async function registerUser(app: Awaited<ReturnType<typeof buildApp>>) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      email: "owner@example.com",
      displayName: "Owner",
      locale: "ru"
    }
  });

  return response.json().sessionToken as string;
}

describe("sync routes", () => {
  let database: PGlite;

  beforeEach(async () => {
    setTestEnv();
    database = new PGlite();
    await applyMigrations(database, await loadMigrations(migrationsDir));
  });

  it("requires authentication for sync push", async () => {
    const app = await buildApp({
      database,
      dependencyChecker: createDependencyChecker()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync/push",
      payload: {}
    });

    expect(response.statusCode).toBe(401);
  });

  it("applies a sync.test mutation and stores it durably", async () => {
    const app = await buildApp({
      database,
      dependencyChecker: createDependencyChecker()
    });
    const sessionToken = await registerUser(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync/push",
      headers: {
        authorization: `Bearer ${sessionToken}`
      },
      payload: {
        tripId: null,
        clientDeviceId: "11111111-1111-4111-8111-111111111100",
        mutations: [
          {
            clientMutationId: "11111111-1111-4111-8111-111111111101",
            type: "sync.test",
            createdAt: "2026-07-01T10:00:00.000Z",
            payload: {
              message: "hello"
            }
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().results[0]).toMatchObject({
      clientMutationId: "11111111-1111-4111-8111-111111111101",
      status: "applied"
    });

    const stored = await database.query<{ mutation_type: string; status: string }>(
      "select mutation_type, status from sync_mutations"
    );
    expect(stored.rows).toEqual([{ mutation_type: "sync.test", status: "applied" }]);
  });

  it("returns duplicate for a replayed mutation without duplicating state", async () => {
    const app = await buildApp({
      database,
      dependencyChecker: createDependencyChecker()
    });
    const sessionToken = await registerUser(app);
    const payload = {
      tripId: null,
      clientDeviceId: "11111111-1111-4111-8111-111111111100",
      mutations: [
        {
          clientMutationId: "11111111-1111-4111-8111-111111111101",
          type: "sync.test",
          createdAt: "2026-07-01T10:00:00.000Z",
          payload: {
            message: "hello"
          }
        }
      ]
    };

    await app.inject({
      method: "POST",
      url: "/api/v1/sync/push",
      headers: { authorization: `Bearer ${sessionToken}` },
      payload
    });
    const replayed = await app.inject({
      method: "POST",
      url: "/api/v1/sync/push",
      headers: { authorization: `Bearer ${sessionToken}` },
      payload
    });

    expect(replayed.statusCode).toBe(200);
    expect(replayed.json().results[0]).toMatchObject({
      clientMutationId: "11111111-1111-4111-8111-111111111101",
      status: "duplicate"
    });

    const count = await database.query<{ count: string }>(
      "select count(*)::text as count from sync_mutations"
    );
    expect(count.rows[0]?.count).toBe("1");
  });

  it("rejects invalid mutation payloads", async () => {
    const app = await buildApp({
      database,
      dependencyChecker: createDependencyChecker()
    });
    const sessionToken = await registerUser(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync/push",
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: {
        clientDeviceId: "not-a-uuid",
        mutations: []
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("sync.validation_failed");
  });
});
