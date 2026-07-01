import type { FastifyInstance, FastifyReply } from "fastify";
import type { AuthService } from "../auth/auth-service.js";
import { resolveTripActor } from "../auth/trip-actor.js";
import { unauthorized } from "../http/bearer.js";
import type { InviteService } from "../invites/invite-service.js";
import {
  BalanceForbiddenError,
  BalanceTargetNotFoundError,
  InvalidBalanceBreakdownQueryError,
  InvalidBalanceCursorError,
  type BalanceService
} from "./balance-service.js";

export async function registerBalanceRoutes(
  app: FastifyInstance,
  options: {
    authService: AuthService;
    inviteService: InviteService;
    balanceService: BalanceService;
  }
) {
  app.get<{ Params: { tripId: string } }>(
    "/api/v1/trips/:tripId/balance",
    async (request, reply) => {
      const actor = await resolveTripActor(
        request.headers.authorization,
        options,
        { includeForbiddenGuestContext: true }
      );
      if (!actor) return unauthorized(reply);
      try {
        return await options.balanceService.getBalance(
          request.params.tripId,
          actor
        );
      } catch (error) {
        return handleBalanceError(error, reply);
      }
    }
  );

  app.get<{
    Params: { tripId: string; targetType: string; targetId: string };
    Querystring: { limit?: string; cursor?: string };
  }>(
    "/api/v1/trips/:tripId/balance/:targetType/:targetId",
    async (request, reply) => {
      const actor = await resolveTripActor(
        request.headers.authorization,
        options,
        { includeForbiddenGuestContext: true }
      );
      if (!actor) return unauthorized(reply);
      try {
        return await options.balanceService.getBreakdown(
          request.params.tripId,
          request.params.targetType,
          request.params.targetId,
          request.query,
          actor
        );
      } catch (error) {
        return handleBalanceError(error, reply);
      }
    }
  );
}

function handleBalanceError(error: unknown, reply: FastifyReply) {
  if (error instanceof BalanceForbiddenError) {
    return reply.code(403).send({
      error: {
        code: "balance.forbidden",
        message: "Balance access is forbidden"
      }
    });
  }
  if (error instanceof InvalidBalanceBreakdownQueryError) {
    return reply.code(400).send({
      error: {
        code: "balance.invalid_request",
        message: "Balance breakdown request is invalid"
      }
    });
  }
  if (error instanceof InvalidBalanceCursorError) {
    return reply.code(400).send({
      error: {
        code: "balance.invalid_cursor",
        message: "Balance breakdown cursor is invalid"
      }
    });
  }
  if (error instanceof BalanceTargetNotFoundError) {
    return reply.code(404).send({
      error: {
        code: "balance.target_not_found",
        message: "Balance target was not found"
      }
    });
  }
  throw error;
}
