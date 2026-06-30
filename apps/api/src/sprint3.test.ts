import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import {
  CurrencyProviderUnavailableError,
  FakeCurrencyRateProvider
} from "./currency/currency-service.js";
import { applyMigrations, loadMigrations } from "./database/migrations.js";

const migrationsDir = `${process.cwd()}/migrations`;
const baseEnv = {
  NODE_ENV: "test",
  API_HOST: "127.0.0.1",
  API_PORT: "4000",
  WEB_BASE_URL: "http://localhost:5173",
  DATABASE_URL: "postgres://user:pass@localhost:5432/owebee",
  REDIS_URL: "redis://localhost:6379"
};

type App = Awaited<ReturnType<typeof buildApp>>;

async function registerOwner(app: App, email = "owner@example.com") {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email, displayName: "Owner", locale: "ru" }
  });
  return response.json().sessionToken as string;
}

async function createTrip(app: App, token: string, name = "Sprint 3 Trip") {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/trips",
    headers: { authorization: `Bearer ${token}` },
    payload: { name, baseCurrencyCode: "RUB" }
  });
  expect(response.statusCode).toBe(201);
  const body = response.json();
  const members = await database.query<{ id: string }>(
    "select id from trip_members where trip_id = $1 and role = 'owner'",
    [body.trip.id]
  );
  return {
    tripId: body.trip.id as string,
    ownerMemberId: members.rows[0]!.id,
    inviteToken: String(body.inviteLink).split("/").at(-1)!
  };
}

async function joinGuest(app: App, inviteToken: string) {
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/invites/${inviteToken}/join`,
    payload: { displayName: "Guest", email: "guest@example.com", locale: "ru" }
  });
  expect(response.statusCode).toBe(201);
  return {
    token: response.json().guestSessionToken as string,
    memberId: response.json().memberId as string
  };
}

function expensePayload(
  payerMemberId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    payerMemberId,
    amount: "100.00",
    currencyCode: "RUB",
    expenseDate: "2026-07-18",
    description: "Dinner",
    splitTargets: [{ type: "member", id: payerMemberId }],
    ...overrides
  };
}

async function createExpense(
  app: App,
  tripId: string,
  token: string,
  payload: Record<string, unknown>,
  key = randomUUID()
) {
  return app.inject({
    method: "POST",
    url: `/api/v1/trips/${tripId}/expenses`,
    headers: {
      authorization: `Bearer ${token}`,
      "idempotency-key": key
    },
    payload
  });
}

let database: PGlite;

describe("sprint 3 expense flows", () => {
  beforeEach(async () => {
    Object.assign(process.env, baseEnv);
    database = new PGlite();
    await applyMigrations(database, await loadMigrations(migrationsDir));
  });

  it("atomically creates a base-currency expense with member and family splits", async () => {
    const app = await buildApp({ database });
    const ownerToken = await registerOwner(app);
    const trip = await createTrip(app, ownerToken);
    const family = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${trip.tripId}/families`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { displayName: "Family", shareCount: "2.50" }
    });
    const response = await createExpense(
      app,
      trip.tripId,
      ownerToken,
      expensePayload(trip.ownerMemberId, {
        amount: "1250.7500",
        splitTargets: [
          { type: "member", id: trip.ownerMemberId },
          { type: "family", id: family.json().family.id }
        ]
      })
    );

    expect(response.statusCode).toBe(201);
    expect(response.json().expense).toMatchObject({
      originalAmount: "1250.7500",
      convertedAmount: "1250.75",
      rate: "1",
      rateSource: "same_currency"
    });
    const counts = await database.query<{
      expenses: number;
      splits: number;
      snapshots: number;
      keys: number;
      audits: number;
    }>(`select
      (select count(*)::int from expenses) expenses,
      (select count(*)::int from expense_splits) splits,
      (select count(*)::int from currency_rate_snapshots) snapshots,
      (select count(*)::int from expense_idempotency_keys) keys,
      (select count(*)::int from audit_events where event_type = 'expense.created') audits`);
    expect(counts.rows[0]).toEqual({
      expenses: 1,
      splits: 2,
      snapshots: 1,
      keys: 1,
      audits: 1
    });
  });

  it("supports guest creation, replay, conflict, and rejects foreign targets", async () => {
    const app = await buildApp({ database });
    const ownerToken = await registerOwner(app);
    const trip = await createTrip(app, ownerToken);
    const guest = await joinGuest(app, trip.inviteToken);
    const key = randomUUID();
    const payload = expensePayload(trip.ownerMemberId, {
      splitTargets: [{ type: "member", id: guest.memberId }]
    });

    expect((await createExpense(app, trip.tripId, guest.token, payload, key)).statusCode)
      .toBe(201);
    expect((await createExpense(app, trip.tripId, guest.token, payload, key)).statusCode)
      .toBe(200);
    const conflict = await createExpense(
      app,
      trip.tripId,
      guest.token,
      { ...payload, description: "Changed" },
      key
    );
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe("expenses.idempotency_conflict");

    const otherOwner = await registerOwner(app, "other@example.com");
    const otherTrip = await createTrip(app, otherOwner, "Other Trip");
    const foreign = await createExpense(
      app,
      trip.tripId,
      ownerToken,
      expensePayload(trip.ownerMemberId, {
        splitTargets: [{ type: "member", id: otherTrip.ownerMemberId }]
      })
    );
    expect(foreign.statusCode).toBe(400);
    expect(foreign.json().error.code).toBe("expenses.invalid_participant");
    expect((await database.query("select id from expenses")).rows).toHaveLength(1);
  });

  it("persists an immutable cross-currency snapshot and exact conversion", async () => {
    const rates = new Map([["EUR:RUB:2026-07-18", "90.1250"]]);
    const app = await buildApp({
      database,
      currencyRateProvider: new FakeCurrencyRateProvider(rates)
    });
    const ownerToken = await registerOwner(app);
    const trip = await createTrip(app, ownerToken);
    const key = randomUUID();
    const response = await createExpense(
      app,
      trip.tripId,
      ownerToken,
      expensePayload(trip.ownerMemberId, { currencyCode: "EUR" }),
      key
    );

    expect(response.statusCode).toBe(201);
    expect(response.json().expense).toMatchObject({
      originalAmount: "100.00",
      convertedAmount: "9012.5",
      rate: "90.1250",
      rateSource: "fake",
      isManualRate: false
    });
    rates.set("EUR:RUB:2026-07-18", "100");
    const replay = await createExpense(
      app,
      trip.tripId,
      ownerToken,
      expensePayload(trip.ownerMemberId, { currencyCode: "EUR" }),
      key
    );
    expect(replay.json().expense.convertedAmount).toBe("9012.5");
    expect(replay.json().expense.rate).toBe("90.1250");
  });

  it("leaves no expense data when provider resolution fails", async () => {
    const app = await buildApp({
      database,
      currencyRateProvider: {
        name: "offline",
        getHistoricalRate: async () => {
          throw new CurrencyProviderUnavailableError("offline");
        }
      }
    });
    const ownerToken = await registerOwner(app);
    const trip = await createTrip(app, ownerToken);
    const response = await createExpense(
      app,
      trip.tripId,
      ownerToken,
      expensePayload(trip.ownerMemberId, { currencyCode: "EUR" })
    );

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("expenses.manual_rate_required");
    expect((await database.query("select id from expenses")).rows).toHaveLength(0);
    expect((await database.query("select id from expense_idempotency_keys")).rows)
      .toHaveLength(0);
  });

  it("lists persisted expenses for owner and guest with deterministic pagination", async () => {
    const app = await buildApp({ database });
    const ownerToken = await registerOwner(app);
    const trip = await createTrip(app, ownerToken);
    const guest = await joinGuest(app, trip.inviteToken);
    for (const [date, description] of [
      ["2026-07-18", "Latest"],
      ["2026-07-17", "Middle"],
      ["2026-07-16", "Oldest"]
    ]) {
      const response = await createExpense(
        app,
        trip.tripId,
        ownerToken,
        expensePayload(trip.ownerMemberId, { expenseDate: date, description })
      );
      expect(response.statusCode).toBe(201);
    }

    const first = await app.inject({
      method: "GET",
      url: `/api/v1/trips/${trip.tripId}/expenses?limit=2`,
      headers: { authorization: `Bearer ${guest.token}` }
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().items.map((item: { description: string }) => item.description))
      .toEqual(["Latest", "Middle"]);
    expect(first.json().items[0]).toMatchObject({
      payer: { displayName: "Owner" },
      creator: { displayName: "Owner" },
      rateSnapshot: { source: "same_currency" }
    });
    const second = await app.inject({
      method: "GET",
      url: `/api/v1/trips/${trip.tripId}/expenses?limit=2&cursor=${first.json().nextCursor}`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    expect(second.statusCode, second.body).toBe(200);
    expect(second.json().items.map((item: { description: string }) => item.description))
      .toEqual(["Oldest"]);
    expect(second.json().nextCursor).toBeNull();

    await database.query("update trips set status = 'archived' where id = $1", [
      trip.tripId
    ]);
    const archived = await app.inject({
      method: "GET",
      url: `/api/v1/trips/${trip.tripId}/expenses`,
      headers: { authorization: `Bearer ${guest.token}` }
    });
    expect(archived.statusCode).toBe(200);

    const invalidCursor = await app.inject({
      method: "GET",
      url: `/api/v1/trips/${trip.tripId}/expenses?cursor=not-a-cursor`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    expect(invalidCursor.statusCode).toBe(400);
    expect(invalidCursor.json().error.code).toBe("expenses.invalid_cursor");

    const outsiderToken = await registerOwner(app, "outsider@example.com");
    const outsider = await app.inject({
      method: "GET",
      url: `/api/v1/trips/${trip.tripId}/expenses`,
      headers: { authorization: `Bearer ${outsiderToken}` }
    });
    expect(outsider.statusCode).toBe(403);

    await database.query("update trips set status = 'deleted' where id = $1", [
      trip.tripId
    ]);
    const deleted = await app.inject({
      method: "GET",
      url: `/api/v1/trips/${trip.tripId}/expenses`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    expect(deleted.statusCode).toBe(403);
  });
});
