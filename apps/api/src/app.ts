import Fastify from "fastify";
import { loadConfig } from "@owebee/config";
import { AuthService } from "./auth/auth-service.js";
import { registerAuthRoutes } from "./auth/auth-routes.js";
import { CurrencyService } from "./currency/currency-service.js";
import { registerCurrencyRoutes } from "./currency/currency-routes.js";
import { createDependencyChecker } from "./dependencies.js";
import { createDatabase, type Database } from "./database/database.js";
import { FamilyService } from "./families/family-service.js";
import { registerFamilyRoutes } from "./families/family-routes.js";
import { registerHealthRoutes } from "./health.js";
import { InviteService } from "./invites/invite-service.js";
import { registerInviteRoutes } from "./invites/invite-routes.js";
import { registerSyncRoutes } from "./sync/sync-routes.js";
import { SyncService } from "./sync/sync-service.js";
import { TripService } from "./trips/trip-service.js";
import { registerTripRoutes } from "./trips/trip-routes.js";

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
  const currencyService = new CurrencyService(database);
  const inviteService = new InviteService(database);
  await registerHealthRoutes(app, { dependencyChecker });
  await registerAuthRoutes(app, { authService });
  await registerCurrencyRoutes(app, { currencyService });
  await registerTripRoutes(app, {
    authService,
    tripService: new TripService(database, currencyService, config.WEB_BASE_URL)
  });
  await registerInviteRoutes(app, { inviteService });
  await registerFamilyRoutes(app, {
    authService,
    inviteService,
    familyService: new FamilyService(database)
  });
  await registerSyncRoutes(app, {
    authService,
    syncService: new SyncService(database)
  });

  return app;
}
