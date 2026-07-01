import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { applyMigrations, loadMigrations } from "../database/migrations.js";
import {
  AllocationLoadError,
  loadAcceptedExpenseAllocations
} from "./allocation-loader.js";

const migrationsDir = `${process.cwd()}/migrations`;
const baseEnv = {
  NODE_ENV: "test",
  API_HOST: "127.0.0.1",
  API_PORT: "4000",
  WEB_BASE_URL: "http://localhost:5173",
  DATABASE_URL: "postgres://user:pass@localhost:5432/owebee",
  REDIS_URL: "redis://localhost:6379"
};

let database: PGlite;

describe("loadAcceptedExpenseAllocations", () => {
  beforeEach(async () => {
    Object.assign(process.env, baseEnv);
    database = new PGlite();
    await applyMigrations(database, await loadMigrations(migrationsDir));
  });

  it("uses persisted amounts and split snapshots for archived trips and excludes deleted expenses", async () => {
    const app = await buildApp({ database });
    const registration = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "owner@example.com",
        displayName: "Owner",
        locale: "ru"
      }
    });
    const token = registration.json().sessionToken as string;
    const tripResponse = await app.inject({
      method: "POST",
      url: "/api/v1/trips",
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Allocation Trip", baseCurrencyCode: "RUB" }
    });
    const tripId = tripResponse.json().trip.id as string;
    const owner = await database.query<{ id: string }>(
      "select id from trip_members where trip_id = $1",
      [tripId]
    );
    const familyResponse = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${tripId}/families`,
      headers: { authorization: `Bearer ${token}` },
      payload: { displayName: "Family", shareCount: "2" }
    });
    const familyId = familyResponse.json().family.id as string;
    const expenseResponse = await app.inject({
      method: "POST",
      url: `/api/v1/trips/${tripId}/expenses`,
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": randomUUID()
      },
      payload: {
        payerMemberId: owner.rows[0]!.id,
        amount: "120",
        currencyCode: "RUB",
        expenseDate: "2026-07-28",
        description: "Manual fixture",
        splitTargets: [
          { type: "member", id: owner.rows[0]!.id },
          { type: "family", id: familyId }
        ]
      }
    });
    expect(expenseResponse.statusCode, expenseResponse.body).toBe(201);

    await database.query("update families set share_count = 9 where id = $1", [
      familyId
    ]);
    await database.query("update trips set status = 'archived' where id = $1", [
      tripId
    ]);
    await database.query(
      "update expenses set converted_amount = 90 where id = $1",
      [expenseResponse.json().expense.id]
    );

    const loaded = await loadAcceptedExpenseAllocations(database, tripId);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      expenseId: expenseResponse.json().expense.id,
      convertedAmount: "90",
      allocations: [
        {
          targetType: "family",
          targetId: familyId,
          snapshottedShareCount: "2",
          allocatedAmount: "60.00000000"
        },
        {
          targetType: "member",
          targetId: owner.rows[0]!.id,
          snapshottedShareCount: "1.0000",
          allocatedAmount: "30.00000000"
        }
      ]
    });

    await database.query("update expenses set status = 'deleted'");
    expect(await loadAcceptedExpenseAllocations(database, tripId)).toEqual([]);

    await database.query(
      "update expenses set status = 'accepted' where id = $1",
      [expenseResponse.json().expense.id]
    );
    await database.query(
      "delete from expense_splits where expense_id = $1",
      [expenseResponse.json().expense.id]
    );
    await expect(
      loadAcceptedExpenseAllocations(database, tripId)
    ).rejects.toThrow(AllocationLoadError);
  });

  it("rejects split targets from another trip", async () => {
    const app = await buildApp({ database });
    const registration = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "cross-trip@example.com",
        displayName: "Owner",
        locale: "ru"
      }
    });
    const token = registration.json().sessionToken as string;
    const createTrip = async (name: string) =>
      app.inject({
        method: "POST",
        url: "/api/v1/trips",
        headers: { authorization: `Bearer ${token}` },
        payload: { name, baseCurrencyCode: "RUB" }
      });
    const firstTrip = await createTrip("First");
    const secondTrip = await createTrip("Second");
    const firstTripId = firstTrip.json().trip.id as string;
    const secondTripId = secondTrip.json().trip.id as string;
    const firstOwner = await database.query<{ id: string }>(
      "select id from trip_members where trip_id = $1",
      [firstTripId]
    );
    const secondOwner = await database.query<{ id: string }>(
      "select id from trip_members where trip_id = $1",
      [secondTripId]
    );
    const expenseId = randomUUID();
    await database.query(
      `insert into expenses (
         id, trip_id, created_by_member_id, payer_member_id, description,
         expense_date, original_amount, original_currency_code,
         base_currency_code, converted_amount
       ) values ($1, $2, $3, $3, 'Cross-trip fixture', '2026-07-28',
         10, 'RUB', 'RUB', 10)`,
      [expenseId, firstTripId, firstOwner.rows[0]!.id]
    );
    await database.query(
      `insert into expense_splits (
         id, expense_id, target_type, target_member_id, share_count
       ) values ($1, $2, 'member', $3, 1)`,
      [randomUUID(), expenseId, secondOwner.rows[0]!.id]
    );

    await expect(
      loadAcceptedExpenseAllocations(database, firstTripId)
    ).rejects.toThrow(AllocationLoadError);
  });
});
