import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export interface QueryExecutor {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

export interface Migration {
  id: string;
  up: string;
  down: string;
}

const UP_MARKER = "-- migrate:up";
const DOWN_MARKER = "-- migrate:down";

export function parseMigration(id: string, sql: string): Migration {
  const upIndex = sql.indexOf(UP_MARKER);
  const downIndex = sql.indexOf(DOWN_MARKER);

  if (upIndex === -1 || downIndex === -1 || downIndex <= upIndex) {
    throw new Error(`Migration ${id} must contain ordered up and down markers`);
  }

  const up = sql.slice(upIndex + UP_MARKER.length, downIndex).trim();
  const down = sql.slice(downIndex + DOWN_MARKER.length).trim();

  if (!up || !down) {
    throw new Error(`Migration ${id} must define non-empty up and down SQL`);
  }

  return { id, up, down };
}

export async function loadMigrations(directory: string): Promise<Migration[]> {
  const files = (await readdir(directory))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  return Promise.all(
    files.map(async (fileName) => {
      const sql = await readFile(join(directory, fileName), "utf8");
      return parseMigration(fileName.replace(/\.sql$/, ""), sql);
    })
  );
}

async function ensureMigrationTable(executor: QueryExecutor) {
  await executor.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `);
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function executeSqlStatements(executor: QueryExecutor, sql: string) {
  for (const statement of splitSqlStatements(sql)) {
    await executor.query(statement);
  }
}

async function getAppliedMigrationIds(executor: QueryExecutor): Promise<Set<string>> {
  await ensureMigrationTable(executor);
  const result = (await executor.query(
    "select id from schema_migrations order by id"
  )) as { rows: Array<{ id: string }> };

  return new Set(result.rows.map((row) => row.id));
}

export async function applyMigrations(
  executor: QueryExecutor,
  migrations: Migration[]
): Promise<string[]> {
  const appliedIds = await getAppliedMigrationIds(executor);
  const newlyApplied: string[] = [];

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) {
      continue;
    }

    await executor.query("begin");
    try {
      await executeSqlStatements(executor, migration.up);
      await executor.query("insert into schema_migrations (id) values ($1)", [
        migration.id
      ]);
      await executor.query("commit");
      newlyApplied.push(migration.id);
    } catch (error) {
      await executor.query("rollback");
      throw error;
    }
  }

  return newlyApplied;
}
