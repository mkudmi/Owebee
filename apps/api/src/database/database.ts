import pg from "pg";
import type { QueryResultRow } from "pg";

export interface Database {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>;
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
    }
  };
}
