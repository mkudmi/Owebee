import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import {
  InvalidInviteError,
  RecoveryRequiredError,
  type InviteService
} from "./invite-service.js";

export interface InviteRoutesOptions {
  inviteService: InviteService;
}

export async function registerInviteRoutes(
  app: FastifyInstance,
  options: InviteRoutesOptions
) {
  app.post<{ Params: { inviteToken: string } }>(
    "/api/v1/invites/:inviteToken/join",
    async (request, reply) => {
      try {
        const result = await options.inviteService.joinInvite(
          request.params.inviteToken,
          request.body
        );
        return reply.code(201).send(result);
      } catch (error) {
        if (error instanceof ZodError) {
          return reply.code(400).send({
            error: {
              code: "invites.validation_failed",
              message: "Invite join data is invalid"
            }
          });
        }

        if (error instanceof InvalidInviteError) {
          return reply.code(404).send({
            error: {
              code: "invites.invalid_or_revoked",
              message: "Invite token is invalid or revoked"
            }
          });
        }

        if (error instanceof RecoveryRequiredError) {
          return reply.code(409).send({
            error: {
              code: "invites.recovery_required",
              message: "This guest already belongs to the trip",
              recoveryRequired: true
            }
          });
        }

        throw error;
      }
    }
  );
}
