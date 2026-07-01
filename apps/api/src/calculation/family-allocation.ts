import { allocateDecimalByWeights } from "./decimal-ratio.js";

export type AllocationTargetType = "family" | "member";

export interface ExpenseAllocationInput {
  expenseId: string;
  convertedAmount: string;
  baseCurrencyCode: string;
  targets: Array<{
    targetType: AllocationTargetType;
    targetId: string;
    displayName: string;
    shareCount: string;
  }>;
}

export interface ExpenseTargetAllocation {
  expenseId: string;
  targetType: AllocationTargetType;
  targetId: string;
  displayName: string;
  snapshottedShareCount: string;
  allocatedAmount: string;
  outputScale: number;
}

export interface ExpenseAllocationResult {
  expenseId: string;
  convertedAmount: string;
  baseCurrencyCode: string;
  outputScale: number;
  allocations: ExpenseTargetAllocation[];
}

export class FamilyAllocationError extends Error {}

export function allocateExpense(
  input: ExpenseAllocationInput
): ExpenseAllocationResult {
  const targetsByKey = new Map(
    input.targets.map((target) => [targetKey(target), target] as const)
  );
  if (targetsByKey.size !== input.targets.length) {
    throw new FamilyAllocationError("Duplicate allocation target");
  }

  const result = allocateDecimalByWeights(
    input.convertedAmount,
    input.targets.map((target) => ({
      key: targetKey(target),
      weight: target.shareCount
    }))
  );
  const allocations = [...result.allocations].map(([key, allocatedAmount]) => {
    const target = targetsByKey.get(key)!;
    return {
      expenseId: input.expenseId,
      targetType: target.targetType,
      targetId: target.targetId,
      displayName: target.displayName,
      snapshottedShareCount: target.shareCount,
      allocatedAmount,
      outputScale: result.scale
    };
  });

  return {
    expenseId: input.expenseId,
    convertedAmount: input.convertedAmount,
    baseCurrencyCode: input.baseCurrencyCode,
    outputScale: result.scale,
    allocations
  };
}

function targetKey(target: {
  targetType: AllocationTargetType;
  targetId: string;
}): string {
  return `${target.targetType}:${target.targetId}`;
}
