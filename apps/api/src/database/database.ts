import pg from "pg";
import type { QueryResultRow } from "pg";

export interface Database {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>;
  transaction?<T>(callback: (database: Database) => Promise<T>): Promise<T>;
}

export function createDatabase(databaseUrl: string): Database {
  const pool = new pg.Pool({ connectionString: databaseUrl });

  return {
    async query<T extends QueryResultRow = QueryResultRow>(
      sql: string,
      params?: unknown[]
    ) {
      const result = await pool.query<T>(sql, params);
      return { rows: result.rows };
    },

    async transaction<T>(callback: (database: Database) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      const transactionalDatabase: Database = {
        async query<R extends QueryResultRow = QueryResultRow>(
          sql: string,
          params?: unknown[]
        ) {
          const result = await client.query<R>(sql, params);
          return { rows: result.rows };
        }
      };

      try {
        await client.query("begin");
        const result = await callback(transactionalDatabase);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

export async function runInTransaction<T>(
  database: Database,
  callback: (database: Database) => Promise<T>
): Promise<T> {
  if (database.transaction) {
    return database.transaction(callback);
  }

  await database.query("begin");
  try {
    const result = await callback(database);
    await database.query("commit");
    return result;
  } catch (error) {
    await database.query("rollback").catch(() => undefined);
    throw error;
  }
}
