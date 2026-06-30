import type { FastifyInstance } from "fastify";
import type { CurrencyService } from "./currency-service.js";

export interface CurrencyRoutesOptions {
  currencyService: CurrencyService;
}

export async function registerCurrencyRoutes(
  app: FastifyInstance,
  options: CurrencyRoutesOptions
) {
  app.get("/api/v1/currencies", async () => ({
    currencies: await options.currencyService.listActiveCurrencies()
  }));
}
