import { divideDecimals } from "../expenses/decimal.js";
import {
  CurrencyProviderUnavailableError,
  type CurrencyRateProvider,
  type ExchangeRateRequest,
  type ExchangeRateResult
} from "./currency-service.js";

type FetchClient = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>;

export class CbrCurrencyRateProvider implements CurrencyRateProvider {
  readonly name = "cbr";

  constructor(
    private readonly endpoint: string,
    private readonly timeoutMs: number,
    private readonly fetchClient: FetchClient = fetch
  ) {}

  async getHistoricalRate(
    request: ExchangeRateRequest
  ): Promise<ExchangeRateResult> {
    try {
      const response = await this.fetchClient(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "text/xml; charset=utf-8",
          soapaction: '"http://web.cbr.ru/GetCursOnDateXML"'
        },
        body: buildSoapRequest(request.rateDate),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
      if (!response.ok) {
        throw new Error(`CBR responded with HTTP ${response.status}`);
      }

      const rates = parseCbrRates(await response.text());
      const fromRate = rates.rates.get(request.baseCurrencyCode);
      const toRate = rates.rates.get(request.targetCurrencyCode);
      if (!fromRate || !toRate) {
        throw new Error("Requested currency is absent from the CBR response");
      }

      return {
        baseCurrencyCode: request.baseCurrencyCode,
        targetCurrencyCode: request.targetCurrencyCode,
        rateDate: rates.rateDate,
        rate: divideDecimals(fromRate, toRate),
        source: this.name
      };
    } catch (error) {
      if (error instanceof CurrencyProviderUnavailableError) {
        throw error;
      }
      throw new CurrencyProviderUnavailableError(this.name);
    }
  }
}

function buildSoapRequest(rateDate: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetCursOnDateXML xmlns="http://web.cbr.ru/">
      <On_date>${rateDate}T00:00:00</On_date>
    </GetCursOnDateXML>
  </soap:Body>
</soap:Envelope>`;
}

function parseCbrRates(xml: string): {
  rateDate: string;
  rates: Map<string, string>;
} {
  const dateMatch = /<ValuteData\s+OnDate="(\d{8})"/.exec(xml);
  if (!dateMatch) {
    throw new Error("CBR response has no rate date");
  }
  const rates = new Map<string, string>([["RUB", "1"]]);
  const rows = xml.matchAll(
    /<ValuteCursOnDate>([\s\S]*?)<\/ValuteCursOnDate>/g
  );
  for (const row of rows) {
    const code = /<VchCode>\s*([A-Z]{3})\s*<\/VchCode>/.exec(row[1] ?? "")?.[1];
    const unitRate = /<VunitRate>\s*(\d+(?:\.\d+)?)\s*<\/VunitRate>/.exec(
      row[1] ?? ""
    )?.[1];
    if (code && unitRate && /[1-9]/.test(unitRate)) {
      rates.set(code, unitRate);
    }
  }
  if (rates.size === 1) {
    throw new Error("CBR response has no currency rates");
  }

  const compactDate = dateMatch[1];
  return {
    rateDate: `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6)}`,
    rates
  };
}
