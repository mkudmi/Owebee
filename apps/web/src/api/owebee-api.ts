import type { WorkspaceSession } from "../app/session.js";

export interface ExpenseListItem {
  id: string;
  payer: {
    id: string;
    displayName: string;
  };
  originalAmount: string;
  originalCurrencyCode: string;
  convertedAmount: string;
  baseCurrencyCode: string;
  expenseDate: string;
  description: string;
}

export interface ExpenseListPage {
  items: ExpenseListItem[];
  nextCursor: string | null;
}

export interface ParticipantReference {
  id: string;
  displayName: string;
  email: string | null;
  role: "owner" | "participant";
  status: "active" | "archived";
}

export interface FamilyReference {
  id: string;
  tripId: string;
  displayName: string;
  shareCount: string;
  status: "active";
}

export interface ParticipantsPage {
  tripId: string;
  members: ParticipantReference[];
  families: FamilyReference[];
}

export interface CurrencyReference {
  code: string;
  displayName: string;
  symbol: string | null;
  minorUnits: number;
}

export type WorkspaceApiErrorKind =
  | "unauthorized"
  | "unavailable"
  | "invalid-response";

export class WorkspaceApiError extends Error {
  override readonly name = "WorkspaceApiError";

  constructor(
    readonly kind: WorkspaceApiErrorKind,
    message: string
  ) {
    super(message);
  }
}

type FetchImplementation = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

export function createOwebeeApi(options: {
  baseUrl: string;
  fetchImpl?: FetchImplementation;
  requestTimeoutMs?: number;
}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const requestTimeoutMs = options.requestTimeoutMs ?? 15_000;

  async function request(
    url: string,
    init: Omit<RequestInit, "signal">,
    unavailableMessage: string
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      return await fetchImpl(url, { ...init, signal: controller.signal });
    } catch {
      throw new WorkspaceApiError("unavailable", unavailableMessage);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function ensureSuccess(response: Response, unavailableMessage: string) {
    if (response.ok) return;

    if (response.status === 401 || response.status === 403) {
      throw new WorkspaceApiError(
        "unauthorized",
        "Сессия больше не действует."
      );
    }

    throw new WorkspaceApiError("unavailable", unavailableMessage);
  }

  return {
    async listRecentExpenses(
      session: WorkspaceSession
    ): Promise<ExpenseListPage> {
      const response = await request(
          `${baseUrl}/api/v1/trips/${encodeURIComponent(session.tripId)}/expenses?limit=5`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${session.token}`
            }
          },
          "Не удалось загрузить расходы. Проверьте соединение и попробуйте снова."
        );
      ensureSuccess(response, "Не удалось загрузить расходы. Попробуйте снова.");

      try {
        const payload: unknown = await response.json();
        if (!isExpenseListPage(payload)) {
          throw new Error("Invalid response");
        }
        return payload;
      } catch {
        throw new WorkspaceApiError(
          "invalid-response",
          "Сервис вернул неожиданный ответ. Попробуйте снова."
        );
      }
    },

    async listParticipants(
      session: WorkspaceSession
    ): Promise<ParticipantsPage> {
      const response = await request(
        `${baseUrl}/api/v1/trips/${encodeURIComponent(session.tripId)}/participants`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${session.token}`
          }
        },
        "Не удалось загрузить участников. Проверьте соединение."
      );
      ensureSuccess(
        response,
        "Не удалось загрузить участников. Попробуйте снова."
      );

      try {
        const payload: unknown = await response.json();
        if (
          !isParticipantsPage(payload) ||
          payload.tripId !== session.tripId
        ) {
          throw new Error("Invalid response");
        }
        return payload;
      } catch {
        throw new WorkspaceApiError(
          "invalid-response",
          "Сервис вернул некорректный список участников."
        );
      }
    },

    async listCurrencies(): Promise<CurrencyReference[]> {
      const response = await request(
        `${baseUrl}/api/v1/currencies`,
        { headers: { Accept: "application/json" } },
        "Не удалось загрузить валюты. Проверьте соединение."
      );
      ensureSuccess(response, "Не удалось загрузить валюты. Попробуйте снова.");

      try {
        const payload: unknown = await response.json();
        if (!isCurrenciesPayload(payload)) {
          throw new Error("Invalid response");
        }
        return payload.currencies;
      } catch {
        throw new WorkspaceApiError(
          "invalid-response",
          "Сервис вернул некорректный список валют."
        );
      }
    }
  };
}

function isExpenseListPage(value: unknown): value is ExpenseListPage {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return false;
  }

  if (value.nextCursor !== null && typeof value.nextCursor !== "string") {
    return false;
  }

  return value.items.every(isExpenseListItem);
}

function isExpenseListItem(value: unknown): value is ExpenseListItem {
  if (!isRecord(value) || !isRecord(value.payer)) {
    return false;
  }

  return (
    hasText(value, "id") &&
    hasText(value, "originalAmount") &&
    hasText(value, "originalCurrencyCode") &&
    hasText(value, "convertedAmount") &&
    hasText(value, "baseCurrencyCode") &&
    hasIsoDate(value, "expenseDate") &&
    hasText(value, "description") &&
    hasText(value.payer, "id") &&
    hasText(value.payer, "displayName")
  );
}

function isParticipantsPage(value: unknown): value is ParticipantsPage {
  if (
    !isRecord(value) ||
    !isUuid(value.tripId) ||
    !Array.isArray(value.members) ||
    !value.members.every(isParticipantReference) ||
    !Array.isArray(value.families) ||
    !value.families.every(isFamilyReference)
  ) {
    return false;
  }

  return (
    value.families.every((family) => family.tripId === value.tripId) &&
    hasUniqueValues(value.members.map((member) => member.id)) &&
    hasUniqueValues(value.families.map((family) => family.id))
  );
}

function isParticipantReference(value: unknown): value is ParticipantReference {
  return (
    isRecord(value) &&
    isUuid(value.id) &&
    hasText(value, "displayName") &&
    (value.email === null || typeof value.email === "string") &&
    (value.role === "owner" || value.role === "participant") &&
    (value.status === "active" || value.status === "archived")
  );
}

function isFamilyReference(value: unknown): value is FamilyReference {
  return (
    isRecord(value) &&
    isUuid(value.id) &&
    isUuid(value.tripId) &&
    hasText(value, "displayName") &&
    hasPositiveDecimal(value, "shareCount") &&
    value.status === "active"
  );
}

function isCurrenciesPayload(
  value: unknown
): value is { currencies: CurrencyReference[] } {
  if (
    !isRecord(value) ||
    !Array.isArray(value.currencies) ||
    !value.currencies.every(isCurrencyReference)
  ) {
    return false;
  }

  return hasUniqueValues(value.currencies.map((currency) => currency.code));
}

function isCurrencyReference(value: unknown): value is CurrencyReference {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    /^[A-Z]{3}$/.test(value.code) &&
    hasText(value, "displayName") &&
    (value.symbol === null || typeof value.symbol === "string") &&
    typeof value.minorUnits === "number" &&
    Number.isInteger(value.minorUnits) &&
    value.minorUnits >= 0 &&
    value.minorUnits <= 12
  );
}

function hasText(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string" && value[key].length > 0;
}

function hasPositiveDecimal(
  value: Record<string, unknown>,
  key: string
): boolean {
  const candidate = value[key];
  return (
    typeof candidate === "string" &&
    /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(candidate) &&
    /[1-9]/.test(candidate)
  );
}

function hasIsoDate(value: Record<string, unknown>, key: string): boolean {
  const candidate = value[key];
  if (
    typeof candidate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(candidate)
  ) {
    return false;
  }

  const date = new Date(`${candidate}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === candidate
  );
}

function hasUniqueValues(values: string[]): boolean {
  return new Set(values).size === values.length;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
