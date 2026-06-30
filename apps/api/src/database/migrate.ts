import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadConfig } from "@owebee/config";
import { applyMigrations, loadMigrations } from "./migrations.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(currentDir, "../../migrations");
const config = loadConfig();
const client = new pg.Client({ connectionString: config.DATABASE_URL });

try {
  await client.connect();
  const migrations = await loadMigrations(migrationsDir);
  const applied = await applyMigrations(client, migrations);
  console.log(
    applied.length > 0
      ? `Applied migrations: ${applied.join(", ")}`
      : "No pending migrations"
  );
} finally {
  await client.end();
}

