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

describe("auth routes", () => {
  let database: PGlite;

  beforeEach(async () => {
    setTestEnv();
    database = new PGlite();
    await applyMigrations(database, await loadMigrations(migrationsDir));
  });

  it("registers an owner and returns a session token", async () => {
    const app = await buildApp({
      database,
      dependencyChecker: createDependencyChecker()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "OWNER@Example.com",
        displayName: "Owner",
        locale: "ru"
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.user).toMatchObject({
      email: "owner@example.com",
      displayName: "Owner",
      locale: "ru"
    });
    expect(body.sessionToken).toEqual(expect.any(String));

    const sessions = await database.query<{ session_hash: string }>(
      "select session_hash from auth_sessions"
    );
    expect(sessions.rows[0]?.session_hash).not.toBe(body.sessionToken);
  });

  it("rejects duplicate emails", async () => {
    const app = await buildApp({
      database,
      dependencyChecker: createDependencyChecker()
    });
    const payload = {
      email: "owner@example.com",
      displayName: "Owner",
      locale: "ru"
    };

    await app.inject({ method: "POST", url: "/api/v1/auth/register", payload });
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe("auth.email_already_registered");
  });

  it("rejects invalid registration payloads", async () => {
    const app = await buildApp({
      database,
      dependencyChecker: createDependencyChecker()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "not-an-email",
        displayName: "",
        locale: "ru"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("auth.validation_failed");
  });

  it("protects /api/v1/me and accepts valid sessions", async () => {
    const app = await buildApp({
      database,
      dependencyChecker: createDependencyChecker()
    });

    const unauthorized = await app.inject({ method: "GET", url: "/api/v1/me" });
    expect(unauthorized.statusCode).toBe(401);

    const registered = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "owner@example.com",
        displayName: "Owner",
        locale: "en"
      }
    });
    const token = registered.json().sessionToken as string;

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(me.statusCode).toBe(200);
    expect(me.json().user).toMatchObject({
      email: "owner@example.com",
      displayName: "Owner",
      locale: "en"
    });
  });
});
