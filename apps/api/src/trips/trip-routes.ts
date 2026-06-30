import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { InvalidSessionError, type AuthService } from "../auth/auth-service.js";
import { UnsupportedCurrencyError } from "../currency/currency-service.js";
import { parseBearerToken, unauthorized } from "../http/bearer.js";
import { DuplicateTripNameError, type TripService } from "./trip-service.js";

export interface TripRoutesOptions {
  authService: AuthService;
  tripService: TripService;
}

export async function registerTripRoutes(
  app: FastifyInstance,
  options: TripRoutesOptions
) {
  app.post("/api/v1/trips", async (request, reply) => {
    const token = parseBearerToken(request.headers.authorization);
    if (!token) {
      return unauthorized(reply);
    }

    try {
      const user = await options.authService.getUserBySessionToken(token);
      const result = await options.tripService.createTrip(request.body, {
        id: user.id,
        email: user.email,
        displayName: user.displayName
      });

      return reply.code(201).send(result);
    } catch (error) {
      if (error instanceof InvalidSessionError) {
        return unauthorized(reply);
      }

      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: {
            code: "trips.validation_failed",
            message: "Trip data is invalid"
          }
        });
      }

      if (error instanceof UnsupportedCurrencyError) {
        return reply.code(400).send({
          error: {
            code: "currency.unsupported_code",
            message: "Currency code is not supported"
          }
        });
      }

      if (error instanceof DuplicateTripNameError) {
        return reply.code(409).send({
          error: {
            code: "trips.name_already_exists",
            message: "An active trip with this name already exists"
          }
        });
      }

      throw error;
    }
  });
}
