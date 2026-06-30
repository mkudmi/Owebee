import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_BASE_URL: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  CBR_SOAP_URL: z
    .string()
    .url()
    .default("https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx"),
  CBR_TIMEOUT_MS: z.coerce.number().int().positive().default(5000)
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}
