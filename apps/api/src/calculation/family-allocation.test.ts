import { describe, expect, it } from "vitest";
import {
  FamilyAllocationError,
  allocateExpense
} from "./family-allocation.js";

describe("allocateExpense", () => {
  it("allocates member and family snapshot weights with explanation data", () => {
    expect(
      allocateExpense({
        expenseId: "expense-1",
        convertedAmount: "100",
        baseCurrencyCode: "RUB",
        targets: [
          {
            targetType: "member",
            targetId: "member-a",
            displayName: "Alex",
            shareCount: "1"
          },
          {
            targetType: "family",
            targetId: "family-a",
            displayName: "Family",
            shareCount: "2"
          }
        ]
      })
    ).toEqual({
      expenseId: "expense-1",
      convertedAmount: "100",
      baseCurrencyCode: "RUB",
      outputScale: 8,
      allocations: [
        {
          expenseId: "expense-1",
          targetType: "family",
          targetId: "family-a",
          displayName: "Family",
          snapshottedShareCount: "2",
          allocatedAmount: "66.66666667",
          outputScale: 8
        },
        {
          expenseId: "expense-1",
          targetType: "member",
          targetId: "member-a",
          displayName: "Alex",
          snapshottedShareCount: "1",
          allocatedAmount: "33.33333333",
          outputScale: 8
        }
      ]
    });
  });

  it("is independent of input target order", () => {
    const target = {
      targetType: "member" as const,
      displayName: "Member",
      shareCount: "1"
    };
    const first = allocateExpense({
      expenseId: "expense-1",
      convertedAmount: "1",
      baseCurrencyCode: "RUB",
      targets: [
        { ...target, targetId: "c" },
        { ...target, targetId: "a" },
        { ...target, targetId: "b" }
      ]
    });
    const second = allocateExpense({
      expenseId: "expense-1",
      convertedAmount: "1",
      baseCurrencyCode: "RUB",
      targets: [...first.allocations]
        .reverse()
        .map((allocation) => ({
          targetType: allocation.targetType,
          targetId: allocation.targetId,
          displayName: allocation.displayName,
          shareCount: allocation.snapshottedShareCount
        }))
    });
    expect(second).toEqual(first);
  });

  it("rejects duplicate typed targets", () => {
    expect(() =>
      allocateExpense({
        expenseId: "expense-1",
        convertedAmount: "10",
        baseCurrencyCode: "RUB",
        targets: [
          {
            targetType: "family",
            targetId: "same",
            displayName: "A",
            shareCount: "1"
          },
          {
            targetType: "family",
            targetId: "same",
            displayName: "B",
            shareCount: "2"
          }
        ]
      })
    ).toThrow(FamilyAllocationError);
  });
});
