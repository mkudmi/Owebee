import type { Database } from "../database/database.js";
import {
  allocateExpense,
  type AllocationTargetType,
  type ExpenseAllocationInput,
  type ExpenseAllocationResult
} from "./family-allocation.js";

type AllocationRow = {
  expense_id: string;
  converted_amount: string;
  base_currency_code: string;
  split_id: string | null;
  target_type: AllocationTargetType | null;
  target_id: string | null;
  display_name: string | null;
  share_count: string | null;
};

export class AllocationLoadError extends Error {}

export async function loadAcceptedExpenseAllocations(
  database: Database,
  tripId: string
): Promise<ExpenseAllocationResult[]> {
  const result = await database.query<AllocationRow>(
    `select
       e.id as expense_id,
       e.converted_amount::text,
       e.base_currency_code,
       s.id as split_id,
       s.target_type,
       case s.target_type
         when 'member' then s.target_member_id
         when 'family' then s.target_family_id
       end as target_id,
       coalesce(m.display_name, f.display_name) as display_name,
       s.share_count::text
     from expenses e
     left join expense_splits s on s.expense_id = e.id
     left join trip_members m
       on m.id = s.target_member_id and m.trip_id = e.trip_id
     left join families f
       on f.id = s.target_family_id and f.trip_id = e.trip_id
     where e.trip_id = $1 and e.status = 'accepted'
     order by e.id, s.target_type, target_id`,
    [tripId]
  );
  const expenses = new Map<string, ExpenseAllocationInput>();

  for (const row of result.rows) {
    if (
      !row.split_id ||
      !row.target_type ||
      !row.target_id ||
      !row.display_name ||
      !row.share_count
    ) {
      throw new AllocationLoadError(
        `Invalid allocation data for expense ${row.expense_id}`
      );
    }
    const input = expenses.get(row.expense_id) ?? {
      expenseId: row.expense_id,
      convertedAmount: row.converted_amount,
      baseCurrencyCode: row.base_currency_code.trim(),
      targets: []
    };
    input.targets.push({
      targetType: row.target_type,
      targetId: row.target_id,
      displayName: row.display_name,
      shareCount: row.share_count
    });
    expenses.set(row.expense_id, input);
  }

  return [...expenses.values()].map(allocateExpense);
}
