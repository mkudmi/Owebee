import { describe, expect, it, vi } from "vitest";
import { CbrCurrencyRateProvider } from "./cbr-currency-rate-provider.js";
import { CurrencyProviderUnavailableError } from "./currency-service.js";

const SOAP_RESPONSE = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetCursOnDateXMLResponse xmlns="http://web.cbr.ru/">
      <GetCursOnDateXMLResult>
        <ValuteData OnDate="20260630" xmlns="">
          <ValuteCursOnDate>
            <Vnom>1</Vnom><Vcurs>90.0000</Vcurs>
            <VchCode>EUR</VchCode><VunitRate>90.0000</VunitRate>
          </ValuteCursOnDate>
          <ValuteCursOnDate>
            <Vnom>100</Vnom><Vcurs>80.0000</Vcurs>
            <VchCode>AMD</VchCode><VunitRate>0.800000</VunitRate>
          </ValuteCursOnDate>
          <ValuteCursOnDate>
            <Vnom>1</Vnom><Vcurs>75.0000</Vcurs>
            <VchCode>USD</VchCode><VunitRate>75.0000</VunitRate>
          </ValuteCursOnDate>
        </ValuteData>
      </GetCursOnDateXMLResult>
    </GetCursOnDateXMLResponse>
  </soap:Body>
</soap:Envelope>`;

describe("CBR currency rate provider", () => {
  it("uses VunitRate for a currency-to-RUB rate", async () => {
    const fetchClient = vi.fn(async () => new Response(SOAP_RESPONSE));
    const provider = new CbrCurrencyRateProvider(
      "https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx",
      5000,
      fetchClient
    );

    await expect(
      provider.getHistoricalRate({
        baseCurrencyCode: "AMD",
        targetCurrencyCode: "RUB",
        rateDate: "2026-06-30"
      })
    ).resolves.toEqual({
      baseCurrencyCode: "AMD",
      targetCurrencyCode: "RUB",
      rateDate: "2026-06-30",
      rate: "0.8",
      source: "cbr"
    });
    expect(fetchClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("<On_date>2026-06-30T00:00:00</On_date>")
      })
    );
  });

  it("derives a cross-rate through RUB", async () => {
    const provider = new CbrCurrencyRateProvider(
      "https://cbr.test",
      5000,
      async () => new Response(SOAP_RESPONSE)
    );

    await expect(
      provider.getHistoricalRate({
        baseCurrencyCode: "EUR",
        targetCurrencyCode: "USD",
        rateDate: "2026-06-30"
      })
    ).resolves.toMatchObject({ rate: "1.2", source: "cbr" });
  });

  it("maps HTTP and malformed responses to provider unavailable", async () => {
    const httpFailure = new CbrCurrencyRateProvider(
      "https://cbr.test",
      5000,
      async () => new Response("", { status: 503 })
    );
    const malformed = new CbrCurrencyRateProvider(
      "https://cbr.test",
      5000,
      async () => new Response("<xml />")
    );

    await expect(
      httpFailure.getHistoricalRate({
        baseCurrencyCode: "EUR",
        targetCurrencyCode: "RUB",
        rateDate: "2026-06-30"
      })
    ).rejects.toBeInstanceOf(CurrencyProviderUnavailableError);
    await expect(
      malformed.getHistoricalRate({
        baseCurrencyCode: "EUR",
        targetCurrencyCode: "RUB",
        rateDate: "2026-06-30"
      })
    ).rejects.toBeInstanceOf(CurrencyProviderUnavailableError);
  });
});
