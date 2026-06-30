import type { FastifyInstance } from "fastify";
import type { DependencyChecker, DependencyCheckResult } from "./dependencies.js";

export interface HealthRoutesOptions {
  dependencyChecker: DependencyChecker;
}

function buildReadinessStatus(checks: DependencyCheckResult[]) {
  const isReady = checks.every((check) => check.ok);

  return {
    status: isReady ? "ready" : "not_ready",
    checks
  };
}

export async function registerHealthRoutes(
  app: FastifyInstance,
  options: HealthRoutesOptions
) {
  app.get("/health/live", async () => ({
    status: "ok",
    service: "owebee-api"
  }));

  app.get("/health/ready", async (_request, reply) => {
    const checks = await Promise.all([
      options.dependencyChecker.checkPostgres(),
      options.dependencyChecker.checkRedis()
    ]);
    const readiness = buildReadinessStatus(checks);

    if (readiness.status !== "ready") {
      return reply.code(503).send(readiness);
    }

    return readiness;
  });
}

