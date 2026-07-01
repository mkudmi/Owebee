---
baseline_commit: da49696195d8c62d27a42439c48a7a4688b648c0
---

# Каркас продуктового UI и workspace поездки

- **ID:** STORY-024
- **Epic:** Technical Foundation / Sprint 5 UI Enablement
- **Priority:** Must Have
- **Story Points:** 3
- **Status:** done

## User Story

Как **участник поездки**,  
я хочу **открыть понятный responsive workspace с реальными состояниями загрузки и расходов**,  
чтобы **перейти от технической заглушки к продуктовой работе в Owebee**.

## Acceptance Criteria

1. Приложение вместо placeholder-экрана показывает app shell с skip-link, заголовком поездки и навигацией Overview / Expenses / Balance / People; активный пункт имеет `aria-current="page"`.
2. При ширине 320–767px навигация закреплена снизу, от 768px становится левой rail; основной контент не требует горизонтальной прокрутки, а интерактивные targets имеют высоту не менее 48px на mobile.
3. Клиент читает версионированную session-конфигурацию из browser storage, не отображает и не логирует bearer token и при валидной сессии загружает последние расходы через `GET /api/v1/trips/:tripId/expenses`.
4. Workspace различает состояния: сессия отсутствует, загрузка, пустой список, успешный список и recoverable API error с Retry. Интерфейс не показывает вымышленные поездки, суммы или участников.
5. Expense rows показывают description, исходную сумму/валюту, payer и дату. Financial text использует tabular numerals; состояния не передаются только цветом.
6. Визуальный слой использует токены `DESIGN.md`: фон, поверхности, cobalt primary, honey brand accent, border/focus contracts, mobile/desktop typography и spacing.
7. Unit/component tests покрывают session parsing, API authorization/error handling и server-rendered accessibility/state contracts. `pnpm check` проходит без регрессий.

## Tasks / Subtasks

- [x] Task 1: Реализовать session bootstrap и API client (AC: 3, 4)
  - [x] RED: добавить тесты валидной/повреждённой session-конфигурации, отсутствующей сессии, bearer request и structured API error.
  - [x] GREEN: добавить versioned session store и typed expense-list client без логирования token.
  - [x] REFACTOR: отделить browser adapters от чистого parsing/loading contract.
- [x] Task 2: Реализовать semantic app shell и состояния workspace (AC: 1, 4, 5)
  - [x] RED: добавить server-render tests для skip-link, navigation order, `aria-current`, no-session, loading, empty, error и populated states.
  - [x] GREEN: добавить `App`, `AppShell`, expense summary rows и Retry action.
  - [x] REFACTOR: сохранить один DOM order header/navigation/main независимо от responsive placement.
- [x] Task 3: Применить responsive visual contract (AC: 2, 6)
  - [x] Перенести канонические design tokens в CSS custom properties.
  - [x] Реализовать mobile bottom navigation, desktop rail, max-width shell, focus ring, reduced-motion и forced-colors safeguards.
  - [x] Проверить 320px и 1440px без перекрытий и горизонтального scroll.
- [x] Task 4: Интегрировать entry point и пройти quality gates (AC: 1-7)
  - [x] Подключить новый `App` из `main.tsx`, сохранив `StrictMode`.
  - [x] Запустить focused tests, полный `pnpm check` и production build.
  - [x] Выполнить browser smoke-check состояний no-session и responsive shell.

### Review Findings

- [x] [Review][Patch] Оставить `Обзор` и `Расходы` рабочими якорями с корректным текущим состоянием; `Баланс` и `Люди` показывать явно недоступными до реализации [apps/web/src/components/AppShell.tsx:20]
- [x] [Review][Patch] Не подставлять вымышленное название `Моя поездка`, когда опциональный `tripName` отсутствует [apps/web/src/components/AppShell.tsx:29]
- [x] [Review][Patch] Валидировать `expenseDate` до передачи данных в render, чтобы некорректный успешный API-ответ не вызывал `RangeError` [apps/web/src/api/owebee-api.ts:120]
- [x] [Review][Patch] Защитить state от перезаписи устаревшим результатом параллельного запроса [apps/web/src/app/App.tsx:36]
- [x] [Review][Patch] Ограничить время ожидания fetch, чтобы зависший запрос переходил в recoverable error с Retry [apps/web/src/api/owebee-api.ts:56]
- [x] [Review][Patch] Не показывать статус `На связи` при loading и подтверждённой API/network error [apps/web/src/components/AppShell.tsx:54]
- [x] [Review][Patch] Заменить гендерно-зависимое `Оплатила` на нейтральную подпись плательщика [apps/web/src/components/AppShell.tsx:245]
- [x] [Review][Patch] Обеспечить skip-link минимальную высоту interactive target 48px на mobile [apps/web/src/styles.css:77]
- [x] [Review][Patch] Применить mobile/desktop typography tokens из `DESIGN.md` к page и section headings [apps/web/src/styles.css:321]
- [x] [Review][Patch] Добавить обязательный тест безопасной обработки HTTP 500 [apps/web/src/api/owebee-api.test.ts:64]
- [x] [Review][Patch] Переместить новые `App` entry-компоненты в разрешённый каталог `apps/web/src/app` [apps/web/src/app/App.tsx:21]

## Dev Notes

### Current State

- `apps/web/src/main.tsx` содержит единственный статический intro-screen.
- `apps/web/src/styles.css` оформляет только placeholder.
- React 19.1, TypeScript 5.9, Vite 7.1 и Vitest 3.2 уже установлены.
- `ExpenseService.listExpenses` возвращает `{ items, nextCursor }`; endpoint требует bearer session и поддерживает registered/guest actors.
- API не имеет trip-details/list-participants endpoint. Не выдумывать такой contract и не добавлять backend scope в эту story.
- `apps/web/src/offline/outbox.ts` и его тесты должны остаться без изменений.

### Implementation Contract

- Session storage key: `owebee.session.v1`.
- Stored object: `{ version: 1, tripId, token, tripName? }`; все обязательные строки после trim должны быть непустыми.
- Повреждённое/устаревшее значение трактуется как отсутствие сессии и удаляется из storage.
- API base URL: `import.meta.env.VITE_API_BASE_URL`, fallback `http://localhost:4000`.
- Fetch: `GET /api/v1/trips/{encodeURIComponent(tripId)}/expenses?limit=5`, header `Authorization: Bearer <token>`.
- Non-2xx response преобразуется в безопасный UI error; server message/token/body целиком пользователю не показывать.
- Не добавлять router/query/component library. Для первой вертикали достаточно native History/URL path или одного Overview surface; зависимости требуют отдельного согласования.

### UX Guardrails

- DOM order: skip-link → header → nav → main.
- Mobile trip navigation: Overview, Expenses, Balance, People; desktop сохраняет тот же порядок.
- Active navigation: icon + label + shape/color + `aria-current`.
- Focus: 2px white gap и 3px dark outer ring.
- Не использовать bare signed balance, placeholder-only labels или цвет как единственный status signal.
- Cached/offline work относится к STORY-016/017; эта story не имитирует pending data.
- No-session copy должна направлять к sign-in/invite flow без ложного утверждения, что эти экраны уже реализованы.

### Architecture and Scope Guardrails

- Сохранить React + TypeScript + Vite и существующий pnpm workspace.
- Не менять API, schema, outbox, auth token lifecycle и финансовые расчёты.
- Не хранить token в URL, DOM, error text или console.
- Не показывать demo financial data как реальные данные.
- Новые файлы размещать внутри `apps/web/src/app`, `apps/web/src/api` и `apps/web/src/components`.
- Компоненты тестировать через установленный `react-dom/server`; новые dependencies не нужны.

### Testing Requirements

- Session parser: absent, valid, malformed JSON, wrong version, empty values.
- API client: encoded trip ID, bearer header, successful DTO mapping, 401/500 safe errors, network failure.
- Render: skip-link, landmark/nav labels, navigation order, active item, no-session, loading, empty, error+Retry, populated expense.
- Quality: `pnpm --filter @owebee/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- Manual/browser: 320px and 1440px, keyboard focus, no horizontal scroll.

### Latest Technical Notes

- Использовать установленную major-линию, не обновлять зависимости в story: официальный React reference описывает client APIs и purity/rules; официальный Vite guide подтверждает Vite как dev/build tool и требования современных Node/browser targets; официальный Vitest guide документирует текущую major-линию, но проект остаётся на зафиксированном Vitest 3 до отдельного upgrade.

### References

- [Source: `_bmad-output/implementation-artifacts/sprint-plan.md` — Sprint 5 / STORY-024]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — React PWA Client, Technology Stack, NFR-007]
- [Source: `_bmad-output/planning-artifacts/prd.md` — User Experience Requirements, UI-001…UI-004]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Owebee-2026-06-30/DESIGN.md` — tokens, layout, components]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Owebee-2026-06-30/EXPERIENCE.md` — IA, App shell, Accessibility, Responsive]
- [Source: `apps/api/src/expenses/expense-routes.ts`]
- [Source: `apps/api/src/expenses/expense-service.ts`]
- [Source: `apps/web/src/main.tsx`]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- Test-first session/API boundary.
- Test-first semantic view states.
- Responsive CSS contract and browser verification.
- Full repository quality gates before review.

### Debug Log References

- Create-story discovery: PRD (1), architecture (1), canonical UX index (1), DESIGN/EXPERIENCE (2), mockups (3), Sprint 5 plan (1), prior story/sync context and current web/API source.
- Dev-story start: baseline `da49696195d8c62d27a42439c48a7a4688b648c0`; tracking remains in the enabler story because `STORY-024` is intentionally outside the PRD-only `development_status`.
- Task 1 RED: web tests failed on absent session/API modules; GREEN: 14 web tests and full 92-test workspace regression pass.
- Task 2 RED: component suite failed on absent `AppShell`; GREEN: six semantic state tests pass and full 98-test workspace regression remains green.
- Task 4 RED: App integration suite failed on absent entry component; GREEN: 22 web tests pass.
- Browser QA: 320×800 and 1440×900 report exact viewport-width layout with no horizontal overflow; no console warnings/errors.
- Final regression: `pnpm check` passes typecheck, lint, 100 tests (22 web, 76 API, 2 config), API coverage gate and all production builds.
- Code review: устранены все 11 findings; добавлены строгая date validation, request timeout, stale-response guard и честные navigation/connectivity states.
- Review browser QA: 320×800 и 1440×900 без horizontal overflow; page-title tokens 28px/40px, mobile skip-link ≥48px, browser console чистая.
- Review regression: `pnpm check` проходит typecheck, lint, 105 тестов (27 web, 76 API, 2 config), API coverage gate и production builds.

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.
- Добавлены безопасный versioned session parser/storage cleanup и typed recent-expenses API client с bearer authorization и sanitised errors.
- Добавлен semantic app shell с честными no-session/loading/empty/error/ready состояниями, стабильной навигацией и реальными expense summaries.
- Placeholder заменён responsive Owebee UI с каноническими токенами, mobile/desktop layouts, keyboard/accessibility safeguards и honey/bee brand motif.
- Новый `App` безопасно загружает session и recent expenses, поддерживает Retry и не раскрывает token в DOM или errors.
- Review patches закрыли API/render edge cases, responsive token deviations и недоступные navigation targets без расширения scope story.

### File List

- `_bmad-output/implementation-artifacts/stories/STORY-024.md`
- `apps/web/src/api/owebee-api.test.ts`
- `apps/web/src/api/owebee-api.ts`
- `apps/web/src/app/App.test.tsx`
- `apps/web/src/app/App.tsx`
- `apps/web/src/app/session.test.ts`
- `apps/web/src/app/session.ts`
- `apps/web/src/components/AppShell.test.tsx`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`

## Change Log

- 2026-07-01: Создан implementation-ready contract для первого продуктового UI workspace.
- 2026-07-01: Реализован и проверен responsive product UI shell; story переведена в review.
- 2026-07-01: Code review завершён; 11 findings исправлены и проверены, story переведена в done.
