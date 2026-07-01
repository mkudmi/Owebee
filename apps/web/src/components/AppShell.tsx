import { useEffect, useState } from "react";
import type { ExpenseListItem } from "../api/owebee-api.js";
import type { WorkspaceSession } from "../app/session.js";

export type WorkspaceViewState =
  | { kind: "no-session" }
  | { kind: "loading"; session: WorkspaceSession }
  | { kind: "empty"; session: WorkspaceSession }
  | {
      kind: "ready";
      session: WorkspaceSession;
      expenses: ExpenseListItem[];
    }
  | { kind: "error"; session: WorkspaceSession; message: string };

export interface AppShellProps {
  state: WorkspaceViewState;
  onRetry(): void;
}

const navigation = [
  {
    label: "Обзор",
    href: "#overview",
    section: "overview",
    icon: OverviewIcon
  },
  {
    label: "Расходы",
    href: "#expenses",
    section: "expenses",
    icon: ExpensesIcon
  },
  { label: "Баланс", href: null, section: null, icon: BalanceIcon },
  { label: "Люди", href: null, section: null, icon: PeopleIcon }
] as const;

export function AppShell({ state, onRetry }: AppShellProps) {
  const session = state.kind === "no-session" ? null : state.session;
  const tripName = session?.tripName;
  const connectionStatus = getConnectionStatus(state);

  return (
    <div
      className={
        session ? "app-shell app-shell-authenticated" : "app-shell"
      }
    >
      <a className="skip-link" href="#main-content">
        Перейти к основному содержимому
      </a>

      <header className="app-header">
        <a className="brand" href="/" aria-label="Owebee — главная">
          <span className="brand-mark" aria-hidden="true">
            <BeeMark />
          </span>
          <span>Owebee</span>
        </a>
        {session ? (
          <div className="trip-context">
            <span className="trip-context-label">Текущая поездка</span>
            <strong>{tripName ?? "Название пока недоступно"}</strong>
          </div>
        ) : null}
        <div
          className={`connection-status connection-status-${connectionStatus.tone}`}
          aria-live="polite"
        >
          <span className="status-dot" aria-hidden="true" />
          {connectionStatus.label}
        </div>
      </header>

      {session ? <TripNavigation /> : null}

      <main id="main-content" className="workspace" tabIndex={-1}>
        {state.kind === "no-session" ? (
          <NoSessionState />
        ) : (
          <WorkspaceContent state={state} onRetry={onRetry} />
        )}
      </main>
    </div>
  );
}

function TripNavigation() {
  const [activeSection, setActiveSection] = useState(readActiveSection);

  useEffect(() => {
    const updateActiveSection = () => setActiveSection(readActiveSection());
    window.addEventListener("hashchange", updateActiveSection);
    return () => window.removeEventListener("hashchange", updateActiveSection);
  }, []);

  return (
    <nav className="trip-navigation" aria-label="Навигация по поездке">
      <ul>
        {navigation.map((item) => {
          const Icon = item.icon;
          const isAvailable = item.href !== null && item.section !== null;
          const isActive = isAvailable && item.section === activeSection;

          return (
            <li key={item.label}>
              {isAvailable ? (
                <a
                  className={isActive ? "nav-link nav-link-active" : "nav-link"}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon />
                  <span>{item.label}</span>
                </a>
              ) : (
                <span
                  className="nav-link nav-link-disabled"
                  aria-disabled="true"
                  aria-label={`${item.label} — пока недоступно`}
                >
                  <Icon />
                  <span>{item.label}</span>
                  <span className="nav-availability">Скоро</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function readActiveSection(): "overview" | "expenses" {
  return activeSectionFromHash(
    typeof window === "undefined" ? "" : window.location.hash
  );
}

export function activeSectionFromHash(
  hash: string
): "overview" | "expenses" {
  if (hash === "#expenses") {
    return "expenses";
  }

  return "overview";
}

function getConnectionStatus(state: WorkspaceViewState): {
  label: string;
  tone: "success" | "neutral" | "error";
} {
  switch (state.kind) {
    case "ready":
    case "empty":
      return { label: "На связи", tone: "success" };
    case "loading":
      return { label: "Подключаемся", tone: "neutral" };
    case "error":
      return { label: "Ошибка загрузки", tone: "error" };
    case "no-session":
      return { label: "Нужен вход", tone: "neutral" };
  }
}

function NoSessionState() {
  return (
    <section className="welcome-panel" aria-labelledby="welcome-title">
      <div className="welcome-art" aria-hidden="true">
        <span className="honey-cell honey-cell-one" />
        <span className="honey-cell honey-cell-two" />
        <span className="honey-cell honey-cell-three" />
        <BeeMark />
      </div>
      <p className="eyebrow">Ваши общие расходы — без таблиц</p>
      <h1 id="welcome-title">Откройте свою поездку</h1>
      <p className="welcome-copy">
        Войдите или перейдите по ссылке приглашения, чтобы увидеть расходы,
        участников и общий баланс.
      </p>
      <div className="welcome-actions" aria-label="Доступ к поездке">
        <span className="button button-primary" aria-disabled="true">
          Войти
        </span>
        <span className="future-note">
          Экран входа подключается следующим UI-срезом
        </span>
      </div>
    </section>
  );
}

function WorkspaceContent({
  state,
  onRetry
}: {
  state: Exclude<WorkspaceViewState, { kind: "no-session" }>;
  onRetry(): void;
}) {
  const tripName = state.session.tripName ?? "Обзор поездки";

  return (
    <>
      <section className="workspace-heading" id="overview">
        <div>
          <p className="eyebrow">Обзор поездки</p>
          <h1>{tripName}</h1>
          <p className="heading-copy">
            Расходы, люди и баланс собраны в одном спокойном месте.
          </p>
        </div>
        <div className="brand-accent" aria-hidden="true">
          <BeeMark />
        </div>
      </section>

      <section
        className="overview-grid"
        id="expenses"
        aria-labelledby="expenses-title"
      >
        <div className="section-heading">
          <div>
            <p className="section-kicker">Последние операции</p>
            <h2 id="expenses-title">Расходы</h2>
          </div>
          <span className="section-meta">Показываем последние 5</span>
        </div>

        {state.kind === "loading" ? <LoadingState /> : null}
        {state.kind === "empty" ? <EmptyState /> : null}
        {state.kind === "error" ? (
          <ErrorState message={state.message} onRetry={onRetry} />
        ) : null}
        {state.kind === "ready" ? (
          <ExpenseList expenses={state.expenses} />
        ) : null}
      </section>

      <aside className="coming-next" aria-labelledby="next-title">
        <span className="coming-next-icon" aria-hidden="true">
          <SparkIcon />
        </span>
        <div>
          <p className="section-kicker">Дальше в Sprint 5</p>
          <h2 id="next-title">Быстрое добавление расходов</h2>
          <p>
            Mobile-first форма и надёжное сохранение без сети появятся в
            следующей story.
          </p>
        </div>
      </aside>
    </>
  );
}

function LoadingState() {
  return (
    <div className="state-card loading-state" aria-busy="true">
      <span className="loading-mark" aria-hidden="true" />
      <div>
        <strong>Загружаем расходы</strong>
        <p>Сохраняем страницу устойчивой, пока данные едут с сервера.</p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="state-card empty-state">
      <span className="empty-icon" aria-hidden="true">
        <ReceiptIcon />
      </span>
      <div>
        <h3>Расходов пока нет</h3>
        <p>Первый расход появится здесь вместе с плательщиком и суммой.</p>
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry
}: {
  message: string;
  onRetry(): void;
}) {
  return (
    <div className="state-card error-state" role="alert">
      <span className="error-icon" aria-hidden="true">
        !
      </span>
      <div>
        <h3>Расходы не загрузились</h3>
        <p>{message}</p>
        <button className="button button-secondary" type="button" onClick={onRetry}>
          Попробовать снова
        </button>
      </div>
    </div>
  );
}

function ExpenseList({ expenses }: { expenses: ExpenseListItem[] }) {
  return (
    <ul className="expense-list" aria-label="Последние расходы">
      {expenses.map((expense) => (
        <li className="expense-row" key={expense.id}>
          <span className="expense-icon" aria-hidden="true">
            <ReceiptIcon />
          </span>
          <div className="expense-main">
            <strong>{expense.description}</strong>
            <span>
              Плательщик: {expense.payer.displayName} ·{" "}
              {formatExpenseDate(expense.expenseDate)}
            </span>
          </div>
          <div className="expense-amount">
            <strong>
              {expense.originalAmount} {expense.originalCurrencyCode}
            </strong>
            {expense.originalCurrencyCode !== expense.baseCurrencyCode ? (
              <span>
                {expense.convertedAmount} {expense.baseCurrencyCode}
              </span>
            ) : (
              <span>Сохранено</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatExpenseDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}

function IconFrame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function OverviewIcon() {
  return (
    <IconFrame>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </IconFrame>
  );
}

function ExpensesIcon() {
  return (
    <IconFrame>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />
    </IconFrame>
  );
}

function BalanceIcon() {
  return (
    <IconFrame>
      <path d="M12 3v18M5 7h14M6 7l-3 6h6zM18 7l-3 6h6zM8 21h8" />
    </IconFrame>
  );
}

function PeopleIcon() {
  return (
    <IconFrame>
      <path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM17 11a3 3 0 0 0 0-6M21 20v-2a4 4 0 0 0-3-3.87" />
    </IconFrame>
  );
}

function ReceiptIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M6.5 3.5h11v17l-2.75-1.8L12 20.5l-2.75-1.8-2.75 1.8v-17Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 8h6M9 12h4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2l1.5 6.5L20 10l-6.5 1.5L12 18l-1.5-6.5L4 10l6.5-1.5L12 2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M19 16v5M16.5 18.5h5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function BeeMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" fill="none">
      <path
        d="M14 20c-5-1-8-4-8-8 6-1 11 1 14 6M34 20c5-1 8-4 8-8-6-1-11 1-14 6"
        fill="#FFF7D6"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M24 14c7 0 12 6 12 14S31 42 24 42 12 36 12 28s5-14 12-14Z"
        fill="#F4B942"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M13 25h22M13 32h22" stroke="currentColor" strokeWidth="3" />
      <path d="M20 14l-3-5M28 14l3-5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
