import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  createDefaultExpenseDraft,
  type ExpenseDraft,
  type ExpenseDraftField
} from "../offline/expense-draft.js";
import type { WorkspaceReferenceSnapshot } from "../offline/workspace-reference-cache.js";
import { ExpenseForm } from "./ExpenseForm.js";

const references: WorkspaceReferenceSnapshot = {
  tripId: "trip-1",
  members: [
    { id: "member-1", displayName: "Елена", role: "participant" },
    { id: "member-2", displayName: "Иван", role: "participant" }
  ],
  families: [
    { id: "family-1", displayName: "Семья Ивановых", shareCount: "2" }
  ],
  currencies: [
    {
      code: "RUB",
      displayName: "Российский рубль",
      symbol: "₽",
      minorUnits: 2
    },
    { code: "EUR", displayName: "Евро", symbol: "€", minorUnits: 2 }
  ],
  updatedAt: "2026-07-01T10:00:00.000Z"
};

function render(options: {
  draft?: ExpenseDraft;
  saving?: boolean;
  storageError?: string | null;
  errors?: Partial<Record<ExpenseDraftField, string>>;
} = {}) {
  return renderToStaticMarkup(
    <ExpenseForm
      draft={
        options.draft ??
        createDefaultExpenseDraft(references, "2026-07-02")
      }
      references={references}
      errors={options.errors ?? {}}
      storageError={options.storageError ?? null}
      saving={options.saving ?? false}
      onChange={vi.fn()}
      onToggleTarget={vi.fn()}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
    />
  );
}

describe("ExpenseForm", () => {
  it("renders a page form with persistent labels and safe defaults", () => {
    const html = render();

    expect(html).toContain('id="expense-form-title">Добавить расход</h1>');
    expect(html).toContain('for="expense-amount"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('autofocus=""');
    expect(html).toContain('value="2026-07-02"');
    expect(html).toContain('<option value="RUB" selected="">');
    expect(html).toContain('<option value="member-1" selected="">');
    expect(html.match(/checked=""/g)).toHaveLength(3);
    expect(html).toContain("<strong>Семья Ивановых</strong>");
    expect(html).toContain("<span>Семья · 2 доли</span>");
  });

  it("keeps entered values and exposes an accessible error summary", () => {
    const html = render({
      draft: {
        ...createDefaultExpenseDraft(references, "2026-07-02"),
        amount: "48,20",
        description: "Ужин"
      },
      storageError:
        "Не удалось сохранить расход на этом устройстве. Данные формы не потеряны.",
      errors: { amount: "Проверьте сумму." }
    });

    expect(html).toContain('role="alert"');
    expect(html).toContain("Данные формы не потеряны");
    expect(html).toContain('value="48,20"');
    expect(html).toContain('value="Ужин"');
    expect(html).toContain('href="#expense-amount"');
  });

  it("disables duplicate actions while durable storage is pending", () => {
    const html = render({
      draft: {
        ...createDefaultExpenseDraft(references, "2026-07-02"),
        amount: "48.20",
        description: "Ужин"
      },
      saving: true
    });

    expect(html).toContain("Сохраняем на устройстве…");
    expect(html).toMatch(
      /<input(?=[^>]*name="amount")(?=[^>]*disabled="")[^>]*>/
    );
    expect(html).toMatch(
      /<select(?=[^>]*name="currencyCode")(?=[^>]*disabled="")[^>]*>/
    );
    expect(html).toMatch(
      /<input(?=[^>]*name="description")(?=[^>]*disabled="")[^>]*>/
    );
    expect(html).toContain('<fieldset id="expense-split"');
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThan(8);
  });

  it("drops cleared errors and links remaining errors to their controls", () => {
    const cleared = render({ errors: { amount: undefined } });
    const invalid = render({
      errors: {
        currencyCode: "Выберите валюту.",
        payerMemberId: "Выберите плательщика.",
        splitTargets: "Выберите участников."
      }
    });

    expect(cleared).not.toContain('role="alert"');
    expect(invalid).toContain(
      'aria-describedby="expense-currency-error"'
    );
    expect(invalid).toContain('aria-describedby="expense-payer-error"');
    expect(invalid).toContain('href="#expense-split"');
    expect(invalid).toContain('<fieldset id="expense-split"');
  });
});
