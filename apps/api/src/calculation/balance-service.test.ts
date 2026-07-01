import { describe, expect, it } from "vitest";
import {
  BalanceInvariantError,
  BalanceService,
  InvalidBalanceBreakdownQueryError,
  calculateBalanceLines
} from "./balance-service.js";
import type { Database } from "../database/database.js";

describe("calculateBalanceLines", () => {
  it("credits the payer and debits weighted targets with exact zero sum", () => {
    expect(
      calculateBalanceLines([
        {
          expenseId: "expense-1",
          convertedAmount: "100",
          baseCurrencyCode: "RUB",
          payer: { id: "member-a", displayName: "Alex" },
          targets: [
            {
              targetType: "member",
              targetId: "member-b",
              displayName: "Bob",
              shareCount: "1"
            },
            {
              targetType: "family",
              targetId: "family-a",
              displayName: "Family",
              shareCount: "2",
              currentFamilyShareCount: "2"
            }
          ]
        }
      ])
    ).toEqual([
      {
        targetType: "family",
        targetId: "family-a",
        displayName: "Family",
        balance: "-66.66666667",
        shareCount: "2"
      },
      {
        targetType: "member",
        targetId: "member-a",
        displayName: "Alex",
        balance: "100.00000000"
      },
      {
        targetType: "member",
        targetId: "member-b",
        displayName: "Bob",
        balance: "-33.33333333"
      }
    ]);
  });

  it("keeps a zero-net payer line when the payer is the only target", () => {
    expect(
      calculateBalanceLines([
        {
          expenseId: "expense-1",
          convertedAmount: "10",
          baseCurrencyCode: "RUB",
          payer: { id: "member-a", displayName: "Alex" },
          targets: [
            {
              targetType: "member",
              targetId: "member-a",
              displayName: "Alex",
              shareCount: "1"
            }
          ]
        }
      ])
    ).toEqual([
      {
        targetType: "member",
        targetId: "member-a",
        displayName: "Alex",
        balance: "0.00000000"
      }
    ]);
  });

  it("returns no lines for an empty trip", () => {
    expect(calculateBalanceLines([])).toEqual([]);
  });

  it("rejects a family target without its current display share count", () => {
    expect(() =>
      calculateBalanceLines([
        {
          expenseId: "expense-1",
          convertedAmount: "10",
          baseCurrencyCode: "RUB",
          payer: { id: "member-a", displayName: "Alex" },
          targets: [
            {
              targetType: "family",
              targetId: "family-a",
              displayName: "Family",
              shareCount: "1"
            }
          ]
        }
      ])
    ).toThrow(BalanceInvariantError);
  });

  it("rejects malformed breakdown input before querying the database", async () => {
    let queried = false;
    const service = new BalanceService({
      async query() {
        queried = true;
        throw new Error("database should not be queried");
      }
    } as Database);

    await expect(
      service.getBreakdown(
        "00000000-0000-4000-8000-000000000001",
        "invalid",
        "00000000-0000-4000-8000-000000000002",
        {},
        {
          type: "registered",
          userId: "00000000-0000-4000-8000-000000000003"
        }
      )
    ).rejects.toThrow(InvalidBalanceBreakdownQueryError);
    expect(queried).toBe(false);
  });
});
