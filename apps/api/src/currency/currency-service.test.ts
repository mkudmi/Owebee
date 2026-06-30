import { describe, expect, it } from "vitest";
import {
  FakeCurrencyRateProvider,
  normalizeCurrencyCode
} from "./currency-service.js";

describe("currency helpers", () => {
  it("normalizes valid currency codes", () => {
    expect(normalizeCurrencyCode("rub")).toBe("RUB");
    expect(normalizeCurrencyCode(" USD ")).toBe("USD");
  });

  it("rejects malformed currency codes", () => {
    expect(normalizeCurrencyCode("US")).toBeNull();
    expect(normalizeCurrencyCode("US1")).toBeNull();
  });

  it("provides deterministic fake rates for automated tests", async () => {
    const provider = new FakeCurrencyRateProvider(
      new Map([["EUR:RUB:2026-06-30", "95.25"]])
    );

    await expect(
      provider.getHistoricalRate({
        baseCurrencyCode: "eur",
        targetCurrencyCode: "rub",
        rateDate: "2026-06-30"
      })
    ).resolves.toMatchObject({
      baseCurrencyCode: "EUR",
      targetCurrencyCode: "RUB",
      rate: "95.25",
      source: "fake"
    });
  });
});
