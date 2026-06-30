import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hashOpaqueToken, createOpaqueToken } from "../auth/session.js";
import type { CurrencyService } from "../currency/currency-service.js";
import { runInTransaction, type Database } from "../database/database.js";

const createTripSchema = z.object({
  name: z.string().trim().min(1).max(120),
  baseCurrencyCode: z.string().trim().min(1)
});

export interface RegisteredUserActor {
  id: string;
  email: string;
  displayName: string;
}

export interface CreateTripResult {
  trip: {
    id: string;
    name: string;
    baseCurrencyCode: string;
    status: "active";
  };
  inviteLink: string;
}

export class DuplicateTripNameError extends Error {
  constructor() {
    super("Trip name already exists for this owner");
  }
}

export function createInviteToken(): string {
  return createOpaqueToken();
}

export function hashInviteToken(token: string): string {
  return hashOpaqueToken(token);
}

export function buildInviteLink(webBaseUrl: string, inviteToken: string): string {
  return `${webBaseUrl.replace(/\/$/, "")}/t/${inviteToken}`;
}

export class TripService {
  constructor(
    private readonly database: Database,
    private readonly currencyService: CurrencyService,
    private readonly webBaseUrl: string
  ) {}

  async createTrip(
    input: unknown,
    owner: RegisteredUserActor
  ): Promise<CreateTripResult> {
    const parsed = createTripSchema.parse(input);
    const name = parsed.name.trim();
    const baseCurrencyCode = await this.currencyService.ensureActiveCurrencyCode(
      parsed.baseCurrencyCode
    );
    const tripId = randomUUID();
    const ownerMemberId = randomUUID();
    const inviteId = randomUUID();
    const inviteToken = createInviteToken();
    const inviteTokenHash = hashInviteToken(inviteToken);

    try {
      await runInTransaction(this.database, async (database) => {
        await database.query(
          `
            insert into trips (id, owner_user_id, name, base_currency_code)
            values ($1, $2, $3, $4)
          `,
          [tripId, owner.id, name, baseCurrencyCode]
        );
        await database.query(
          `
            insert into trip_members (
              id,
              trip_id,
              user_id,
              email,
              display_name,
              role,
              member_type,
              share_count
            )
            values ($1, $2, $3, $4, $5, 'owner', 'person', 1)
          `,
          [ownerMemberId, tripId, owner.id, owner.email, owner.displayName]
        );
        await database.query(
          `
            insert into trip_invites (id, trip_id, token_hash, created_by_user_id)
            values ($1, $2, $3, $4)
          `,
          [inviteId, tripId, inviteTokenHash, owner.id]
        );
        await database.query(
          `
            insert into audit_events (
              id,
              trip_id,
              actor_type,
              actor_id,
              event_type,
              entity_type,
              entity_id,
              metadata
            )
            values ($1, $2, 'user', $3, 'trip.created', 'trip', $2, $4::jsonb)
          `,
          [
            randomUUID(),
            tripId,
            owner.id,
            JSON.stringify({ baseCurrencyCode })
          ]
        );
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new DuplicateTripNameError();
      }

      throw error;
    }

    return {
      trip: {
        id: tripId,
        name,
        baseCurrencyCode,
        status: "active"
      },
      inviteLink: buildInviteLink(this.webBaseUrl, inviteToken)
    };
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    String(error.message).toLowerCase().includes("unique")
  );
}
