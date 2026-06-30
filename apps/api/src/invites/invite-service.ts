import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createSessionToken, hashSessionToken } from "../auth/session.js";
import { runInTransaction, type Database } from "../database/database.js";
import { hashInviteToken, isUniqueConstraintError } from "../trips/trip-service.js";

const joinInviteSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  email: z.string().email(),
  locale: z.enum(["ru", "en"]).default("ru")
});

export class InvalidInviteError extends Error {
  constructor() {
    super("Invite token is invalid or revoked");
  }
}

export class RecoveryRequiredError extends Error {
  constructor() {
    super("Guest already exists in this trip");
  }
}

export interface JoinInviteResult {
  tripId: string;
  memberId: string;
  role: "participant";
  guestSessionToken: string;
}

export interface GuestSessionActor {
  memberId: string;
  tripId: string;
  email: string;
  displayName: string;
  role: "owner" | "participant";
}

export class InviteService {
  constructor(private readonly database: Database) {}

  async joinInvite(inviteToken: string, input: unknown): Promise<JoinInviteResult> {
    const parsed = joinInviteSchema.parse(input);
    const invite = await this.findActiveInvite(inviteToken);

    if (!invite) {
      throw new InvalidInviteError();
    }

    const email = parsed.email.trim().toLowerCase();
    const existingMember = await this.findActiveMemberByEmail(invite.trip_id, email);
    if (existingMember) {
      throw new RecoveryRequiredError();
    }

    const memberId = randomUUID();
    const sessionId = randomUUID();
    const guestSessionToken = createSessionToken();
    const guestSessionHash = hashSessionToken(guestSessionToken);

    try {
      await runInTransaction(this.database, async (database) => {
        await database.query(
          `
            insert into trip_members (
              id,
              trip_id,
              email,
              display_name,
              role,
              member_type,
              share_count
            )
            values ($1, $2, $3, $4, 'participant', 'person', 1)
          `,
          [memberId, invite.trip_id, email, parsed.displayName.trim()]
        );
        await database.query(
          `
            insert into guest_sessions (id, trip_member_id, session_hash, last_seen_at)
            values ($1, $2, $3, now())
          `,
          [sessionId, memberId, guestSessionHash]
        );
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new RecoveryRequiredError();
      }

      throw error;
    }

    return {
      tripId: invite.trip_id,
      memberId,
      role: "participant",
      guestSessionToken
    };
  }

  async getGuestBySessionToken(token: string): Promise<GuestSessionActor | null> {
    const sessionHash = hashSessionToken(token);
    const result = await this.database.query<{
      member_id: string;
      trip_id: string;
      email: string;
      display_name: string;
      role: "owner" | "participant";
    }>(
      `
        select
          trip_members.id as member_id,
          trip_members.trip_id,
          trip_members.email,
          trip_members.display_name,
          trip_members.role
        from guest_sessions
        join trip_members on trip_members.id = guest_sessions.trip_member_id
        join trips on trips.id = trip_members.trip_id
        where guest_sessions.session_hash = $1
          and guest_sessions.revoked_at is null
          and trip_members.status = 'active'
          and trips.status = 'active'
        limit 1
      `,
      [sessionHash]
    );
    const actor = result.rows[0];

    if (!actor) {
      return null;
    }

    await this.database.query(
      "update guest_sessions set last_seen_at = now() where session_hash = $1",
      [sessionHash]
    );

    return {
      memberId: actor.member_id,
      tripId: actor.trip_id,
      email: actor.email,
      displayName: actor.display_name,
      role: actor.role
    };
  }

  private async findActiveInvite(inviteToken: string) {
    const result = await this.database.query<{ trip_id: string }>(
      `
        select trip_invites.trip_id
        from trip_invites
        join trips on trips.id = trip_invites.trip_id
        where trip_invites.token_hash = $1
          and trip_invites.status = 'active'
          and trips.status = 'active'
        limit 1
      `,
      [hashInviteToken(inviteToken)]
    );

    return result.rows[0] ?? null;
  }

  private async findActiveMemberByEmail(tripId: string, email: string) {
    const result = await this.database.query<{ id: string }>(
      `
        select id
        from trip_members
        where trip_id = $1
          and lower(email) = $2
          and status = 'active'
        limit 1
      `,
      [tripId, email]
    );

    return result.rows[0] ?? null;
  }
}
