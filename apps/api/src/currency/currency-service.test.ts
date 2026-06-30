import { describe, expect, it } from "vitest";
import {
  CurrencyService,
  FakeCurrencyRateProvider,
  InvalidCurrencyProviderResponseError,
  normalizeCurrencyCode
} from "./currency-service.js";
import type { Database } from "../database/database.js";

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

  it("normalizes and validates a historical provider response", async () => {
    const database = {
      query: async () => ({ rows: [{ code: "EUR" }] })
    } as unknown as Database;
    const service = new CurrencyService(
      database,
      new FakeCurrencyRateProvider(
        new Map([["EUR:RUB:2026-07-18", "95.2500"]])
      )
    );

    await expect(
      service.resolveHistoricalRate({
        originalCurrencyCode: "eur",
        baseCurrencyCode: "rub",
        rateDate: "2026-07-18"
      })
    ).resolves.toMatchObject({
      baseCurrencyCode: "EUR",
      targetCurrencyCode: "RUB",
      rate: "95.2500"
    });
  });

  it("rejects an invalid provider rate", async () => {
    const database = {
      query: async () => ({ rows: [{ code: "EUR" }] })
    } as unknown as Database;
    const service = new CurrencyService(database, {
      name: "invalid",
      getHistoricalRate: async () => ({
        baseCurrencyCode: "EUR",
        targetCurrencyCode: "RUB",
        rateDate: "2026-07-18",
        rate: "-1",
        source: "invalid"
      })
    });

    await expect(
      service.resolveHistoricalRate({
        originalCurrencyCode: "EUR",
        baseCurrencyCode: "RUB",
        rateDate: "2026-07-18"
      })
    ).rejects.toBeInstanceOf(InvalidCurrencyProviderResponseError);
  });
});
