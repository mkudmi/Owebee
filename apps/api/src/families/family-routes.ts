import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { InvalidSessionError, type AuthService } from "../auth/auth-service.js";
import { parseBearerToken, unauthorized } from "../http/bearer.js";
import type { InviteService } from "../invites/invite-service.js";
import {
  DuplicateFamilyNameError,
  ForbiddenTripActionError,
  TripNotActiveError,
  TripNotFoundError,
  type FamilyService,
  type TripActor
} from "./family-service.js";

export interface FamilyRoutesOptions {
  authService: AuthService;
  inviteService: InviteService;
  familyService: FamilyService;
}

export async function registerFamilyRoutes(
  app: FastifyInstance,
  options: FamilyRoutesOptions
) {
  app.post<{ Params: { tripId: string } }>(
    "/api/v1/trips/:tripId/families",
    async (request, reply) => {
      const actor = await resolveActor(request.headers.authorization, options);
      if (!actor) {
        return unauthorized(reply);
      }

      try {
        const result = await options.familyService.createFamily(
          request.params.tripId,
          request.body,
          actor
        );
        return reply.code(201).send(result);
      } catch (error) {
        return handleFamilyError(error, reply);
      }
    }
  );

  app.get<{ Params: { tripId: string } }>(
    "/api/v1/trips/:tripId/participants",
    async (request, reply) => {
      const actor = await resolveActor(request.headers.authorization, options);
      if (!actor) {
        return unauthorized(reply);
      }

      try {
        return await options.familyService.listParticipants(
          request.params.tripId,
          actor
        );
      } catch (error) {
        return handleFamilyError(error, reply);
      }
    }
  );
}

async function resolveActor(
  authorizationHeader: string | undefined,
  options: Pick<FamilyRoutesOptions, "authService" | "inviteService">
): Promise<TripActor | null> {
  const token = parseBearerToken(authorizationHeader);
  if (!token) {
    return null;
  }

  try {
    const user = await options.authService.getUserBySessionToken(token);
    return { type: "registered", userId: user.id };
  } catch (error) {
    if (!(error instanceof InvalidSessionError)) {
      throw error;
    }
  }

  const guest = await options.inviteService.getGuestBySessionToken(token);
  return guest
    ? { type: "guest", memberId: guest.memberId, tripId: guest.tripId }
    : null;
}

function handleFamilyError(
  error: unknown,
  reply: { code(statusCode: number): { send(payload: unknown): unknown } }
) {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: {
        code: "families.validation_failed",
        message: "Family data is invalid"
      }
    });
  }

  if (error instanceof TripNotFoundError) {
    return reply.code(404).send({
      error: {
        code: "trips.not_found",
        message: "Trip was not found"
      }
    });
  }

  if (error instanceof TripNotActiveError) {
    return reply.code(409).send({
      error: {
        code: "trips.not_active",
        message: "Trip is not active"
      }
    });
  }

  if (error instanceof ForbiddenTripActionError) {
    return reply.code(403).send({
      error: {
        code: "trips.forbidden",
        message: "This action is not allowed for the current actor"
      }
    });
  }

  if (error instanceof DuplicateFamilyNameError) {
    return reply.code(409).send({
      error: {
        code: "families.name_already_exists",
        message: "An active family with this name already exists"
      }
    });
  }

  throw error;
}
