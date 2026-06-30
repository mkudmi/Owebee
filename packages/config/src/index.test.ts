import { describe, expect, it } from "vitest";
import { loadConfig } from "./index.js";

describe("loadConfig", () => {
  it("loads valid environment configuration", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      API_HOST: "127.0.0.1",
      API_PORT: "4100",
      DATABASE_URL: "postgres://user:pass@localhost:5432/app",
      REDIS_URL: "redis://localhost:6379"
    });

    expect(config.API_PORT).toBe(4100);
    expect(config.NODE_ENV).toBe("test");
  });

  it("fails fast when required variables are missing", () => {
    expect(() => loadConfig({ NODE_ENV: "test" })).toThrow(
      "Invalid environment configuration"
    );
  });
});

