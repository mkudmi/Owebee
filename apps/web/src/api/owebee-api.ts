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

  return {
    async listRecentExpenses(
      session: WorkspaceSession
    ): Promise<ExpenseListPage> {
      let response: Response;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

      try {
        response = await fetchImpl(
          `${baseUrl}/api/v1/trips/${encodeURIComponent(session.tripId)}/expenses?limit=5`,
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${session.token}`
            },
            signal: controller.signal
          }
        );
      } catch {
        throw new WorkspaceApiError(
          "unavailable",
          "Не удалось загрузить расходы. Проверьте соединение и попробуйте снова."
        );
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new WorkspaceApiError(
            "unauthorized",
            "Сессия больше не действует."
          );
        }

        throw new WorkspaceApiError(
          "unavailable",
          "Не удалось загрузить расходы. Попробуйте снова."
        );
      }

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

function hasText(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string" && value[key].length > 0;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
