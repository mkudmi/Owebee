import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { InvalidSessionError, type AuthService } from "../auth/auth-service.js";
import { parseBearerToken, unauthorized } from "../http/bearer.js";
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
