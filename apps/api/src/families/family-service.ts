import { randomUUID } from "node:crypto";
import { z } from "zod";
import { runInTransaction, type Database } from "../database/database.js";
import { isUniqueConstraintError } from "../trips/trip-service.js";

const createFamilySchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  shareCount: z
    .string()
    .trim()
    .regex(/^(?:0*[1-9]\d*)(?:\.\d+)?$|^0*\.\d*[1-9]\d*$/)
});

export type TripActor =
  | { type: "registered"; userId: string }
  | { type: "guest"; memberId: string; tripId: string };

export interface FamilyDto {
  id: string;
  tripId: string;
  displayName: string;
  shareCount: string;
  status: "active";
}

export interface ParticipantsResult {
  tripId: string;
  members: Array<{
    id: string;
    displayName: string;
    email: string | null;
    role: "owner" | "participant";
    status: "active" | "archived";
  }>;
  families: FamilyDto[];
}

export class TripNotFoundError extends Error {
  constructor() {
    super("Trip not found");
  }
}

export class TripNotActiveError extends Error {
  constructor() {
    super("Trip is not active");
  }
}

export class ForbiddenTripActionError extends Error {
  constructor() {
    super("Actor is not allowed to perform this trip action");
  }
}

export class DuplicateFamilyNameError extends Error {
  constructor() {
    super("Family name already exists in this trip");
  }
}

export class FamilyService {
  constructor(private readonly database: Database) {}

  async createFamily(
    tripId: string,
    input: unknown,
    actor: TripActor
  ): Promise<{ family: FamilyDto }> {
    const parsed = createFamilySchema.parse(input);
    await this.ensureOwnerCanManageTrip(tripId, actor);

    const familyId = randomUUID();
    const displayName = parsed.displayName.trim();

    try {
      await runInTransaction(this.database, async (database) => {
        await database.query(
          `
            insert into families (id, trip_id, display_name, share_count)
            values ($1, $2, $3, $4::numeric)
          `,
          [familyId, tripId, displayName, parsed.shareCount]
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
            values ($1, $2, $3, $4, 'family.created', 'family', $5, $6::jsonb)
          `,
          [
            randomUUID(),
            tripId,
            actor.type === "registered" ? "user" : "guest",
            actor.type === "registered" ? actor.userId : actor.memberId,
            familyId,
            JSON.stringify({ shareCount: parsed.shareCount })
          ]
        );
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new DuplicateFamilyNameError();
      }

      throw error;
    }

    return {
      family: {
        id: familyId,
        tripId,
        displayName,
        shareCount: parsed.shareCount,
        status: "active"
      }
    };
  }

  async listParticipants(
    tripId: string,
    actor: TripActor
  ): Promise<ParticipantsResult> {
    await this.ensureCanReadTrip(tripId, actor);

    const members = await this.database.query<{
      id: string;
      display_name: string;
      email: string | null;
      role: "owner" | "participant";
      status: "active" | "archived";
    }>(
      `
        select id, display_name, email, role, status
        from trip_members
        where trip_id = $1
        order by created_at asc
      `,
      [tripId]
    );
    const families = await this.database.query<{
      id: string;
      trip_id: string;
      display_name: string;
      share_count: string;
      status: "active";
    }>(
      `
        select id, trip_id, display_name, share_count::text as share_count, status
        from families
        where trip_id = $1 and status = 'active'
        order by created_at asc
      `,
      [tripId]
    );

    return {
      tripId,
      members: members.rows.map((member) => ({
        id: member.id,
        displayName: member.display_name,
        email: member.email,
        role: member.role,
        status: member.status
      })),
      families: families.rows.map((family) => ({
        id: family.id,
        tripId: family.trip_id,
        displayName: family.display_name,
        shareCount: family.share_count,
        status: family.status
      }))
    };
  }

  private async ensureOwnerCanManageTrip(tripId: string, actor: TripActor) {
    const trip = await this.findTrip(tripId);
    if (!trip) {
      throw new TripNotFoundError();
    }

    if (trip.status !== "active") {
      throw new TripNotActiveError();
    }

    if (actor.type === "guest" || trip.owner_user_id !== actor.userId) {
      throw new ForbiddenTripActionError();
    }
  }

  private async ensureCanReadTrip(tripId: string, actor: TripActor) {
    const trip = await this.findTrip(tripId);
    if (!trip) {
      throw new TripNotFoundError();
    }

    if (actor.type === "registered" && trip.owner_user_id === actor.userId) {
      return;
    }

    const memberId = actor.type === "guest" ? actor.memberId : null;
    if (!memberId) {
      throw new ForbiddenTripActionError();
    }

    const result = await this.database.query<{ id: string }>(
      `
        select id
        from trip_members
        where id = $1
          and trip_id = $2
          and status = 'active'
        limit 1
      `,
      [memberId, tripId]
    );

    if (!result.rows[0]) {
      throw new ForbiddenTripActionError();
    }
  }

  private async findTrip(tripId: string) {
    const result = await this.database.query<{
      id: string;
      owner_user_id: string;
      status: "active" | "archived" | "deleted";
    }>(
      `
        select id, owner_user_id, status
        from trips
        where id = $1
        limit 1
      `,
      [tripId]
    );

    return result.rows[0] ?? null;
  }
}
