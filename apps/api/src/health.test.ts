import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import type { DependencyChecker } from "./dependencies.js";

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

function createDependencyChecker(overrides: Partial<DependencyChecker> = {}): DependencyChecker {
  return {
    checkPostgres: async () => ({ name: "postgres", ok: true }),
    checkRedis: async () => ({ name: "redis", ok: true }),
    ...overrides
  };
}

describe("health routes", () => {
  it("returns liveness status", async () => {
    setTestEnv();
    const app = await buildApp({ dependencyChecker: createDependencyChecker() });

    const response = await app.inject({ method: "GET", url: "/health/live" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "owebee-api"
    });
  });

  it("returns ready when PostgreSQL and Redis checks pass", async () => {
    setTestEnv();
    const app = await buildApp({ dependencyChecker: createDependencyChecker() });

    const response = await app.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ready",
      checks: [
        { name: "postgres", ok: true },
        { name: "redis", ok: true }
      ]
    });
  });

  it("returns not ready when PostgreSQL is unavailable", async () => {
    setTestEnv();
    const app = await buildApp({
      dependencyChecker: createDependencyChecker({
        checkPostgres: async () => ({
          name: "postgres",
          ok: false,
          message: "connection refused"
        })
      })
    });

    const response = await app.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(503);
    const body = response.json();
    expect(body.status).toBe("not_ready");
    expect(body.checks).toContainEqual(
      expect.objectContaining({ name: "postgres", ok: false })
    );
  });

  it("returns not ready when Redis is unavailable", async () => {
    setTestEnv();
    const app = await buildApp({
      dependencyChecker: createDependencyChecker({
        checkRedis: async () => ({
          name: "redis",
          ok: false,
          message: "connection refused"
        })
      })
    });

    const response = await app.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: "not_ready",
      checks: [
        { name: "postgres", ok: true },
        { name: "redis", ok: false }
      ]
    });
  });
});
