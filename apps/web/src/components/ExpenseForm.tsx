import { useEffect, useRef } from "react";
import type {
  ExpenseDraft,
  ExpenseDraftField
} from "../offline/expense-draft.js";
import type { WorkspaceReferenceSnapshot } from "../offline/workspace-reference-cache.js";

export interface ExpenseFormProps {
  draft: ExpenseDraft;
  references: WorkspaceReferenceSnapshot;
  errors: Partial<Record<ExpenseDraftField, string>>;
  storageError: string | null;
  saving: boolean;
  onChange(
    field: Exclude<keyof ExpenseDraft, "selectedTargetKeys">,
    value: string
  ): void;
  onToggleTarget(key: string): void;
  onCancel(): void;
  onSubmit(): void;
}

export function ExpenseForm({
  draft,
  references,
  errors,
  storageError,
  saving,
  onChange,
  onToggleTarget,
  onCancel,
  onSubmit
}: ExpenseFormProps) {
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const summaryErrors = [
    ...(storageError
      ? [{ field: "expense-form", message: storageError }]
      : []),
    ...Object.entries(errors).flatMap(([field, message]) =>
      typeof message === "string"
        ? [{ field: fieldId(field as ExpenseDraftField), message }]
        : []
    )
  ];

  useEffect(() => {
    if (summaryErrors.length > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [errors, storageError, summaryErrors.length]);

  return (
    <section className="expense-form-page" aria-labelledby="expense-form-title">
      <header className="expense-form-header">
        <button
          className="text-button"
          type="button"
          onClick={onCancel}
          disabled={saving}
        >
          Отмена
        </button>
        <div>
          <p className="section-kicker">Новый расход</p>
          <h1 id="expense-form-title">Добавить расход</h1>
        </div>
      </header>

      <form
        id="expense-form"
        className="expense-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        noValidate
      >
        {summaryErrors.length > 0 ? (
          <div
            ref={errorSummaryRef}
            className="form-error-summary"
            role="alert"
            tabIndex={-1}
          >
            <strong>Проверьте расход</strong>
            <ul>
              {summaryErrors.map((error) => (
                <li key={`${error.field}:${error.message}`}>
                  {error.field === "expense-form" ? (
                    error.message
                  ) : (
                    <a href={`#${error.field}`}>{error.message}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="form-field">
          <label htmlFor="expense-amount">Сумма и валюта</label>
          <div className="amount-currency-field">
            <input
              id="expense-amount"
              name="amount"
              className="amount-input"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              disabled={saving}
              value={draft.amount}
              onChange={(event) => onChange("amount", event.target.value)}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? "expense-amount-error" : undefined}
            />
            <select
              id="expense-currency"
              name="currencyCode"
              aria-label="Валюта"
              disabled={saving}
              value={draft.currencyCode}
              onChange={(event) =>
                onChange("currencyCode", event.target.value)
              }
              aria-invalid={Boolean(errors.currencyCode)}
              aria-describedby={
                errors.currencyCode ? "expense-currency-error" : undefined
              }
            >
              {references.currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} {currency.symbol ?? ""} ·{" "}
                  {currency.displayName}
                </option>
              ))}
            </select>
          </div>
          <FieldError id="expense-amount-error" message={errors.amount} />
          <FieldError
            id="expense-currency-error"
            message={errors.currencyCode}
          />
        </div>

        <div className="form-field">
          <label htmlFor="expense-description">Описание</label>
          <input
            id="expense-description"
            name="description"
            maxLength={500}
            disabled={saving}
            value={draft.description}
            onChange={(event) =>
              onChange("description", event.target.value)
            }
            aria-invalid={Boolean(errors.description)}
            aria-describedby={
              errors.description ? "expense-description-error" : undefined
            }
          />
          <FieldError
            id="expense-description-error"
            message={errors.description}
          />
        </div>

        <div className="form-pair">
          <div className="form-field">
            <label htmlFor="expense-payer">Кто платил</label>
            <select
              id="expense-payer"
              name="payerMemberId"
              disabled={saving}
              value={draft.payerMemberId}
              onChange={(event) =>
                onChange("payerMemberId", event.target.value)
              }
              aria-invalid={Boolean(errors.payerMemberId)}
              aria-describedby={
                errors.payerMemberId ? "expense-payer-error" : undefined
              }
            >
              {references.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
            <FieldError
              id="expense-payer-error"
              message={errors.payerMemberId}
            />
          </div>

          <div className="form-field">
            <label htmlFor="expense-date">Дата</label>
            <input
              id="expense-date"
              name="expenseDate"
              type="date"
              disabled={saving}
              value={draft.expenseDate}
              onChange={(event) =>
                onChange("expenseDate", event.target.value)
              }
              aria-invalid={Boolean(errors.expenseDate)}
              aria-describedby={
                errors.expenseDate ? "expense-date-error" : undefined
              }
            />
            <FieldError
              id="expense-date-error"
              message={errors.expenseDate}
            />
          </div>
        </div>

        <fieldset
          id="expense-split"
          className="split-fieldset"
          disabled={saving}
          aria-describedby={
            errors.splitTargets ? "expense-split-error" : "split-help"
          }
        >
          <legend>Между кем разделить</legend>
          <p id="split-help" className="field-help">
            По умолчанию выбраны все активные участники и семьи.
          </p>
          <div className="target-list">
            {references.members.map((member) => (
              <TargetCheckbox
                key={`member:${member.id}`}
                targetKey={`member:${member.id}`}
                label={member.displayName}
                meta="Участник · 1 доля"
                checked={draft.selectedTargetKeys.includes(
                  `member:${member.id}`
                )}
                onToggle={onToggleTarget}
                disabled={saving}
              />
            ))}
            {references.families.map((family) => (
              <TargetCheckbox
                key={`family:${family.id}`}
                targetKey={`family:${family.id}`}
                label={family.displayName}
                meta={`Семья · ${family.shareCount} доли`}
                checked={draft.selectedTargetKeys.includes(
                  `family:${family.id}`
                )}
                onToggle={onToggleTarget}
                disabled={saving}
              />
            ))}
          </div>
          <FieldError
            id="expense-split-error"
            message={errors.splitTargets}
          />
        </fieldset>

        <div className="offline-save-note">
          <ClockIcon />
          <span>
            Сначала сохраним на этом устройстве. Синхронизация начнётся, когда
            соответствующая функция будет подключена.
          </span>
        </div>

        <div className="expense-form-actions">
          <button
            className="button button-primary form-submit"
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Сохраняем на устройстве…"
              : submitLabel(draft.amount, draft.currencyCode)}
          </button>
        </div>
      </form>
    </section>
  );
}

function TargetCheckbox({
  targetKey,
  label,
  meta,
  checked,
  onToggle,
  disabled
}: {
  targetKey: string;
  label: string;
  meta: string;
  checked: boolean;
  onToggle(key: string): void;
  disabled: boolean;
}) {
  return (
    <label className="target-option">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => onToggle(targetKey)}
      />
      <span className="target-copy">
        <strong>{label}</strong>
        <span>{meta}</span>
      </span>
    </label>
  );
}

function FieldError({
  id,
  message
}: {
  id: string;
  message: string | undefined;
}) {
  return message ? (
    <span id={id} className="field-error">
      {message}
    </span>
  ) : null;
}

function submitLabel(amount: string, currency: string) {
  const normalized = amount.trim();
  return normalized
    ? `Добавить ${normalized} ${currency}`
    : "Добавить расход";
}

function fieldId(field: ExpenseDraftField) {
  const ids: Record<ExpenseDraftField, string> = {
    amount: "expense-amount",
    currencyCode: "expense-currency",
    expenseDate: "expense-date",
    description: "expense-description",
    payerMemberId: "expense-payer",
    splitTargets: "expense-split"
  };
  return ids[field];
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
