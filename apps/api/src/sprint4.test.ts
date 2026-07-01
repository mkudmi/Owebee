import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { BalanceService } from "./calculation/balance-service.js";
import { addDecimals } from "./calculation/signed-decimal.js";
import { FakeCurrencyRateProvider } from "./currency/currency-service.js";
import type { Database } from "./database/database.js";
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
let database: PGlite;

async function registerOwner(app: App, email = "owner@example.com") {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    payload: { email, displayName: email.split("@")[0], locale: "ru" }
  });
  return response.json().sessionToken as string;
}

async function createTrip(app: App, token: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/trips",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "Sprint 4 Trip", baseCurrencyCode: "RUB" }
  });
  const member = await database.query<{ id: string }>(
    "select id from trip_members where trip_id = $1 and role = 'owner'",
    [response.json().trip.id]
  );
  return {
    tripId: response.json().trip.id as string,
    ownerMemberId: member.rows[0]!.id,
    inviteToken: String(response.json().inviteLink).split("/").at(-1)!
  };
}

async function joinGuest(
  app: App,
  inviteToken: string,
  email = "guest@example.com",
  displayName = "Guest"
) {
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/invites/${inviteToken}/join`,
    payload: {
      displayName,
      email,
      locale: "ru"
    }
  });
  return {
    token: response.json().guestSessionToken as string,
    memberId: response.json().memberId as string
  };
}

async function getBalance(app: App, tripId: string, token?: string) {
  return app.inject({
    method: "GET",
    url: `/api/v1/trips/${tripId}/balance`,
    headers: token ? { authorization: `Bearer ${token}` } : {}
  });
}

async function getBreakdown(
  app: App,
  tripId: string,
  targetType: string,
  targetId: string,
  token?: string,
  query = ""
) {
  return app.inject({
    method: "GET",
    url: `/api/v1/trips/${tripId}/balance/${targetType}/${targetId}${query}`,
    headers: token ? { authorization: `Bearer ${token}` } : {}
  });
}

function createSelectCounter(source: Database) {
  let queryCount = 0;
  const countedDatabase: Database = {
    async query(sql: string, params?: unknown[]) {
      if (/^\s*(?:select|with)\b/i.test(sql)) {
        queryCount += 1;
      }
      return source.query(sql, params);
    }
  };
  return {
    database: countedDatabase,
    get queryCount() {
      return queryCount;
    }
  };
}

describe("sprint 4 balance flow", () => {
  beforeEach(async () => {
    Object.assign(process.env, baseEnv);
    database = new PGlite();
    await applyMigrations(database, await loadMigrations(migrationsDir));
  });

  it("returns the same exact mixed member/family balance to owner and guest", async () => {
    const app = await buildApp({ database });
    const ownerToken = await registerOwner(app);
    const trip = await createTrip(app, ownerToken);
    const guest = await joinGuest(app, trip.inviteToken);
    const family = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${trip.tripId}/families`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { displayName: "Family", shareCount: "2" }
    });
    const expense = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${trip.tripId}/expenses`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        "idempotency-key": randomUUID()
      },
      payload: {
        payerMemberId: trip.ownerMemberId,
        amount: "120",
        currencyCode: "RUB",
        expenseDate: "2026-07-28",
        description: "Balance fixture",
        splitTargets: [
          { type: "member", id: guest.memberId },
          { type: "family", id: family.json().family.id }
        ]
      }
    });
    expect(expense.statusCode, expense.body).toBe(201);

    const ownerBalance = await getBalance(app, trip.tripId, ownerToken);
    const guestBalance = await getBalance(app, trip.tripId, guest.token);
    expect(ownerBalance.statusCode, ownerBalance.body).toBe(200);
    expect(guestBalance.statusCode, guestBalance.body).toBe(200);
    expect(guestBalance.json()).toEqual(ownerBalance.json());
    expect(ownerBalance.json()).toEqual({
      tripId: trip.tripId,
      baseCurrencyCode: "RUB",
      lines: [
        {
          targetType: "family",
          targetId: family.json().family.id,
          displayName: "Family",
          balance: "-80.00000000",
          shareCount: "2"
        },
        {
          targetType: "member",
          targetId: guest.memberId,
          displayName: "Guest",
          balance: "-40.00000000"
        },
        {
          targetType: "member",
          targetId: trip.ownerMemberId,
          displayName: "owner",
          balance: "120.00000000"
        }
      ]
    });
  });

  it("keeps archived balances readable and rejects unauthorized or inactive actors", async () => {
    const app = await buildApp({ database });
    const ownerToken = await registerOwner(app);
    const trip = await createTrip(app, ownerToken);
    const guest = await joinGuest(app, trip.inviteToken);
    const outsiderToken = await registerOwner(app, "outsider@example.com");

    expect((await getBalance(app, trip.tripId)).statusCode).toBe(401);
    const outsider = await getBalance(app, trip.tripId, outsiderToken);
    expect(outsider.statusCode).toBe(403);
    expect(outsider.json().error.code).toBe("balance.forbidden");
    expect(
      (
        await getBreakdown(
          app,
          trip.tripId,
          "member",
          trip.ownerMemberId
        )
      ).statusCode
    ).toBe(401);
    expect(
      (
        await getBreakdown(
          app,
          trip.tripId,
          "member",
          trip.ownerMemberId,
          outsiderToken
        )
      ).statusCode
    ).toBe(403);

    await database.query("update trips set status = 'archived' where id = $1", [
      trip.tripId
    ]);
    expect((await getBalance(app, trip.tripId, ownerToken)).statusCode).toBe(200);

    await database.query("update trip_members set status = 'archived' where id = $1", [
      guest.memberId
    ]);
    const inactiveGuest = await getBalance(app, trip.tripId, guest.token);
    expect(inactiveGuest.statusCode).toBe(403);
    expect(inactiveGuest.json().error.code).toBe("balance.forbidden");
    const inactiveTarget = await getBreakdown(
      app,
      trip.tripId,
      "member",
      guest.memberId,
      ownerToken
    );
    expect(inactiveTarget.statusCode).toBe(404);
    expect(inactiveTarget.json().error.code).toBe("balance.target_not_found");

    const malformedTrip = await getBalance(app, "not-a-uuid", ownerToken);
    expect(malformedTrip.statusCode).toBe(403);
    expect(malformedTrip.json().error.code).toBe("balance.forbidden");

    await database.query("update trips set status = 'deleted' where id = $1", [
      trip.tripId
    ]);
    expect((await getBalance(app, trip.tripId, ownerToken)).statusCode).toBe(403);
  });

  it("returns an empty balance using a bounded query count", async () => {
    const app = await buildApp({ database });
    const ownerToken = await registerOwner(app);
    const trip = await createTrip(app, ownerToken);
    const response = await getBalance(app, trip.tripId, ownerToken);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({
      tripId: trip.tripId,
      baseCurrencyCode: "RUB",
      lines: []
    });
    const owner = await database.query<{ user_id: string }>(
      "select user_id from trip_members where id = $1",
      [trip.ownerMemberId]
    );
    const counter = createSelectCounter(database);
    const service = new BalanceService(counter.database);
    await service.getBalance(trip.tripId, {
      type: "registered",
      userId: owner.rows[0]!.user_id
    });
    expect(counter.queryCount).toBe(3);
  });

  it("preserves historical lines for archived payers and targets", async () => {
    const app = await buildApp({ database });
    const ownerToken = await registerOwner(app);
    const trip = await createTrip(app, ownerToken);
    const archivedMember = await joinGuest(app, trip.inviteToken);
    const viewer = await joinGuest(
      app,
      trip.inviteToken,
      "viewer@example.com",
      "Viewer"
    );
    const family = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${trip.tripId}/families`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { displayName: "Archived Family", shareCount: "2" }
    });
    const familyId = family.json().family.id as string;
    const expense = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${trip.tripId}/expenses`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        "idempotency-key": randomUUID()
      },
      payload: {
        payerMemberId: trip.ownerMemberId,
        amount: "120",
        currencyCode: "RUB",
        expenseDate: "2026-07-28",
        description: "Historical fixture",
        splitTargets: [
          { type: "member", id: archivedMember.memberId },
          { type: "family", id: familyId }
        ]
      }
    });
    expect(expense.statusCode, expense.body).toBe(201);
    await database.query(
      "update trip_members set status = 'archived' where id = any($1::uuid[])",
      [[trip.ownerMemberId, archivedMember.memberId]]
    );
    await database.query("update families set status = 'archived' where id = $1", [
      familyId
    ]);

    const response = await getBalance(app, trip.tripId, viewer.token);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().lines).toEqual([
      {
        targetType: "family",
        targetId: familyId,
        displayName: "Archived Family",
        balance: "-80.00000000",
        shareCount: "2"
      },
      {
        targetType: "member",
        targetId: archivedMember.memberId,
        displayName: "Guest",
        balance: "-40.00000000"
      },
      {
        targetType: "member",
        targetId: trip.ownerMemberId,
        displayName: "owner",
        balance: "120.00000000"
      }
    ]);

    const archivedMemberBreakdown = await getBreakdown(
      app,
      trip.tripId,
      "member",
      archivedMember.memberId,
      viewer.token
    );
    expect(archivedMemberBreakdown.statusCode, archivedMemberBreakdown.body).toBe(
      200
    );
    expect(archivedMemberBreakdown.json()).toMatchObject({
      balance: "-40.00000000",
      items: [
        {
          contributionType: "allocated_share_debit",
          contribution: "-40.00000000"
        }
      ]
    });
    const archivedPayerBreakdown = await getBreakdown(
      app,
      trip.tripId,
      "member",
      trip.ownerMemberId,
      viewer.token
    );
    expect(archivedPayerBreakdown.statusCode, archivedPayerBreakdown.body).toBe(
      200
    );
    expect(archivedPayerBreakdown.json()).toMatchObject({
      balance: "120.00000000",
      items: [
        {
          contributionType: "payer_credit",
          contribution: "120.00000000"
        }
      ]
    });
    const archivedFamilyBreakdown = await getBreakdown(
      app,
      trip.tripId,
      "family",
      familyId,
      viewer.token
    );
    expect(archivedFamilyBreakdown.statusCode, archivedFamilyBreakdown.body).toBe(
      200
    );
    expect(archivedFamilyBreakdown.json()).toMatchObject({
      balance: "-80.00000000",
      shareCount: "2",
      items: [
        {
          contributionType: "allocated_share_debit",
          contribution: "-80.00000000",
          snapshottedShareCount: "2"
        }
      ]
    });
    const emptyViewerBreakdown = await getBreakdown(
      app,
      trip.tripId,
      "member",
      viewer.memberId,
      viewer.token
    );
    expect(emptyViewerBreakdown.statusCode, emptyViewerBreakdown.body).toBe(200);
    expect(emptyViewerBreakdown.json()).toMatchObject({
      balance: "0.00000000",
      items: [],
      nextCursor: null
    });
  });

  it("uses the persisted converted amount for cross-currency balance", async () => {
    const app = await buildApp({
      database,
      currencyRateProvider: new FakeCurrencyRateProvider(
        new Map([["EUR:RUB:2026-07-28", "90.125"]])
      )
    });
    const ownerToken = await registerOwner(app);
    const trip = await createTrip(app, ownerToken);
    const guest = await joinGuest(app, trip.inviteToken);
    const expense = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${trip.tripId}/expenses`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        "idempotency-key": randomUUID()
      },
      payload: {
        payerMemberId: guest.memberId,
        amount: "2",
        currencyCode: "EUR",
        expenseDate: "2026-07-28",
        description: "Cross currency",
        splitTargets: [{ type: "member", id: trip.ownerMemberId }]
      }
    });
    expect(expense.json().expense.convertedAmount).toBe("180.25");

    const response = await getBalance(app, trip.tripId, ownerToken);
    expect(response.json().lines).toEqual([
      {
        targetType: "member",
        targetId: guest.memberId,
        displayName: "Guest",
        balance: "180.25000000"
      },
      {
        targetType: "member",
        targetId: trip.ownerMemberId,
        displayName: "owner",
        balance: "-180.25000000"
      }
    ]);
  });

  it("calculates 20 participants and 300 expenses under 500 ms with three service queries", async () => {
    const app = await buildApp({ database });
    const ownerToken = await registerOwner(app);
    const trip = await createTrip(app, ownerToken);
    const owner = await database.query<{ user_id: string }>(
      "select user_id from trip_members where id = $1",
      [trip.ownerMemberId]
    );
    const additionalMemberIds = Array.from({ length: 19 }, () => randomUUID());
    await database.query(
      `insert into trip_members (id, trip_id, display_name)
       select id, $1, 'Member ' || ordinality
       from unnest($2::uuid[]) with ordinality as members(id, ordinality)`,
      [trip.tripId, additionalMemberIds]
    );
    const memberIds = [trip.ownerMemberId, ...additionalMemberIds];
    await database.query(
      `insert into expenses (
         id, trip_id, created_by_member_id, payer_member_id, description,
         expense_date, original_amount, original_currency_code,
         base_currency_code, converted_amount
       )
       select
         md5('benchmark-expense-' || expense_number)::uuid,
         $1,
         $2,
         ($3::uuid[])[((expense_number - 1) % 20) + 1],
         'Benchmark ' || expense_number,
         date '2026-07-28',
         100,
         'RUB',
         'RUB',
         100
       from generate_series(1, 300) as expense_number`,
      [trip.tripId, trip.ownerMemberId, memberIds]
    );
    await database.query(
      `insert into expense_splits (
         id, expense_id, target_type, target_member_id, share_count
       )
       select
         md5('benchmark-split-' || expense_number || '-' || member_number)::uuid,
         md5('benchmark-expense-' || expense_number)::uuid,
         'member',
         member_id,
         1
       from generate_series(1, 300) as expense_number
       cross join unnest($1::uuid[]) with ordinality
         as members(member_id, member_number)`,
      [memberIds]
    );
    const counter = createSelectCounter(database);
    const service = new BalanceService(counter.database);
    const start = performance.now();
    const result = await service.getBalance(trip.tripId, {
      type: "registered",
      userId: owner.rows[0]!.user_id
    });
    const duration = performance.now() - start;

    expect(result.lines).toHaveLength(20);
    expect(counter.queryCount).toBe(3);
    expect(duration).toBeLessThan(500);
  });

  it("paginates family contributions and preserves historical share snapshots", async () => {
    const app = await buildApp({ database });
    const ownerToken = await registerOwner(app);
    const trip = await createTrip(app, ownerToken);
    const family = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${trip.tripId}/families`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { displayName: "Family", shareCount: "2" }
    });
    const familyId = family.json().family.id as string;
    const expenseSnapshots = new Map<
      string,
      { amount: string; shareCount: string }
    >();
    for (const [amount, shareCount] of [
      ["100", "2"],
      ["50", "3"]
    ]) {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/trips/${trip.tripId}/expenses`,
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "idempotency-key": randomUUID()
        },
        payload: {
          payerMemberId: trip.ownerMemberId,
          amount,
          currencyCode: "RUB",
          expenseDate: "2026-07-28",
          description: `Family ${amount}`,
          splitTargets: [{ type: "family", id: familyId }]
        }
      });
      expect(response.statusCode).toBe(201);
      expenseSnapshots.set(response.json().expense.id, {
        amount,
        shareCount
      });
      if (amount === "100") {
        await database.query("update families set share_count = 3 where id = $1", [
          familyId
        ]);
      }
    }
    await database.query(
      `update expenses
       set created_at = '2026-07-28T12:00:00Z'
       where id = any($1::uuid[])`,
      [[...expenseSnapshots.keys()]]
    );
    const orderedExpenseIds = [...expenseSnapshots.keys()].sort().reverse();

    const first = await getBreakdown(
      app,
      trip.tripId,
      "family",
      familyId,
      ownerToken,
      "?limit=1"
    );
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json()).toMatchObject({
      targetType: "family",
      targetId: familyId,
      displayName: "Family",
      balance: "-150.00000000",
      shareCount: "3",
      items: [
        {
          contributionType: "allocated_share_debit",
          expenseDate: "2026-07-28",
          originalAmount: expenseSnapshots.get(orderedExpenseIds[0]!)!.amount,
          originalCurrencyCode: "RUB",
          convertedAmount: expenseSnapshots.get(orderedExpenseIds[0]!)!.amount,
          baseCurrencyCode: "RUB",
          contribution: `-${expenseSnapshots.get(orderedExpenseIds[0]!)!.amount}.00000000`,
          snapshottedShareCount:
            expenseSnapshots.get(orderedExpenseIds[0]!)!.shareCount,
          rateSnapshot: { rate: "1", source: "same_currency" }
        }
      ]
    });
    expect(first.json().nextCursor).toEqual(expect.any(String));
    const second = await getBreakdown(
      app,
      trip.tripId,
      "family",
      familyId,
      ownerToken,
      `?limit=1&cursor=${first.json().nextCursor}`
    );
    expect(second.json().items).toHaveLength(1);
    expect(second.json().items[0].expenseId).toBe(orderedExpenseIds[1]);
    expect(second.json().items[0].snapshottedShareCount).toBe(
      expenseSnapshots.get(orderedExpenseIds[1]!)!.shareCount
    );
    expect(second.json().nextCursor).toBeNull();
    expect(
      new Set([
        first.json().items[0].expenseId,
        second.json().items[0].expenseId
      ]).size
    ).toBe(2);
    expect(
      [...first.json().items, ...second.json().items].reduce(
        (sum: string, item: { contribution: string }) =>
          addDecimals(sum, item.contribution),
        "0"
      )
    ).toBe(first.json().balance);

    const summary = await getBalance(app, trip.tripId, ownerToken);
    expect(
      summary
        .json()
        .lines.find((line: { targetId: string }) => line.targetId === familyId)
        .balance
    ).toBe(first.json().balance);
  });

  it("returns immutable cross-currency credit details and structured target errors", async () => {
    const app = await buildApp({
      database,
      currencyRateProvider: new FakeCurrencyRateProvider(
        new Map([["EUR:RUB:2026-07-28", "90.125"]])
      )
    });
    const ownerToken = await registerOwner(app);
    const trip = await createTrip(app, ownerToken);
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${trip.tripId}/expenses`,
      headers: {
        authorization: `Bearer ${ownerToken}`,
        "idempotency-key": randomUUID()
      },
      payload: {
        payerMemberId: trip.ownerMemberId,
        amount: "2",
        currencyCode: "EUR",
        expenseDate: "2026-07-28",
        description: "Rail",
        splitTargets: [{ type: "member", id: trip.ownerMemberId }]
      }
    });
    expect(response.statusCode).toBe(201);
    const breakdown = await getBreakdown(
      app,
      trip.tripId,
      "member",
      trip.ownerMemberId,
      ownerToken
    );
    expect(breakdown.statusCode, breakdown.body).toBe(200);
    expect(breakdown.json().balance).toBe("0.00000000");
    expect(
      breakdown.json().items.map(
        (item: { contributionType: string }) => item.contributionType
      )
    ).toEqual(["allocated_share_debit", "payer_credit"]);
    expect(breakdown.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contributionType: "payer_credit",
          contribution: "180.25000000",
          rateSnapshot: {
            rate: "90.125",
            rateDate: "2026-07-28",
            source: "fake",
            isManual: false
          }
        }),
        expect.objectContaining({
          contributionType: "allocated_share_debit",
          contribution: "-180.25000000"
        })
      ])
    );

    expect(
      (
        await getBreakdown(
          app,
          trip.tripId,
          "invalid",
          trip.ownerMemberId,
          ownerToken
        )
      ).statusCode
    ).toBe(400);
    expect(
      (
        await getBreakdown(
          app,
          trip.tripId,
          "member",
          "not-a-uuid",
          ownerToken
        )
      ).statusCode
    ).toBe(400);
    const invalidCursor = await getBreakdown(
      app,
      trip.tripId,
      "member",
      trip.ownerMemberId,
      ownerToken,
      "?cursor=not-a-cursor"
    );
    expect(invalidCursor.statusCode).toBe(400);
    expect(invalidCursor.json().error.code).toBe("balance.invalid_cursor");
    for (const query of [
      "?cursor=",
      "?limit=01",
      "?limit=1e2",
      "?limit=0x10",
      "?limit=101"
    ]) {
      const invalid = await getBreakdown(
        app,
        trip.tripId,
        "member",
        trip.ownerMemberId,
        ownerToken,
        query
      );
      expect(invalid.statusCode, `${query}: ${invalid.body}`).toBe(400);
    }
    const malformedPayload = Buffer.from(
      JSON.stringify({
        expenseDate: "2026-07-28",
        createdAt: "not-a-timestamp",
        expenseId: response.json().expense.id,
        contributionType: "payer_credit",
        unsupported: true
      })
    ).toString("base64url");
    const malformedPayloadResponse = await getBreakdown(
      app,
      trip.tripId,
      "member",
      trip.ownerMemberId,
      ownerToken,
      `?cursor=${malformedPayload}`
    );
    expect(malformedPayloadResponse.statusCode).toBe(400);
    expect(malformedPayloadResponse.json().error.code).toBe(
      "balance.invalid_cursor"
    );

    const otherToken = await registerOwner(app, "foreign@example.com");
    const otherTrip = await createTrip(app, otherToken);
    const foreign = await getBreakdown(
      app,
      trip.tripId,
      "member",
      otherTrip.ownerMemberId,
      ownerToken
    );
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json().error.code).toBe("balance.target_not_found");
  });
});
