import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { parseBearerToken, unauthorized } from "../http/bearer.js";
import { DuplicateEmailError, InvalidSessionError } from "./auth-service.js";
import type { AuthService } from "./auth-service.js";

export interface AuthRoutesOptions {
  authService: AuthService;
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  options: AuthRoutesOptions
) {
  app.post("/api/v1/auth/register", async (request, reply) => {
    try {
      const result = await options.authService.register(request.body);
      return reply.code(201).send({
        user: result.user,
        sessionToken: result.sessionToken
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: {
            code: "auth.validation_failed",
            message: "Registration data is invalid"
          }
        });
      }

      if (error instanceof DuplicateEmailError) {
        return reply.code(409).send({
          error: {
            code: "auth.email_already_registered",
            message: "Email is already registered"
          }
        });
      }

      throw error;
    }
  });

  app.get("/api/v1/me", async (request, reply) => {
    const authorizationHeader = request.headers.authorization;
    const token = parseBearerToken(authorizationHeader);

    if (!token) {
      return unauthorized(reply);
    }

    try {
      const user = await options.authService.getUserBySessionToken(token);
      return { user };
    } catch (error) {
      if (error instanceof InvalidSessionError) {
        return unauthorized(reply);
      }

      throw error;
    }
  });
}
