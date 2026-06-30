import Redis from "ioredis";
import pg from "pg";

export interface DependencyCheckResult {
  name: "postgres" | "redis";
  ok: boolean;
  message?: string;
}

export interface DependencyChecker {
  checkPostgres(): Promise<DependencyCheckResult>;
  checkRedis(): Promise<DependencyCheckResult>;
}

export function createDependencyChecker(options: {
  databaseUrl: string;
  redisUrl: string;
}): DependencyChecker {
  return {
    async checkPostgres() {
      const client = new pg.Client({ connectionString: options.databaseUrl });

      try {
        await client.connect();
        await client.query("select 1");
        return { name: "postgres", ok: true };
      } catch (error) {
        return {
          name: "postgres",
          ok: false,
          message: error instanceof Error ? error.message : "Unknown PostgreSQL error"
        };
      } finally {
        await client.end().catch(() => undefined);
      }
    },

    async checkRedis() {
      const redis = new Redis(options.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 0
      });

      try {
        await redis.connect();
        const pong = await redis.ping();
        return { name: "redis", ok: pong === "PONG" };
      } catch (error) {
        return {
          name: "redis",
          ok: false,
          message: error instanceof Error ? error.message : "Unknown Redis error"
        };
      } finally {
        redis.disconnect();
      }
    }
  };
}

