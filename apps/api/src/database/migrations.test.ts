import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { applyMigrations, loadMigrations, parseMigration } from "./migrations.js";

const migrationsDir = resolve(process.cwd(), "migrations");

describe("migrations", () => {
  it("parses a migration with up and down sections", () => {
    const migration = parseMigration(
      "example",
      "-- migrate:up\ncreate table test_table(id text);\n-- migrate:down\ndrop table test_table;"
    );

    expect(migration.up).toContain("create table");
    expect(migration.down).toContain("drop table");
  });

  it("rejects migrations without required markers", () => {
    expect(() => parseMigration("bad", "select 1;")).toThrow(
      "must contain ordered up and down markers"
    );
  });

  it("applies the core baseline migration to an empty database", async () => {
    const db = new PGlite();
    const migrations = await loadMigrations(migrationsDir);

    const applied = await applyMigrations(db, migrations);

    expect(applied).toEqual(["0001_core_baseline", "0002_sync_mutations"]);

    const tables = await db.query<{ table_name: string }>(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `);

    expect(tables.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        "audit_events",
        "auth_sessions",
        "trip_invites",
        "trip_members",
        "trips",
        "users"
      ])
    );
  });

  it("supports the first user, trip, and owner member insert path", async () => {
    const db = new PGlite();
    const migrations = await loadMigrations(migrationsDir);
    await applyMigrations(db, migrations);

    await db.query(`
      insert into users (id, email, display_name, locale)
      values ('00000000-0000-0000-0000-000000000001', 'owner@example.com', 'Owner', 'ru')
    `);
    await db.query(`
      insert into trips (id, owner_user_id, name, base_currency_code)
      values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Test Trip', 'RUB')
    `);
    await db.query(`
      insert into trip_members (id, trip_id, user_id, email, display_name, role)
      values (
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'owner@example.com',
        'Owner',
        'owner'
      )
    `);

    const members = await db.query<{ display_name: string; role: string }>(
      "select display_name, role from trip_members"
    );

    expect(members.rows).toEqual([{ display_name: "Owner", role: "owner" }]);
  });

  it("enforces unique registered user emails", async () => {
    const db = new PGlite();
    const migrations = await loadMigrations(migrationsDir);
    await applyMigrations(db, migrations);

    await db.query(`
      insert into users (id, email, display_name, locale)
      values ('00000000-0000-0000-0000-000000000001', 'owner@example.com', 'Owner', 'ru')
    `);

    await expect(
      db.query(`
        insert into users (id, email, display_name, locale)
        values ('00000000-0000-0000-0000-000000000002', 'owner@example.com', 'Owner 2', 'en')
      `)
    ).rejects.toThrow();
  });

  it("keeps raw token columns out of the baseline schema", async () => {
    const sql = await readFile(resolve(migrationsDir, "0001_core_baseline.sql"), "utf8");

    expect(sql).toContain("session_hash");
    expect(sql).toContain("token_hash");
    expect(sql).not.toContain("session_token");
    expect(sql).not.toContain("invite_token");
  });
});
