import { z } from "zod";
import type { Database } from "../database/database.js";

export interface CurrencyDto {
  code: string;
  displayName: string;
  symbol: string | null;
  minorUnits: number;
}

export interface ExchangeRateRequest {
  baseCurrencyCode: string;
  targetCurrencyCode: string;
  rateDate: string;
}

export interface ExchangeRateResult {
  baseCurrencyCode: string;
  targetCurrencyCode: string;
  rateDate: string;
  rate: string;
  source: string;
}

export interface CurrencyRateProvider {
  readonly name: string;
  getHistoricalRate(request: ExchangeRateRequest): Promise<ExchangeRateResult>;
}

export class CurrencyProviderUnavailableError extends Error {
  constructor(providerName: string) {
    super(`Currency provider ${providerName} is unavailable`);
  }
}

export class FakeCurrencyRateProvider implements CurrencyRateProvider {
  readonly name = "fake";

  constructor(private readonly rates = new Map<string, string>()) {}

  async getHistoricalRate(request: ExchangeRateRequest): Promise<ExchangeRateResult> {
    const baseCurrencyCode = normalizeCurrencyCode(request.baseCurrencyCode);
    const targetCurrencyCode = normalizeCurrencyCode(request.targetCurrencyCode);

    if (!baseCurrencyCode || !targetCurrencyCode) {
      throw new CurrencyProviderUnavailableError(this.name);
    }

    const key = `${baseCurrencyCode}:${targetCurrencyCode}:${request.rateDate}`;
    const rate = this.rates.get(key) ?? (baseCurrencyCode === targetCurrencyCode ? "1" : "2");

    return {
      baseCurrencyCode,
      targetCurrencyCode,
      rateDate: request.rateDate,
      rate,
      source: this.name
    };
  }
}

export class UnsupportedCurrencyError extends Error {
  constructor(readonly code: string) {
    super(`Unsupported currency code: ${code}`);
  }
}

const currencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z]{3}$/);

export function normalizeCurrencyCode(input: unknown): string | null {
  const parsed = currencyCodeSchema.safeParse(input);
  return parsed.success ? parsed.data.toUpperCase() : null;
}

export async function isActiveCurrencyCode(
  database: Database,
  input: unknown
): Promise<boolean> {
  const code = normalizeCurrencyCode(input);
  if (!code) {
    return false;
  }

  const result = await database.query<{ code: string }>(
    `
      select code
      from currencies
      where code = $1 and is_active = true
      limit 1
    `,
    [code]
  );

  return result.rows.length > 0;
}

export class CurrencyService {
  constructor(private readonly database: Database) {}

  async listActiveCurrencies(): Promise<CurrencyDto[]> {
    const result = await this.database.query<{
      code: string;
      display_name: string;
      symbol: string | null;
      minor_units: number;
    }>(
      `
        select code, display_name, symbol, minor_units
        from currencies
        where is_active = true
        order by sort_order asc, code asc
      `
    );

    return result.rows.map((row) => ({
      code: row.code,
      displayName: row.display_name,
      symbol: row.symbol,
      minorUnits: Number(row.minor_units)
    }));
  }

  async ensureActiveCurrencyCode(input: unknown): Promise<string> {
    const code = normalizeCurrencyCode(input);
    if (!code || !(await isActiveCurrencyCode(this.database, code))) {
      throw new UnsupportedCurrencyError(String(input));
    }

    return code;
  }
}
