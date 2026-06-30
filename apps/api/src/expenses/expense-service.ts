import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { TripActor } from "../auth/trip-actor.js";
import {
  CurrencyProviderUnavailableError,
  InvalidCurrencyProviderResponseError,
  type CurrencyService
} from "../currency/currency-service.js";
import { runInTransaction, type Database } from "../database/database.js";
import { isUniqueConstraintError } from "../trips/trip-service.js";
import { isPositiveDecimal, multiplyDecimals } from "./decimal.js";

const splitTargetSchema = z.object({
  type: z.enum(["member", "family"]),
  id: z.string().uuid()
});
const createExpenseSchema = z.object({
  payerMemberId: z.string().uuid(),
  amount: z.string().trim().refine((value) => isPositiveDecimal(value, 12)),
  currencyCode: z.string().trim(),
  expenseDate: z.string().date(),
  description: z.string().trim().min(1).max(500),
  splitTargets: z.array(splitTargetSchema).min(1)
});

export interface ExpenseDto {
  id: string;
  tripId: string;
  status: "accepted";
  payerMemberId: string;
  originalAmount: string;
  originalCurrencyCode: string;
  convertedAmount: string;
  baseCurrencyCode: string;
  rate: string;
  rateDate: string;
  rateSource: string;
  isManualRate: boolean;
  expenseDate: string;
  description: string;
  splitTargets: Array<{ type: "member" | "family"; id: string; shareCount: string }>;
}

export class ExpenseForbiddenError extends Error {}
export class ExpenseTripNotActiveError extends Error {}
export class InvalidExpenseParticipantError extends Error {}
export class DuplicateSplitTargetError extends Error {}
export class IdempotencyConflictError extends Error {}
export class ManualRateRequiredError extends Error {}
export class InvalidExpenseCursorError extends Error {}

type TripRow = {
  id: string;
  owner_user_id: string;
  base_currency_code: string;
  status: "active" | "archived" | "deleted";
};

export class ExpenseService {
  constructor(
    private readonly database: Database,
    private readonly currencyService: CurrencyService
  ) {}

  async createExpense(
    tripId: string,
    input: unknown,
    idempotencyKey: string,
    actor: TripActor
  ): Promise<{ expense: ExpenseDto; replayed: boolean }> {
    const parsed = createExpenseSchema.parse(input);
    ensureUniqueTargets(parsed.splitTargets);
    if (!idempotencyKey.trim() || idempotencyKey.length > 200) {
      throw new z.ZodError([]);
    }

    const trip = await this.findTrip(tripId);
    if (!trip || trip.status === "deleted") {
      throw new ExpenseForbiddenError();
    }
    if (trip.status !== "active") {
      throw new ExpenseTripNotActiveError();
    }
    const actorMemberId = await this.resolveActorMemberId(trip, actor);
    const currencyCode = await this.currencyService.ensureActiveCurrencyCode(
      parsed.currencyCode
    );
    const fingerprint = hashJson({ ...parsed, currencyCode });
    const keyHash = hashText(idempotencyKey);
    const existing = await this.findIdempotentExpense(
      tripId,
      actorMemberId,
      keyHash
    );
    if (existing) {
      if (existing.request_fingerprint !== fingerprint) {
        throw new IdempotencyConflictError();
      }
      return { expense: await this.getExpense(existing.expense_id), replayed: true };
    }

    await this.validateParticipants(
      tripId,
      parsed.payerMemberId,
      parsed.splitTargets
    );
    const rateSnapshot = await this.resolveRateSnapshot({
      originalCurrencyCode: currencyCode,
      baseCurrencyCode: trip.base_currency_code,
      expenseDate: parsed.expenseDate
    });
    const convertedAmount = multiplyDecimals(parsed.amount, rateSnapshot.rate);
    const expenseId = randomUUID();

    try {
      await runInTransaction(this.database, async (database) => {
        await database.query(
        `insert into expenses (
          id, trip_id, created_by_member_id, payer_member_id, description,
          expense_date, original_amount, original_currency_code,
          base_currency_code, converted_amount
        ) values ($1,$2,$3,$4,$5,$6,$7::numeric,$8,$9,$10::numeric)`,
        [
          expenseId, tripId, actorMemberId, parsed.payerMemberId,
          parsed.description, parsed.expenseDate, parsed.amount, currencyCode,
          trip.base_currency_code, convertedAmount
        ]
      );
        for (const target of parsed.splitTargets) {
          await this.insertSplit(database, expenseId, target);
        }
        await database.query(
        `insert into currency_rate_snapshots (
          id, expense_id, original_currency_code, base_currency_code,
          rate, rate_date, source, is_manual
        ) values ($1,$2,$3,$4,$5::numeric,$6,$7,false)`,
        [
          randomUUID(), expenseId, currencyCode, trip.base_currency_code,
          rateSnapshot.rate, rateSnapshot.rateDate, rateSnapshot.source
        ]
      );
        await database.query(
        `insert into expense_idempotency_keys (
          id, trip_id, actor_member_id, key_hash, request_fingerprint, expense_id
        ) values ($1,$2,$3,$4,$5,$6)`,
        [randomUUID(), tripId, actorMemberId, keyHash, fingerprint, expenseId]
      );
        await database.query(
        `insert into audit_events (
          id, trip_id, actor_type, actor_id, event_type, entity_type, entity_id, metadata
        ) values ($1,$2,$3,$4,'expense.created','expense',$5,$6::jsonb)`,
        [
          randomUUID(), tripId, actor.type === "registered" ? "user" : "guest",
          actor.type === "registered" ? actor.userId : actor.memberId,
          expenseId, JSON.stringify({ actorMemberId, payerMemberId: parsed.payerMemberId })
        ]
      );
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const replay = await this.findIdempotentExpense(
          tripId,
          actorMemberId,
          keyHash
        );
        if (replay?.request_fingerprint === fingerprint) {
          return { expense: await this.getExpense(replay.expense_id), replayed: true };
        }
        if (replay) {
          throw new IdempotencyConflictError();
        }
      }
      throw error;
    }

    return { expense: await this.getExpense(expenseId), replayed: false };
  }

  async listExpenses(
    tripId: string,
    query: { limit?: unknown; cursor?: unknown },
    actor: TripActor
  ) {
    const trip = await this.findTrip(tripId);
    if (!trip || trip.status === "deleted") {
      throw new ExpenseForbiddenError();
    }
    await this.resolveActorMemberId(trip, actor);
    const limit = parseLimit(query.limit);
    const cursor = query.cursor ? decodeCursor(String(query.cursor)) : null;
    const params: unknown[] = [tripId, limit + 1];
    const cursorClause = cursor
      ? `and (e.expense_date, e.created_at, e.id) < ($3::date, $4::timestamptz, $5::uuid)`
      : "";
    if (cursor) params.push(cursor.expenseDate, cursor.createdAt, cursor.id);
    const result = await this.database.query<ExpenseListRow>(
      `select e.*, e.expense_date::text as expense_date,
        e.original_amount::text, e.converted_amount::text,
        p.display_name as payer_name, c.display_name as creator_name,
        s.rate::text as rate, s.rate_date::text, s.source, s.is_manual,
        e.created_at::text as created_at_text
       from expenses e
       join trip_members p on p.id = e.payer_member_id
       join trip_members c on c.id = e.created_by_member_id
       join currency_rate_snapshots s on s.expense_id = e.id
       where e.trip_id = $1 and e.status = 'accepted' ${cursorClause}
       order by e.expense_date desc, e.created_at desc, e.id desc
       limit $2`,
      params
    );
    const page = result.rows.slice(0, limit);
    const splits = await this.loadSplitSummaries(page.map((row) => row.id));
    return {
      items: page.map((row) => mapListRow(row, splits.get(row.id) ?? [])),
      nextCursor:
        result.rows.length > limit && page.length
          ? encodeCursor(page[page.length - 1]!)
          : null
    };
  }

  private async resolveRateSnapshot(input: {
    originalCurrencyCode: string;
    baseCurrencyCode: string;
    expenseDate: string;
  }) {
    if (input.originalCurrencyCode === input.baseCurrencyCode) {
      return { rate: "1", rateDate: input.expenseDate, source: "same_currency" };
    }
    try {
      const result = await this.currencyService.resolveHistoricalRate({
        ...input,
        rateDate: input.expenseDate
      });
      return { rate: result.rate, rateDate: result.rateDate, source: result.source };
    } catch (error) {
      if (
        error instanceof CurrencyProviderUnavailableError ||
        error instanceof InvalidCurrencyProviderResponseError
      ) {
        throw new ManualRateRequiredError();
      }
      throw error;
    }
  }

  private async resolveActorMemberId(trip: TripRow, actor: TripActor): Promise<string> {
    const result = await this.database.query<{ id: string }>(
      actor.type === "registered"
        ? `select id from trip_members
           where trip_id = $1 and user_id = $2 and status = 'active' limit 1`
        : `select id from trip_members
           where trip_id = $1 and id = $2 and status = 'active' limit 1`,
      [trip.id, actor.type === "registered" ? actor.userId : actor.memberId]
    );
    if (
      !result.rows[0] ||
      (actor.type === "guest" && actor.tripId !== trip.id)
    ) {
      throw new ExpenseForbiddenError();
    }
    return result.rows[0].id;
  }

  private async validateParticipants(
    tripId: string,
    payerMemberId: string,
    targets: Array<{ type: "member" | "family"; id: string }>
  ) {
    const memberIds = [
      payerMemberId,
      ...targets.filter((target) => target.type === "member").map((target) => target.id)
    ];
    const familyIds = targets
      .filter((target) => target.type === "family")
      .map((target) => target.id);
    const members = await this.database.query<{ id: string }>(
      `select id from trip_members
       where trip_id = $1 and status = 'active' and id = any($2::uuid[])`,
      [tripId, memberIds]
    );
    const families = familyIds.length
      ? await this.database.query<{ id: string; share_count: string }>(
          `select id, share_count::text from families
           where trip_id = $1 and status = 'active' and id = any($2::uuid[])`,
          [tripId, familyIds]
        )
      : { rows: [] };
    if (
      members.rows.length !== new Set(memberIds).size ||
      families.rows.length !== new Set(familyIds).size
    ) {
      throw new InvalidExpenseParticipantError();
    }
  }

  private async insertSplit(
    database: Database,
    expenseId: string,
    target: { type: "member" | "family"; id: string }
  ) {
    if (target.type === "member") {
      const share = await database.query<{ share_count: string }>(
        "select share_count::text from trip_members where id = $1",
        [target.id]
      );
      await database.query(
        `insert into expense_splits
         (id, expense_id, target_type, target_member_id, share_count)
         values ($1,$2,'member',$3,$4::numeric)`,
        [randomUUID(), expenseId, target.id, share.rows[0]!.share_count]
      );
      return;
    }
    const share = await database.query<{ share_count: string }>(
      "select share_count::text from families where id = $1",
      [target.id]
    );
    await database.query(
      `insert into expense_splits
       (id, expense_id, target_type, target_family_id, share_count)
       values ($1,$2,'family',$3,$4::numeric)`,
      [randomUUID(), expenseId, target.id, share.rows[0]!.share_count]
    );
  }

  private async findTrip(tripId: string) {
    const result = await this.database.query<TripRow>(
      `select id, owner_user_id, base_currency_code, status
       from trips where id = $1 limit 1`,
      [tripId]
    );
    return result.rows[0] ?? null;
  }

  private async findIdempotentExpense(
    tripId: string,
    actorMemberId: string,
    keyHash: string
  ) {
    const result = await this.database.query<{
      request_fingerprint: string;
      expense_id: string;
    }>(
      `select request_fingerprint, expense_id from expense_idempotency_keys
       where trip_id = $1 and actor_member_id = $2 and key_hash = $3 limit 1`,
      [tripId, actorMemberId, keyHash]
    );
    return result.rows[0] ?? null;
  }

  private async getExpense(expenseId: string): Promise<ExpenseDto> {
    const result = await this.database.query<ExpenseListRow>(
      `select e.*, e.expense_date::text as expense_date,
        e.original_amount::text, e.converted_amount::text,
        '' as payer_name, '' as creator_name, s.rate::text as rate,
        s.rate_date::text, s.source, s.is_manual, e.created_at::text as created_at_text
       from expenses e join currency_rate_snapshots s on s.expense_id = e.id
       where e.id = $1`,
      [expenseId]
    );
    const splits = await this.loadSplitSummaries([expenseId]);
    const row = result.rows[0]!;
    return {
      id: row.id,
      tripId: row.trip_id,
      status: "accepted",
      payerMemberId: row.payer_member_id,
      originalAmount: row.original_amount,
      originalCurrencyCode: row.original_currency_code.trim(),
      convertedAmount: row.converted_amount,
      baseCurrencyCode: row.base_currency_code.trim(),
      rate: row.rate,
      rateDate: row.rate_date,
      rateSource: row.source,
      isManualRate: row.is_manual,
      expenseDate: row.expense_date,
      description: row.description,
      splitTargets: splits.get(expenseId) ?? []
    };
  }

  private async loadSplitSummaries(expenseIds: string[]) {
    const grouped = new Map<string, ExpenseDto["splitTargets"]>();
    if (!expenseIds.length) return grouped;
    const result = await this.database.query<{
      expense_id: string;
      target_type: "member" | "family";
      target_id: string;
      share_count: string;
    }>(
      `select expense_id, target_type,
        coalesce(target_member_id, target_family_id) as target_id,
        share_count::text
       from expense_splits where expense_id = any($1::uuid[])
       order by created_at, id`,
      [expenseIds]
    );
    for (const row of result.rows) {
      const items = grouped.get(row.expense_id) ?? [];
      items.push({ type: row.target_type, id: row.target_id, shareCount: row.share_count });
      grouped.set(row.expense_id, items);
    }
    return grouped;
  }
}

type ExpenseListRow = {
  id: string;
  trip_id: string;
  created_by_member_id: string;
  payer_member_id: string;
  description: string;
  expense_date: string;
  original_amount: string;
  original_currency_code: string;
  base_currency_code: string;
  converted_amount: string;
  payer_name: string;
  creator_name: string;
  rate: string;
  rate_date: string;
  source: string;
  is_manual: boolean;
  created_at_text: string;
};

function ensureUniqueTargets(targets: Array<{ type: string; id: string }>) {
  const keys = targets.map((target) => `${target.type}:${target.id}`);
  if (new Set(keys).size !== keys.length) {
    throw new DuplicateSplitTargetError();
  }
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hashJson(value: unknown) {
  return hashText(JSON.stringify(value));
}

function parseLimit(value: unknown): number {
  if (value === undefined) return 20;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new z.ZodError([]);
  }
  return parsed;
}

function encodeCursor(row: ExpenseListRow): string {
  return Buffer.from(
    JSON.stringify({
      expenseDate: row.expense_date,
      createdAt: row.created_at_text,
      id: row.id
    })
  ).toString("base64url");
}

function decodeCursor(value: string): {
  expenseDate: string;
  createdAt: string;
  id: string;
} {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return z
      .object({
        expenseDate: z.string().date(),
        createdAt: z.string().min(1),
        id: z.string().uuid()
      })
      .parse(parsed);
  } catch {
    throw new InvalidExpenseCursorError();
  }
}

function mapListRow(
  row: ExpenseListRow,
  splitTargets: ExpenseDto["splitTargets"]
) {
  return {
    id: row.id,
    payer: { id: row.payer_member_id, displayName: row.payer_name },
    creator: { id: row.created_by_member_id, displayName: row.creator_name },
    originalAmount: row.original_amount,
    originalCurrencyCode: row.original_currency_code.trim(),
    convertedAmount: row.converted_amount,
    baseCurrencyCode: row.base_currency_code.trim(),
    expenseDate: row.expense_date,
    description: row.description,
    rateSnapshot: {
      rate: row.rate,
      rateDate: row.rate_date,
      source: row.source,
      isManual: row.is_manual
    },
    splitTargets
  };
}
