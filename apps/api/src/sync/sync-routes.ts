import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { InvalidSessionError, type AuthService } from "../auth/auth-service.js";
import type { SyncService } from "./sync-service.js";

export interface SyncRoutesOptions {
  authService: AuthService;
  syncService: SyncService;
}

export async function registerSyncRoutes(
  app: FastifyInstance,
  options: SyncRoutesOptions
) {
  app.post("/api/v1/sync/push", async (request, reply) => {
    const token = parseBearerToken(request.headers.authorization);
    if (!token) {
      return unauthorized(reply);
    }

    try {
      const user = await options.authService.getUserBySessionToken(token);
      return await options.syncService.push(request.body, { userId: user.id });
    } catch (error) {
      if (error instanceof InvalidSessionError) {
        return unauthorized(reply);
      }

      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: {
            code: "sync.validation_failed",
            message: "Sync mutation payload is invalid"
          }
        });
      }

      throw error;
    }
  });
}

function parseBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function unauthorized(reply: {
  code(statusCode: number): { send(payload: unknown): unknown };
}) {
  return reply.code(401).send({
    error: {
      code: "auth.unauthorized",
      message: "Authentication is required"
    }
  });
}
