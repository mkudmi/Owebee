import type { TripActor } from "../auth/trip-actor.js";
import {
  runInTransaction,
  type Database
} from "../database/database.js";
import { z } from "zod";
import {
  allocateExpense,
  type AllocationTargetType
} from "./family-allocation.js";
import {
  addDecimals,
  isZeroDecimal,
  negateDecimal
} from "./signed-decimal.js";

export interface BalanceExpenseInput {
  expenseId: string;
  convertedAmount: string;
  baseCurrencyCode: string;
  payer: { id: string; displayName: string };
  targets: Array<{
    targetType: AllocationTargetType;
    targetId: string;
    displayName: string;
    shareCount: string;
    currentFamilyShareCount?: string;
  }>;
}

export type BalanceLine =
  | {
      targetType: "member";
      targetId: string;
      displayName: string;
      balance: string;
    }
  | {
      targetType: "family";
      targetId: string;
      displayName: string;
      balance: string;
      shareCount: string;
    };

type MutableBalanceLine = {
  targetType: AllocationTargetType;
  targetId: string;
  displayName: string;
  balance: string;
  shareCount?: string;
};

export class BalanceForbiddenError extends Error {}
export class BalanceInvariantError extends Error {}
export class BalanceTargetNotFoundError extends Error {}
export class InvalidBalanceBreakdownQueryError extends Error {}
export class InvalidBalanceCursorError extends Error {}

export function calculateBalanceLines(
  expenses: BalanceExpenseInput[]
): BalanceLine[] {
  const lines = new Map<string, MutableBalanceLine>();

  for (const expense of expenses) {
    addContribution(
      lines,
      {
        targetType: "member",
        targetId: expense.payer.id,
        displayName: expense.payer.displayName
      },
      expense.convertedAmount
    );
    const allocation = allocateExpense({
      expenseId: expense.expenseId,
      convertedAmount: expense.convertedAmount,
      baseCurrencyCode: expense.baseCurrencyCode,
      targets: expense.targets
    });
    const targets = new Map(
      expense.targets.map((target) => [
        balanceKey(target.targetType, target.targetId),
        target
      ])
    );
    for (const item of allocation.allocations) {
      const target = targets.get(balanceKey(item.targetType, item.targetId))!;
      if (
        item.targetType === "family" &&
        !target.currentFamilyShareCount
      ) {
        throw new BalanceInvariantError(
          "Family balance line requires a current share count"
        );
      }
      addContribution(
        lines,
        {
          targetType: item.targetType,
          targetId: item.targetId,
          displayName: item.displayName,
          shareCount: target.currentFamilyShareCount
        },
        negateDecimal(item.allocatedAmount)
      );
    }
  }

  const result = [...lines.values()]
    .sort(compareBalanceLines)
    .map((line): BalanceLine =>
      line.targetType === "family"
        ? {
            targetType: "family",
            targetId: line.targetId,
            displayName: line.displayName,
            balance: line.balance,
            shareCount: line.shareCount!
          }
        : {
            targetType: "member",
            targetId: line.targetId,
            displayName: line.displayName,
            balance: line.balance
          }
    );
  const total = result.reduce(
    (sum, line) => addDecimals(sum, line.balance),
    "0"
  );
  if (!isZeroDecimal(total)) {
    throw new BalanceInvariantError("Balance lines do not sum to zero");
  }
  return result;
}

function addContribution(
  lines: Map<string, MutableBalanceLine>,
  target: Omit<MutableBalanceLine, "balance">,
  contribution: string
) {
  const key = balanceKey(target.targetType, target.targetId);
  const existing = lines.get(key);
  lines.set(key, {
    ...target,
    shareCount: target.shareCount ?? existing?.shareCount,
    balance: addDecimals(existing?.balance ?? "0", contribution)
  });
}

function balanceKey(type: AllocationTargetType, id: string): string {
  return `${type}:${id}`;
}

function compareBalanceLines(
  left: MutableBalanceLine,
  right: MutableBalanceLine
): number {
  return (
    left.targetType.localeCompare(right.targetType) ||
    normalizeName(left.displayName).localeCompare(normalizeName(right.displayName)) ||
    left.targetId.localeCompare(right.targetId)
  );
}

function normalizeName(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en");
}

export class BalanceService {
  constructor(private readonly database: Database) {}

  async getBalance(tripId: string, actor: TripActor) {
    if (!z.string().uuid().safeParse(tripId).success) {
      throw new BalanceForbiddenError();
    }
    return runInTransaction(this.database, async (database) => {
      await database.query("set transaction isolation level repeatable read");
      return this.loadBalance(database, tripId, actor);
    });
  }

  async getBreakdown(
    tripId: string,
    targetTypeValue: string,
    targetId: string,
    query: { limit?: unknown; cursor?: unknown },
    actor: TripActor
  ) {
    if (!z.string().uuid().safeParse(tripId).success) {
      throw new BalanceForbiddenError();
    }
    const targetType = parseTargetType(targetTypeValue);
    if (!z.string().uuid().safeParse(targetId).success) {
      throw new InvalidBalanceBreakdownQueryError();
    }
    const limit = parseBreakdownLimit(query.limit);
    const cursor = query.cursor !== undefined
      ? decodeBreakdownCursor(String(query.cursor))
      : null;
    return runInTransaction(this.database, async (database) => {
      await database.query("set transaction isolation level repeatable read");
      const summary = await this.loadBalance(database, tripId, actor);
      const target = await this.findTarget(
        database,
        tripId,
        targetType,
        targetId
      );
      if (!target) {
        throw new BalanceTargetNotFoundError();
      }
      const summaryLine = summary.lines.find(
        (line) =>
          line.targetType === targetType && line.targetId === targetId
      );
      if (target.status !== "active" && !summaryLine) {
        throw new BalanceTargetNotFoundError();
      }
      const page = await this.loadContributionPage(
        database,
        tripId,
        targetType,
        targetId,
        cursor,
        limit
      );
      const summaryBalance = summaryLine?.balance ?? "0.00000000";

      return {
        tripId,
        targetType,
        targetId,
        displayName: target.displayName,
        balance: summaryBalance,
        ...(targetType === "family" ? { shareCount: target.shareCount! } : {}),
        items: page.items.map((contribution) => {
          const { createdAt, ...item } = contribution;
          void createdAt;
          return item;
        }),
        nextCursor:
          page.hasNext && page.items.length
            ? encodeBreakdownCursor(page.items[page.items.length - 1]!)
            : null
      };
    });
  }

  private async loadBalance(
    database: Database,
    tripId: string,
    actor: TripActor
  ) {
    const tripResult = await database.query<{
      id: string;
      base_currency_code: string;
      status: "active" | "archived" | "deleted";
    }>(
      `select id, base_currency_code, status
       from trips where id = $1 limit 1 for share`,
      [tripId]
    );
    const trip = tripResult.rows[0];
    if (!trip || trip.status === "deleted") {
      throw new BalanceForbiddenError();
    }
    if (actor.type === "guest" && actor.tripId !== trip.id) {
      throw new BalanceForbiddenError();
    }

    const membership = await database.query<{ id: string }>(
      actor.type === "registered"
        ? `select id from trip_members
           where trip_id = $1 and user_id = $2 and status = 'active'
           limit 1 for share`
        : `select id from trip_members
           where trip_id = $1 and id = $2 and status = 'active'
           limit 1 for share`,
      [trip.id, actor.type === "registered" ? actor.userId : actor.memberId]
    );
    if (!membership.rows[0]) {
      throw new BalanceForbiddenError();
    }

    const rows = await database.query<BalanceDataRow>(
      `select
         e.id as expense_id,
         e.converted_amount::text,
         e.base_currency_code,
         payer.id as payer_id,
         payer.display_name as payer_name,
         s.target_type,
         coalesce(s.target_member_id, s.target_family_id) as target_id,
         coalesce(target_member.display_name, target_family.display_name) as target_name,
         s.share_count::text,
         target_family.share_count::text as family_share_count
       from expenses e
       join trip_members payer
         on payer.id = e.payer_member_id and payer.trip_id = e.trip_id
       join expense_splits s on s.expense_id = e.id
       left join trip_members target_member
         on target_member.id = s.target_member_id
        and target_member.trip_id = e.trip_id
       left join families target_family
         on target_family.id = s.target_family_id
        and target_family.trip_id = e.trip_id
       where e.trip_id = $1
         and e.status = 'accepted'
         and (
           (s.target_type = 'member' and target_member.id is not null)
           or (s.target_type = 'family' and target_family.id is not null)
         )
       order by e.id, s.target_type, target_id`,
      [trip.id]
    );
    return {
      tripId: trip.id,
      baseCurrencyCode: trip.base_currency_code.trim(),
      lines: calculateBalanceLines(groupBalanceExpenses(rows.rows))
    };
  }

  private async findTarget(
    database: Database,
    tripId: string,
    targetType: AllocationTargetType,
    targetId: string
  ): Promise<{
    displayName: string;
    shareCount?: string;
    status: "active" | "archived";
  } | null> {
    if (targetType === "member") {
      const result = await database.query<{
        display_name: string;
        status: "active" | "archived";
      }>(
        `select display_name, status from trip_members
         where id = $1 and trip_id = $2 limit 1 for share`,
        [targetId, tripId]
      );
      return result.rows[0]
        ? {
            displayName: result.rows[0].display_name,
            status: result.rows[0].status
          }
        : null;
    }
    const result = await database.query<{
      display_name: string;
      share_count: string;
      status: "active" | "archived";
    }>(
      `select display_name, share_count::text, status from families
       where id = $1 and trip_id = $2 limit 1 for share`,
      [targetId, tripId]
    );
    return result.rows[0]
      ? {
          displayName: result.rows[0].display_name,
          shareCount: result.rows[0].share_count,
          status: result.rows[0].status
        }
      : null;
  }

  private async loadContributionPage(
    database: Database,
    tripId: string,
    targetType: AllocationTargetType,
    targetId: string,
    cursor: BreakdownCursor | null,
    limit: number
  ): Promise<{ items: BalanceContribution[]; hasNext: boolean }> {
    const candidateResult = await database.query<ContributionCandidate>(
      `with candidates as (
         select
           e.id as expense_id,
           e.expense_date::text,
           e.created_at::text,
           'payer_credit'::text as contribution_type
         from expenses e
         where e.trip_id = $1
           and e.status = 'accepted'
           and $2::text = 'member'
           and e.payer_member_id = $3
         union all
         select
           e.id as expense_id,
           e.expense_date::text,
           e.created_at::text,
           'allocated_share_debit'::text as contribution_type
         from expenses e
         join expense_splits selected on selected.expense_id = e.id
         where e.trip_id = $1
           and e.status = 'accepted'
           and (
             ($2::text = 'member' and selected.target_member_id = $3)
             or ($2::text = 'family' and selected.target_family_id = $3)
           )
       )
       select expense_id, expense_date, created_at, contribution_type
       from candidates
       where $4::date is null
          or (
            (expense_date::date, created_at::timestamptz, expense_id)
              < ($4::date, $5::timestamptz, $6::uuid)
          )
          or (
            (expense_date::date, created_at::timestamptz, expense_id)
              = ($4::date, $5::timestamptz, $6::uuid)
            and contribution_type > $7::text
          )
       order by
         expense_date::date desc,
         created_at::timestamptz desc,
         expense_id desc,
         contribution_type asc
       limit $8`,
      [
        tripId,
        targetType,
        targetId,
        cursor?.expenseDate ?? null,
        cursor?.createdAt ?? null,
        cursor?.expenseId ?? null,
        cursor?.contributionType ?? null,
        limit + 1
      ]
    );
    const candidates = candidateResult.rows;
    if (candidates.length === 0) {
      return { items: [], hasNext: false };
    }
    const expenseIds = [...new Set(candidates.map(({ expense_id }) => expense_id))];
    const rows = await this.loadDetailedRows(database, tripId, expenseIds);
    const contributions = buildTargetContributions(
      groupDetailedExpenses(rows),
      targetType,
      targetId
    );
    const byKey = new Map(
      contributions.map((contribution) => [
        contributionKey(contribution),
        contribution
      ])
    );
    const ordered = candidates.map((candidate) => {
      const contribution = byKey.get(candidateKey(candidate));
      if (!contribution) {
        throw new BalanceInvariantError(
          "Contribution candidate does not match detailed data"
        );
      }
      return contribution;
    });
    return {
      items: ordered.slice(0, limit),
      hasNext: ordered.length > limit
    };
  }

  private async loadDetailedRows(
    database: Database,
    tripId: string,
    expenseIds: string[]
  ) {
    const result = await database.query<BreakdownDataRow>(
      `select
         e.id as expense_id,
         e.expense_date::text,
         e.created_at::text,
         e.description,
         e.original_amount::text,
         e.original_currency_code,
         e.converted_amount::text,
         e.base_currency_code,
         payer.id as payer_id,
         payer.display_name as payer_name,
         s.target_type,
         coalesce(s.target_member_id, s.target_family_id) as target_id,
         coalesce(target_member.display_name, target_family.display_name) as target_name,
         s.share_count::text,
         target_family.share_count::text as family_share_count,
         snapshot.rate::text,
         snapshot.rate_date::text,
         snapshot.source,
         snapshot.is_manual
       from expenses e
       join trip_members payer
         on payer.id = e.payer_member_id and payer.trip_id = e.trip_id
       join expense_splits s on s.expense_id = e.id
       join currency_rate_snapshots snapshot on snapshot.expense_id = e.id
       left join trip_members target_member
         on target_member.id = s.target_member_id
        and target_member.trip_id = e.trip_id
       left join families target_family
         on target_family.id = s.target_family_id
        and target_family.trip_id = e.trip_id
       where e.trip_id = $1
         and e.status = 'accepted'
         and e.id = any($2::uuid[])
         and (
           (s.target_type = 'member' and target_member.id is not null)
           or (s.target_type = 'family' and target_family.id is not null)
         )
       order by e.id, s.target_type, target_id`,
      [tripId, expenseIds]
    );
    return result.rows;
  }
}

type BalanceDataRow = {
  expense_id: string;
  converted_amount: string;
  base_currency_code: string;
  payer_id: string;
  payer_name: string;
  target_type: AllocationTargetType;
  target_id: string;
  target_name: string;
  share_count: string;
  family_share_count: string | null;
};

function groupBalanceExpenses(rows: BalanceDataRow[]): BalanceExpenseInput[] {
  const expenses = new Map<string, BalanceExpenseInput>();
  for (const row of rows) {
    const expense = expenses.get(row.expense_id) ?? {
      expenseId: row.expense_id,
      convertedAmount: row.converted_amount,
      baseCurrencyCode: row.base_currency_code.trim(),
      payer: { id: row.payer_id, displayName: row.payer_name },
      targets: []
    };
    expense.targets.push({
      targetType: row.target_type,
      targetId: row.target_id,
      displayName: row.target_name,
      shareCount: row.share_count,
      ...(row.family_share_count
        ? { currentFamilyShareCount: row.family_share_count }
        : {})
    });
    expenses.set(row.expense_id, expense);
  }
  return [...expenses.values()];
}

type BreakdownDataRow = BalanceDataRow & {
  expense_date: string;
  created_at: string;
  description: string;
  original_amount: string;
  original_currency_code: string;
  rate: string;
  rate_date: string;
  source: string;
  is_manual: boolean;
};

type ContributionCandidate = {
  expense_id: string;
  expense_date: string;
  created_at: string;
  contribution_type: ContributionType;
};

type DetailedBalanceExpense = BalanceExpenseInput & {
  expenseDate: string;
  createdAt: string;
  description: string;
  originalAmount: string;
  originalCurrencyCode: string;
  rateSnapshot: {
    rate: string;
    rateDate: string;
    source: string;
    isManual: boolean;
  };
};

type ContributionType = "allocated_share_debit" | "payer_credit";

type BalanceContribution = {
  contributionType: ContributionType;
  expenseId: string;
  expenseDate: string;
  createdAt: string;
  description: string;
  payer: { id: string; displayName: string };
  originalAmount: string;
  originalCurrencyCode: string;
  convertedAmount: string;
  baseCurrencyCode: string;
  contribution: string;
  rateSnapshot: {
    rate: string;
    rateDate: string;
    source: string;
    isManual: boolean;
  };
  snapshottedShareCount?: string;
};

function groupDetailedExpenses(
  rows: BreakdownDataRow[]
): DetailedBalanceExpense[] {
  const expenses = new Map<string, DetailedBalanceExpense>();
  for (const row of rows) {
    const expense = expenses.get(row.expense_id) ?? {
      expenseId: row.expense_id,
      expenseDate: row.expense_date,
      createdAt: row.created_at,
      description: row.description,
      originalAmount: row.original_amount,
      originalCurrencyCode: row.original_currency_code.trim(),
      convertedAmount: row.converted_amount,
      baseCurrencyCode: row.base_currency_code.trim(),
      payer: { id: row.payer_id, displayName: row.payer_name },
      rateSnapshot: {
        rate: row.rate,
        rateDate: row.rate_date,
        source: row.source,
        isManual: row.is_manual
      },
      targets: []
    };
    expense.targets.push({
      targetType: row.target_type,
      targetId: row.target_id,
      displayName: row.target_name,
      shareCount: row.share_count,
      ...(row.family_share_count
        ? { currentFamilyShareCount: row.family_share_count }
        : {})
    });
    expenses.set(row.expense_id, expense);
  }
  return [...expenses.values()];
}

function buildTargetContributions(
  expenses: DetailedBalanceExpense[],
  targetType: AllocationTargetType,
  targetId: string
): BalanceContribution[] {
  const result: BalanceContribution[] = [];
  for (const expense of expenses) {
    const common = {
      expenseId: expense.expenseId,
      expenseDate: expense.expenseDate,
      createdAt: expense.createdAt,
      description: expense.description,
      payer: expense.payer,
      originalAmount: expense.originalAmount,
      originalCurrencyCode: expense.originalCurrencyCode,
      convertedAmount: expense.convertedAmount,
      baseCurrencyCode: expense.baseCurrencyCode,
      rateSnapshot: expense.rateSnapshot
    };
    if (targetType === "member" && expense.payer.id === targetId) {
      result.push({
        ...common,
        contributionType: "payer_credit",
        contribution: addDecimals("0", expense.convertedAmount)
      });
    }
    const allocation = allocateExpense({
      expenseId: expense.expenseId,
      convertedAmount: expense.convertedAmount,
      baseCurrencyCode: expense.baseCurrencyCode,
      targets: expense.targets
    }).allocations.find(
      (item) =>
        item.targetType === targetType && item.targetId === targetId
    );
    if (allocation) {
      result.push({
        ...common,
        contributionType: "allocated_share_debit",
        contribution: negateDecimal(allocation.allocatedAmount),
        ...(targetType === "family"
          ? { snapshottedShareCount: allocation.snapshottedShareCount }
          : {})
      });
    }
  }
  return result;
}

function parseTargetType(value: string): AllocationTargetType {
  if (value !== "member" && value !== "family") {
    throw new InvalidBalanceBreakdownQueryError();
  }
  return value;
}

function parseBreakdownLimit(value: unknown): number {
  if (value === undefined) return 20;
  if (
    typeof value !== "string" ||
    !/^(?:[1-9]|[1-9]\d|100)$/.test(value)
  ) {
    throw new InvalidBalanceBreakdownQueryError();
  }
  return Number(value);
}

type BreakdownCursor = Pick<
  BalanceContribution,
  "expenseDate" | "createdAt" | "expenseId" | "contributionType"
>;

function encodeBreakdownCursor(item: BalanceContribution): string {
  return Buffer.from(
    JSON.stringify({
      expenseDate: item.expenseDate,
      createdAt: item.createdAt,
      expenseId: item.expenseId,
      contributionType: item.contributionType
    })
  ).toString("base64url");
}

function decodeBreakdownCursor(value: string): BreakdownCursor {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      throw new InvalidBalanceCursorError();
    }
    const decoded = Buffer.from(value, "base64url");
    if (decoded.toString("base64url") !== value) {
      throw new InvalidBalanceCursorError();
    }
    return z
      .object({
        expenseDate: z.string().date(),
        createdAt: z.string().refine(
          (timestamp) => Number.isFinite(Date.parse(timestamp)),
          "Invalid timestamp"
        ),
        expenseId: z.string().uuid(),
        contributionType: z.enum([
          "allocated_share_debit",
          "payer_credit"
        ])
      })
      .strict()
      .parse(JSON.parse(decoded.toString("utf8")));
  } catch {
    throw new InvalidBalanceCursorError();
  }
}

function contributionKey(contribution: BreakdownCursor): string {
  return JSON.stringify([
    contribution.expenseDate,
    contribution.createdAt,
    contribution.expenseId,
    contribution.contributionType
  ]);
}

function candidateKey(candidate: ContributionCandidate): string {
  return JSON.stringify([
    candidate.expense_date,
    candidate.created_at,
    candidate.expense_id,
    candidate.contribution_type
  ]);
}
