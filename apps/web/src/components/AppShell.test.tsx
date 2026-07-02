import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  activeSectionFromHash,
  AppShell,
  type WorkspaceViewState
} from "./AppShell.js";
import type { ExpenseCreateMutation } from "../offline/outbox.js";
import type { WorkspaceReferenceSnapshot } from "../offline/workspace-reference-cache.js";

const session = {
  version: 1 as const,
  tripId: "trip-1",
  token: "must-never-render",
  tripName: "Georgia 2026"
};

function render(state: WorkspaceViewState) {
  return renderToStaticMarkup(
    <AppShell state={state} onRetry={vi.fn()} />
  );
}

describe("AppShell", () => {
  it("derives the active implemented section from the URL hash", () => {
    expect(activeSectionFromHash("#expenses")).toBe("expenses");
    expect(activeSectionFromHash("#overview")).toBe("overview");
    expect(activeSectionFromHash("#people")).toBe("overview");
  });

  it("renders the semantic shell and stable trip navigation order", () => {
    const html = render({ kind: "empty", session });

    expect(html).toContain('href="#main-content"');
    expect(html).toContain('aria-label="Навигация по поездке"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain('href="#balance"');
    expect(html).not.toContain('href="#people"');
    expect(html).toContain('aria-label="Баланс — пока недоступно"');
    expect(html).toContain('aria-label="Люди — пока недоступно"');
    expect(html).toContain("Georgia 2026");
    expect(html).not.toContain(session.token);

    const labels = ["Обзор", "Расходы", "Баланс", "Люди"];
    const positions = labels.map((label) => html.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("renders an honest no-session state without fictional trip data", () => {
    const html = render({ kind: "no-session" });

    expect(html).toContain("Откройте свою поездку");
    expect(html).toContain("Войдите или перейдите по ссылке приглашения");
    expect(html).not.toContain("Georgia 2026");
    expect(html).not.toContain("₽");
  });

  it("renders a labelled loading state", () => {
    const html = render({ kind: "loading", session });

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Загружаем расходы");
  });

  it("renders a useful empty state", () => {
    const html = render({ kind: "empty", session });

    expect(html).toContain("Расходов пока нет");
    expect(html).toContain("Первый расход появится здесь");
  });

  it("does not invent a trip name when the session has none", () => {
    const html = render({
      kind: "empty",
      session: { version: 1, tripId: "trip-1", token: "secret" }
    });

    expect(html).toContain("Название пока недоступно");
    expect(html).toContain("Обзор поездки");
    expect(html).not.toContain("Моя поездка");
  });

  it("renders a recoverable error with retry", () => {
    const html = render({
      kind: "error",
      session,
      message: "Не удалось загрузить расходы."
    });

    expect(html).toContain('role="alert"');
    expect(html).toContain("Не удалось загрузить расходы.");
    expect(html).toContain("Попробовать снова");
    expect(html).toContain("Ошибка загрузки");
    expect(html).not.toContain("На связи");
  });

  it("renders real expense summary fields without a bare signed balance", () => {
    const html = render({
      kind: "ready",
      session,
      expenses: [
        {
          id: "expense-1",
          payer: { id: "member-1", displayName: "Елена" },
          originalAmount: "48.20",
          originalCurrencyCode: "EUR",
          convertedAmount: "4458.50",
          baseCurrencyCode: "RUB",
          expenseDate: "2026-07-01",
          description: "Ужин"
        }
      ]
    });

    expect(html).toContain("Ужин");
    expect(html).toContain("48.20 EUR");
    expect(html).toContain("Плательщик: Елена");
    expect(html).toContain("1 июля 2026 г.");
  });

  it("keeps pending local expenses in the normal list with a non-color status", () => {
    const pending: ExpenseCreateMutation = {
      clientMutationId: "local-expense-1",
      tripId: "trip-1",
      type: "expense.create",
      createdAt: "2026-07-01T10:00:00.000Z",
      status: "pending",
      payload: {
        payerMemberId: "member-1",
        amount: "48.20",
        currencyCode: "EUR",
        expenseDate: "2026-07-01",
        description: "Ужин offline",
        splitTargets: [{ type: "member", id: "member-1" }]
      }
    };
    const references: WorkspaceReferenceSnapshot = {
      tripId: "trip-1",
      members: [
        { id: "member-1", displayName: "Елена", role: "participant" }
      ],
      families: [],
      currencies: [
        { code: "EUR", displayName: "Евро", symbol: "€", minorUnits: 2 }
      ],
      updatedAt: "2026-07-01T10:00:00.000Z"
    };
    const html = renderToStaticMarkup(
      <AppShell
        state={{ kind: "empty", session }}
        onRetry={vi.fn()}
        pendingExpenses={[pending]}
        references={references}
        onOpenExpenseForm={vi.fn()}
      />
    );

    expect(html).toContain('aria-label="Последние расходы"');
    expect(html).toContain("Ужин offline");
    expect(html).toContain("48.20 EUR");
    expect(html).toContain("Плательщик: Елена");
    expect(html).toContain("Ожидает синхронизации");
    expect(html).toContain(
      "1 локальное изменение ещё не включено в серверный баланс"
    );
    expect(html).not.toContain("Расходов пока нет");
  });

  it("offers expense creation only when cached references are available", () => {
    const references: WorkspaceReferenceSnapshot = {
      tripId: "trip-1",
      members: [
        { id: "member-1", displayName: "Елена", role: "participant" }
      ],
      families: [],
      currencies: [
        { code: "RUB", displayName: "Рубль", symbol: "₽", minorUnits: 2 }
      ],
      updatedAt: "2026-07-01T10:00:00.000Z"
    };
    const available = renderToStaticMarkup(
      <AppShell
        state={{ kind: "empty", session }}
        onRetry={vi.fn()}
        references={references}
        onOpenExpenseForm={vi.fn()}
      />
    );
    const unavailable = render({ kind: "empty", session });

    expect(available).toContain("Добавить расход");
    expect(unavailable).toContain(
      "Подключитесь к сети один раз, чтобы загрузить участников и валюты"
    );
  });

  it("keeps pending payer identity and warns when local outbox reading fails", () => {
    const payerMemberId = "00000000-0000-0000-0000-000000000010";
    const pending: ExpenseCreateMutation = {
      clientMutationId: "00000000-0000-0000-0000-000000000001",
      tripId: "00000000-0000-0000-0000-000000000100",
      type: "expense.create",
      createdAt: "2026-07-01T10:00:00.000Z",
      status: "pending",
      payload: {
        payerMemberId,
        amount: "48.20",
        currencyCode: "EUR",
        expenseDate: "2026-07-01",
        description: "Ужин offline",
        splitTargets: [{ type: "member", id: payerMemberId }]
      }
    };
    const html = renderToStaticMarkup(
      <AppShell
        state={{ kind: "empty", session }}
        onRetry={vi.fn()}
        pendingExpenses={[pending]}
        localReadError="Не удалось прочитать локально сохранённые расходы."
      />
    );

    expect(html).toContain(`Плательщик: ID ${payerMemberId}`);
    expect(html).toContain("Не удалось прочитать локально сохранённые расходы.");
    expect(html).toContain("Проверить снова");
  });
});
