import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { applyMigrations, loadMigrations } from "./database/migrations.js";
import type { DependencyChecker } from "./dependencies.js";

const migrationsDir = `${process.cwd()}/migrations`;
const baseEnv = {
  NODE_ENV: "test",
  API_HOST: "127.0.0.1",
  API_PORT: "4000",
  WEB_BASE_URL: "http://localhost:5173",
  DATABASE_URL: "postgres://user:pass@localhost:5432/owebee",
  REDIS_URL: "redis://localhost:6379"
};

function setTestEnv() {
  Object.assign(process.env, baseEnv);
}

function createDependencyChecker(): DependencyChecker {
  return {
    checkPostgres: async () => ({ name: "postgres", ok: true }),
    checkRedis: async () => ({ name: "redis", ok: true })
  };
}

async function createTestApp(database: PGlite) {
  return buildApp({
    database,
    dependencyChecker: createDependencyChecker()
  });
}

async function registerOwner(app: Awaited<ReturnType<typeof buildApp>>) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: {
      email: "owner@example.com",
      displayName: "Owner",
      locale: "ru"
    }
  });

  return response.json().sessionToken as string;
}

async function createTrip(
  app: Awaited<ReturnType<typeof buildApp>>,
  sessionToken: string,
  name = "Georgia Trip"
) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/trips",
    headers: { authorization: `Bearer ${sessionToken}` },
    payload: {
      name,
      baseCurrencyCode: "rub"
    }
  });

  expect(response.statusCode).toBe(201);
  return response.json() as {
    trip: { id: string; baseCurrencyCode: string };
    inviteLink: string;
  };
}

function extractInviteToken(inviteLink: string): string {
  return inviteLink.split("/").at(-1) ?? "";
}

describe("sprint 2 API flows", () => {
  let database: PGlite;

  beforeEach(async () => {
    setTestEnv();
    database = new PGlite();
    await applyMigrations(database, await loadMigrations(migrationsDir));
  });

  it("seeds and exposes active currencies sorted predictably", async () => {
    const app = await createTestApp(database);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/currencies"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().currencies.slice(0, 5)).toEqual([
      expect.objectContaining({ code: "EUR", minorUnits: 2 }),
      expect.objectContaining({ code: "USD", minorUnits: 2 }),
      expect.objectContaining({ code: "RUB", minorUnits: 2 }),
      expect.objectContaining({ code: "GBP", minorUnits: 2 }),
      expect.objectContaining({ code: "CHF", minorUnits: 2 })
    ]);
  });

  it("creates a trip, owner member and hashed invite token for an owner", async () => {
    const app = await createTestApp(database);
    const sessionToken = await registerOwner(app);

    const created = await createTrip(app, sessionToken);

    expect(created.trip).toMatchObject({
      baseCurrencyCode: "RUB"
    });
    expect(created.inviteLink).toMatch(/^http:\/\/localhost:5173\/t\/.+/);

    const members = await database.query<{ role: string; email: string }>(
      "select role, email from trip_members where trip_id = $1",
      [created.trip.id]
    );
    expect(members.rows).toEqual([{ role: "owner", email: "owner@example.com" }]);

    const inviteToken = extractInviteToken(created.inviteLink);
    const invites = await database.query<{ token_hash: string }>(
      "select token_hash from trip_invites where trip_id = $1",
      [created.trip.id]
    );
    expect(invites.rows[0]?.token_hash).not.toBe(inviteToken);
  });

  it("rejects unauthenticated, unsupported currency and duplicate trip creation", async () => {
    const app = await createTestApp(database);
    const sessionToken = await registerOwner(app);

    const unauthorized = await app.inject({
      method: "POST",
      url: "/api/v1/trips",
      payload: { name: "Trip", baseCurrencyCode: "RUB" }
    });
    expect(unauthorized.statusCode).toBe(401);

    const unsupported = await app.inject({
      method: "POST",
      url: "/api/v1/trips",
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: { name: "Trip", baseCurrencyCode: "xxx" }
    });
    expect(unsupported.statusCode).toBe(400);
    expect(unsupported.json().error.code).toBe("currency.unsupported_code");

    await createTrip(app, sessionToken, "Trip");
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/v1/trips",
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: { name: "Trip", baseCurrencyCode: "RUB" }
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it("joins a guest by invite and stores only the guest session hash", async () => {
    const app = await createTestApp(database);
    const sessionToken = await registerOwner(app);
    const created = await createTrip(app, sessionToken);
    const inviteToken = extractInviteToken(created.inviteLink);

    const joined = await app.inject({
      method: "POST",
      url: `/api/v1/invites/${inviteToken}/join`,
      payload: {
        displayName: "Alex",
        email: "alex@example.com",
        locale: "ru"
      }
    });

    expect(joined.statusCode).toBe(201);
    expect(joined.json()).toMatchObject({
      tripId: created.trip.id,
      role: "participant"
    });
    expect(joined.json().guestSessionToken).toEqual(expect.any(String));

    const guestSessionToken = joined.json().guestSessionToken as string;
    const sessions = await database.query<{ session_hash: string }>(
      "select session_hash from guest_sessions"
    );
    expect(sessions.rows[0]?.session_hash).not.toBe(guestSessionToken);
  });

  it("rejects invalid invites and returns recovery-required for duplicate guest email", async () => {
    const app = await createTestApp(database);
    const sessionToken = await registerOwner(app);
    const created = await createTrip(app, sessionToken);
    const inviteToken = extractInviteToken(created.inviteLink);
    const payload = {
      displayName: "Alex",
      email: "alex@example.com",
      locale: "ru"
    };

    const invalid = await app.inject({
      method: "POST",
      url: "/api/v1/invites/not-a-real-token/join",
      payload
    });
    expect(invalid.statusCode).toBe(404);

    await app.inject({
      method: "POST",
      url: `/api/v1/invites/${inviteToken}/join`,
      payload
    });
    const duplicate = await app.inject({
      method: "POST",
      url: `/api/v1/invites/${inviteToken}/join`,
      payload: { ...payload, displayName: "Alex Again" }
    });

    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error).toMatchObject({
      code: "invites.recovery_required",
      recoveryRequired: true
    });
  });

  it("allows owner to create family and exposes it in participants listing", async () => {
    const app = await createTestApp(database);
    const sessionToken = await registerOwner(app);
    const created = await createTrip(app, sessionToken);

    const family = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${created.trip.id}/families`,
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: {
        displayName: "Ivanov family",
        shareCount: "2.5"
      }
    });

    expect(family.statusCode).toBe(201);
    expect(family.json().family).toMatchObject({
      displayName: "Ivanov family",
      shareCount: "2.5",
      status: "active"
    });

    const participants = await app.inject({
      method: "GET",
      url: `/api/v1/trips/${created.trip.id}/participants`,
      headers: { authorization: `Bearer ${sessionToken}` }
    });
    expect(participants.statusCode).toBe(200);
    expect(participants.json().families).toEqual([
      expect.objectContaining({ displayName: "Ivanov family", shareCount: "2.5" })
    ]);
  });

  it("rejects guest family creation, invalid shares, inactive trips and duplicates", async () => {
    const app = await createTestApp(database);
    const sessionToken = await registerOwner(app);
    const created = await createTrip(app, sessionToken);
    const inviteToken = extractInviteToken(created.inviteLink);
    const joined = await app.inject({
      method: "POST",
      url: `/api/v1/invites/${inviteToken}/join`,
      payload: {
        displayName: "Alex",
        email: "alex@example.com",
        locale: "ru"
      }
    });
    const guestSessionToken = joined.json().guestSessionToken as string;

    const guestCreate = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${created.trip.id}/families`,
      headers: { authorization: `Bearer ${guestSessionToken}` },
      payload: { displayName: "Guest family", shareCount: "1" }
    });
    expect(guestCreate.statusCode).toBe(403);

    const invalidShare = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${created.trip.id}/families`,
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: { displayName: "Bad family", shareCount: "0" }
    });
    expect(invalidShare.statusCode).toBe(400);

    await app.inject({
      method: "POST",
      url: `/api/v1/trips/${created.trip.id}/families`,
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: { displayName: "Duplicate family", shareCount: "1" }
    });
    const duplicate = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${created.trip.id}/families`,
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: { displayName: "Duplicate family", shareCount: "2" }
    });
    expect(duplicate.statusCode).toBe(409);

    await database.query("update trips set status = 'archived' where id = $1", [
      created.trip.id
    ]);
    const archived = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${created.trip.id}/families`,
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: { displayName: "Late family", shareCount: "1" }
    });
    expect(archived.statusCode).toBe(409);
    expect(archived.json().error.code).toBe("trips.not_active");
  });
});
