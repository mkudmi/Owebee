import Fastify from "fastify";
import { loadConfig } from "@owebee/config";
import { AuthService } from "./auth/auth-service.js";
import { registerAuthRoutes } from "./auth/auth-routes.js";
import { createDependencyChecker } from "./dependencies.js";
import { createDatabase, type Database } from "./database/database.js";
import { registerHealthRoutes } from "./health.js";
import { registerSyncRoutes } from "./sync/sync-routes.js";
import { SyncService } from "./sync/sync-service.js";

export interface BuildAppOptions {
  dependencyChecker?: ReturnType<typeof createDependencyChecker>;
  database?: Database;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const config = loadConfig();
  const app = Fastify({
    logger: config.NODE_ENV !== "test"
  });
  const dependencyChecker =
    options.dependencyChecker ??
    createDependencyChecker({
      databaseUrl: config.DATABASE_URL,
      redisUrl: config.REDIS_URL
    });
  const database = options.database ?? createDatabase(config.DATABASE_URL);

  const authService = new AuthService(database);
  await registerHealthRoutes(app, { dependencyChecker });
  await registerAuthRoutes(app, { authService });
  await registerSyncRoutes(app, {
    authService,
    syncService: new SyncService(database)
  });

  return app;
}
