import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";
import type { AuthService } from "../auth/auth-service.js";
import { resolveTripActor } from "../auth/trip-actor.js";
import { UnsupportedCurrencyError } from "../currency/currency-service.js";
import { unauthorized } from "../http/bearer.js";
import type { InviteService } from "../invites/invite-service.js";
import {
  DuplicateSplitTargetError,
  ExpenseForbiddenError,
  ExpenseTripNotActiveError,
  IdempotencyConflictError,
  InvalidExpenseCursorError,
  InvalidExpenseParticipantError,
  ManualRateRequiredError,
  type ExpenseService
} from "./expense-service.js";

export async function registerExpenseRoutes(
  app: FastifyInstance,
  options: {
    authService: AuthService;
    inviteService: InviteService;
    expenseService: ExpenseService;
  }
) {
  app.post<{ Params: { tripId: string } }>(
    "/api/v1/trips/:tripId/expenses",
    async (request, reply) => {
      const actor = await resolveTripActor(request.headers.authorization, options);
      if (!actor) return unauthorized(reply);
      const key = request.headers["idempotency-key"];
      try {
        const result = await options.expenseService.createExpense(
          request.params.tripId,
          request.body,
          typeof key === "string" ? key : "",
          actor
        );
        return reply.code(result.replayed ? 200 : 201).send({ expense: result.expense });
      } catch (error) {
        return handleExpenseError(error, reply);
      }
    }
  );

  app.get<{ Params: { tripId: string }; Querystring: { limit?: string; cursor?: string } }>(
    "/api/v1/trips/:tripId/expenses",
    async (request, reply) => {
      const actor = await resolveTripActor(request.headers.authorization, options);
      if (!actor) return unauthorized(reply);
      try {
        return await options.expenseService.listExpenses(
          request.params.tripId,
          request.query,
          actor
        );
      } catch (error) {
        return handleExpenseError(error, reply);
      }
    }
  );
}

function handleExpenseError(error: unknown, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return sendError(reply, 400, "expenses.validation_failed", "Expense data is invalid");
  }
  if (error instanceof DuplicateSplitTargetError) {
    return sendError(reply, 400, "expenses.duplicate_split_target", "Split targets must be unique");
  }
  if (error instanceof InvalidExpenseParticipantError) {
    return sendError(reply, 400, "expenses.invalid_participant", "Expense participant is invalid");
  }
  if (error instanceof UnsupportedCurrencyError) {
    return sendError(reply, 400, "currency.unsupported_code", "Currency code is not supported");
  }
  if (error instanceof ExpenseForbiddenError) {
    return sendError(reply, 403, "expenses.forbidden", "Expense access is forbidden");
  }
  if (error instanceof ExpenseTripNotActiveError) {
    return sendError(reply, 409, "trips.not_active", "Trip is not active");
  }
  if (error instanceof IdempotencyConflictError) {
    return sendError(reply, 409, "expenses.idempotency_conflict", "Idempotency key payload differs");
  }
  if (error instanceof ManualRateRequiredError) {
    return sendError(reply, 422, "expenses.manual_rate_required", "Automatic exchange rate is unavailable");
  }
  if (error instanceof InvalidExpenseCursorError) {
    return sendError(reply, 400, "expenses.invalid_cursor", "Expense cursor is invalid");
  }
  throw error;
}

function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string
) {
  return reply.code(status).send({ error: { code, message } });
}
