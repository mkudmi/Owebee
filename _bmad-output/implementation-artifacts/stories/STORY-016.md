---
baseline_commit: d83b229e9219428db223d3a7658639a977683174
---

# Добавление расхода offline

- **ID:** STORY-016
- **Epic:** EPIC-007 — PWA, offline и синхронизация
- **Priority:** Must Have
- **Story Points:** 8
- **Status:** done

## User Story

Как **участник поездки**,  
я хочу **добавить расход без сети**,  
чтобы **не потерять оплату в моменте и увидеть её в общей истории до синхронизации**.

## Acceptance Criteria

1. Участник с действующей локальной session и ранее загруженными справочниками может открыть mobile-first форму расхода без сети; amount получает начальный focus, labels постоянны, а payer/date/all active split targets имеют безопасные defaults.
2. Форма принимает exact positive decimal с scale до 12, активную валюту, ISO date, непустое description до 500 символов, активного payer и минимум один уникальный member/family target.
3. Submit создаёт один `expense.create` mutation с устойчивым `clientMutationId`, `tripId`, `createdAt` и API-compatible payload: `payerMemberId`, `amount`, `currencyCode`, `expenseDate`, `description`, `splitTargets`.
4. Форма закрывается и очищается только после успешного завершения IndexedDB readwrite transaction. При storage error значения остаются в форме, focus переходит к доступному error summary, а пользователь получает возможность повторить сохранение.
5. После durable save локальный расход появляется ровно один раз в обычном списке расходов со статусом «Ожидает синхронизации» (текст + иконка + semantic color). Pending row показывает description, исходную сумму/валюту, payer и дату.
6. Pending expenses восстанавливаются из IndexedDB после нового создания app/outbox instance и фильтруются по текущей поездке; записи другой поездки не показываются.
7. Повторные submit/click во время сохранения не создают второй mutation или визуальный дубль. Один пользовательский submit использует один mutation ID.
8. Успешная online загрузка участников и валют обновляет IndexedDB reference cache. Offline-форма использует последний cache; если cache отсутствует, UI честно объясняет, что справочники нужно один раз загрузить при соединении.
9. `STORY-016` не отправляет mutations на сервер и не меняет их на `synced`: replay, retry, conflict и server application остаются scope `STORY-017`.
10. Unit/component/browser tests подтверждают durability, reload recovery, validation, duplicate protection, storage failure, pending UI, 320px reflow и полный `pnpm check`.

## Tasks / Subtasks

- [x] Task 1: Расширить local persistence contract (AC: 3, 4, 6, 7, 9)
  - [x] RED: добавить outbox tests для `expense.create`, trip filtering, сохранения полного payload, повторного открытия DB и legacy `sync.test`.
  - [x] GREEN: ввести discriminated mutation union и `listPendingExpenses(tripId)` без изменения server sync.
  - [x] REFACTOR: вынести reusable IndexedDB request/transaction helpers; не закрывать DB до завершения transaction.
- [x] Task 2: Добавить reference cache и API loading (AC: 1, 2, 8)
  - [x] RED: покрыть кэш участников/семей/валют, новый repository instance, фильтрацию inactive members и malformed API payloads.
  - [x] GREEN: добавить typed `GET participants`/`GET currencies` client methods и IndexedDB workspace reference repository.
  - [x] REFACTOR: online response обновляет cache; offline/error path использует последний валидный snapshot.
- [x] Task 3: Реализовать expense draft validation и durable submit use case (AC: 2, 3, 4, 7)
  - [x] RED: покрыть defaults, decimal/date/description/payer/targets validation, unique targets, stable ID и storage rejection.
  - [x] GREEN: добавить pure draft validator и `saveOfflineExpense` orchestration поверх outbox.
  - [x] REFACTOR: request persistent storage best-effort после save; отказ/unsupported API не влияет на подтверждённую транзакцию.
- [x] Task 4: Реализовать mobile-first expense form и pending rows (AC: 1, 4, 5, 8, 9)
  - [x] RED: server-render tests для labels, inputmode, defaults, selected targets, saving/error states и pending badge.
  - [x] GREEN: добавить page-based form, Add expense action, accessible error summary и normal-list pending rows.
  - [x] REFACTOR: pending + server rows объединяются без визуальных дублей; unresolved local work остаётся видимым при API error.
- [x] Task 5: Интегрировать App lifecycle и пройти gates (AC: 1-10)
  - [x] На startup загрузить pending mutations и cached references до/параллельно network refresh.
  - [x] После save обновить UI из persisted mutation, закрыть форму, объявить «Сохранено на этом устройстве…».
  - [x] Выполнить focused tests, полный `pnpm check` и browser QA на 320px/1440px, включая reload persistence.

### Review Findings

- [x] [Review][Defer] Добавить browser/component interaction tests для submit failure, retry, focus, double-click, reload persistence и 320px reflow [apps/web/package.json:11] — deferred: потом сделаем
- [x] [Review][Patch] Закрывать IndexedDB connection на всех blocked/synchronous/request/transaction error paths только после корректного завершения lifecycle и не оставлять late-open connection [apps/web/src/offline/indexed-db.ts:1]
- [x] [Review][Patch] Использовать collision-safe `add`, чтобы новый `clientMutationId` не перезаписывал существующую mutation [apps/web/src/offline/outbox.ts:84]
- [x] [Review][Patch] Runtime-валидировать записи outbox и изолировать malformed record без потери остальных pending expenses [apps/web/src/offline/outbox.ts:93]
- [x] [Review][Patch] Отклонять duplicate member/family IDs и currency codes в API responses и cached snapshots [apps/web/src/api/owebee-api.ts:230]
- [x] [Review][Patch] Не позволять устаревшему reference refresh перезаписывать более свежий IndexedDB snapshot [apps/web/src/app/App.tsx:110]
- [x] [Review][Patch] Не менять references открытой формы во время редактирования после позднего network refresh [apps/web/src/app/App.tsx:121]
- [x] [Review][Patch] Не скрывать сохранённые pending expenses молча при ошибке чтения outbox после reload [apps/web/src/app/App.tsx:260]
- [x] [Review][Patch] Не удерживать durable save и форму в saving из-за зависшего `navigator.storage.persist()` [apps/web/src/offline/expense-draft.ts:145]
- [x] [Review][Patch] Удалять исправленные поля из errors вместо пустого alert с `message: undefined` [apps/web/src/components/ExpenseForm.tsx:35]
- [x] [Review][Patch] Связать ошибки currency и payer с select через `aria-describedby` [apps/web/src/components/ExpenseForm.tsx:114]
- [x] [Review][Patch] Добавить реальную fragment target для ссылки summary ошибки splitTargets [apps/web/src/components/ExpenseForm.tsx:206]
- [x] [Review][Patch] Заблокировать редактирование draft во время IndexedDB transaction, чтобы успешный save не закрывал несохранённые поздние изменения [apps/web/src/components/ExpenseForm.tsx:99]
- [x] [Review][Patch] Зафиксировать `ExpenseCreateMutation.status` как `pending` и запретить `markSynced` для expense.create до STORY-017 [apps/web/src/offline/outbox.ts:35]
- [x] [Review][Patch] Проверять participant/family IDs как UUID до создания API-compatible payload и сохранения cache [apps/web/src/api/owebee-api.ts:244]
- [x] [Review][Patch] Показывать идентичность payer у восстановленной pending row даже при недоступном reference cache [apps/web/src/components/AppShell.tsx:429]
- [x] [Review][Patch] Не генерировать API-несовместимый fallback ID, если `crypto.randomUUID()` недоступен [apps/web/src/app/App.tsx:307]
- [x] [Review][Patch] Не требовать системный Google Chrome в чистом CI; использовать управляемый Playwright Chromium и явную установку браузера [apps/web/playwright.config.ts:9]
- [x] [Review][Patch] Не ограничивать Vitest каталогом `src`, чтобы будущие unit/component tests вне `src` не исчезали из quality gate [apps/web/package.json:12]
- [x] [Review][Patch] Использовать RFC-compatible UUID fixtures в development preview, чтобы pending mutation проходила серверный `z.string().uuid()` contract [apps/web/src/app/App.tsx:325]

## Dev Notes

### Current State and Reuse

- `STORY-024` завершена и прошла review. Сохранять её guarded navigation, truthful connectivity states, request timeout, stale-response guard и отсутствие вымышленного trip name.
- `apps/web/src/offline/outbox.ts` хранит `sync.test` mutations в `owebee-outbox` / `mutations` с keyPath `clientMutationId`; расширить, не переписывать и не ломать legacy tests.
- `apps/web/src/app/App.tsx` загружает recent expenses и защищает state от stale requests.
- `apps/web/src/components/AppShell.tsx` содержит shell и normal expense list. Pending rows должны жить в этом списке, а не в debug/отдельной очереди.
- `GET /api/v1/trips/:tripId/participants` возвращает members/families; использовать только active members как payer/targets, active families как targets.
- `GET /api/v1/currencies` возвращает active currency catalog.
- `POST /api/v1/trips/:tripId/expenses` описывает canonical payload, но `STORY-016` его не вызывает.
- Server `/api/v1/sync/push` пока принимает только `sync.test` и registered auth. Не расширять backend: это `STORY-017`.

### Mutation Contract

```ts
type ExpenseCreateMutation = {
  clientMutationId: string;
  tripId: string;
  type: "expense.create";
  createdAt: string;
  status: "pending";
  payload: {
    payerMemberId: string;
    amount: string;
    currencyCode: string;
    expenseDate: string;
    description: string;
    splitTargets: Array<{ type: "member" | "family"; id: string }>;
  };
};
```

- `clientMutationId` генерируется один раз через `crypto.randomUUID()` на submit attempt и используется как optimistic local row ID.
- `amount` нормализуется только trim + замена одной locale comma на dot до validation; не преобразовывать через `Number`.
- Уникальность targets проверяется по `${type}:${id}`.
- `createdAt` — ISO datetime; `expenseDate` — реальная календарная дата `YYYY-MM-DD`.
- Queue save всегда local-first, даже когда браузер online. До `STORY-017` результат остаётся pending.

### Reference Cache Contract

- Отдельный IndexedDB repository допустим, чтобы не усложнять migration рабочего outbox.
- Snapshot key — `tripId`; value содержит `members`, `families`, `currencies`, `updatedAt`.
- Не кэшировать bearer token, email или другие session secrets.
- Cache write выполняется только после полной runtime validation обоих API responses.
- Archived/inactive members не становятся defaults; historical server expense rows при этом не фильтровать.

### Form and UX Contract

- Multi-field form — отдельная page surface, не modal/sheet на mobile.
- Persistent labels; amount `inputMode="decimal"`, amount + currency визуально сгруппированы.
- Defaults: first active member payer, current local date, first currency (предпочесть `RUB`, если доступна), all active members/families selected.
- Кнопка отражает exact amount (`Добавить 48.20 EUR`), блокируется во время transaction.
- На storage failure не закрывать форму и не очищать state; error summary имеет `role="alert"` и связан с retry.
- Pending badge: «Ожидает синхронизации» + non-color clock icon; строка остаётся normal expense row.
- Баланс не пересчитывать локально; при pending показывать notice, что изменения ещё не включены в серверный баланс.

### IndexedDB Guardrails

- IndexedDB операции асинхронны и transactional; UI success только после `transaction.oncomplete`, не только после `request.onsuccess`.
- Учитывать `transaction.onabort`, `transaction.onerror`, `request.onerror`, blocked/open errors.
- DB connection закрывать после complete/abort, а не раньше.
- `navigator.storage.persist()` — best-effort API secure-context; `false`, reject или отсутствие API не отменяют уже сохранённый expense.
- Storage quota/disabled errors преобразовывать в безопасное пользовательское сообщение без очистки draft.

### Scope Guardrails

- Не добавлять Dexie, router, form/query/component libraries.
- Не менять API, PostgreSQL schema, server sync service или financial calculation.
- Не реализовывать online replay, automatic reconnect, retry, `syncing/synced/conflict/failed` transitions.
- Не хранить session token в IndexedDB cache/outbox payload.
- Не показывать local expense как серверный `accepted` или учтённый в балансе.

### Testing Requirements

- IndexedDB: persistence across repository instances, trip isolation, legacy mutation compatibility, transaction failure.
- Reference cache: round-trip and malformed snapshot rejection.
- Validation: exact decimal (including comma normalization), scale 12, real ISO date, 500-char description, active payer, at least one unique target.
- Submit: stable mutation ID, double-submit lock, error retains draft, persist-storage best effort.
- Render: page form semantics, labels, selected defaults, disabled saving button, error summary, pending badge/notice.
- Browser: 320×800 and 1440×900; no horizontal overflow; form is page-based; pending survives reload.
- Full regression: `pnpm check`.

### Latest Technical Notes

- IndexedDB остаётся low-level asynchronous transactional storage для structured data; schema/open/transaction boundaries должны быть явными.
- Persistent storage request доступен только в secure context и может вернуть `false` по browser policy, поэтому это enhancement, а не completion gate.
- Использовать установленный React/Vite/Vitest stack; dependency upgrade не входит в story.

### References

- [Source: `_bmad-output/planning-artifacts/prd.md` — Epic 7 / STORY-016 / FR-018]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — React PWA Client / Sync Module / NFR-006]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Owebee-2026-06-30/EXPERIENCE.md` — Add expense, Offline & Sync, Flow 4]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Owebee-2026-06-30/DESIGN.md` — form, pending badge, expense row]
- [Source: `_bmad-output/implementation-artifacts/stories/STORY-022.md`]
- [Source: `_bmad-output/implementation-artifacts/stories/STORY-024.md`]
- [Source: `apps/web/src/offline/outbox.ts`]
- [Source: `apps/web/src/app/App.tsx`]
- [Source: `apps/web/src/components/AppShell.tsx`]
- [Source: `apps/api/src/expenses/expense-service.ts`]
- [Source: `apps/api/src/families/family-service.ts`]
- [Source: `apps/api/src/currency/currency-service.ts`]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Implementation Plan

- RED/GREEN/REFACTOR persistence and reference cache.
- Pure validation/durable submit use case.
- Accessible form and pending-list integration.
- App lifecycle, browser QA and full regression.

### Debug Log References

- Create-story discovery: PRD, architecture, canonical DESIGN/EXPERIENCE, Sprint 5 plan, STORY-022, STORY-024, current web/API/IndexedDB implementation.
- Dev-story start: baseline `d83b229e9219428db223d3a7658639a977683174`.
- Task 1 RED: два новых outbox tests падали из-за отсутствующего expense query; GREEN: 30 web tests и полный 108-test regression проходят.
- Task 2 RED: API reference methods и cache module отсутствовали; GREEN: 34 web tests и полный 112-test regression проходят.
- Task 3 RED: expense draft module отсутствовал; GREEN: 48 web tests и полный 126-test regression проходят.
- Task 4 RED: form и pending UI contracts отсутствовали; GREEN: server-render suite покрывает defaults, error/saving states, pending badge и отсутствие ложного empty state.
- Task 5: App восстанавливает cache/outbox до network refresh, сохраняет local-first и объявляет durable success; browser QA выявил и устранил overflow на 320px и desktop form-column regression на 1440px.
- Final gates: `pnpm check` проходит; 133 tests (55 web, 76 API, 2 config), API coverage 97.57%, production builds успешны.
- Code review: исправлены все 16 patch findings; browser interaction automation отложена отдельной работой по решению пользователя.
- Review regression: `pnpm check` проходит; 144 теста (66 web, 76 API, 2 config), API coverage 97.57%, production builds успешны.
- Review browser QA: 320×800 без horizontal overflow и с initial focus на amount; 1440×900 с form width 760px; console чистая.
- Deferred interaction coverage RED: новый Playwright flow воспроизвёл невозможность успешного save в development preview из-за невалидных fixture IDs.
- Deferred interaction coverage GREEN: preview fixtures приведены к UUID-контракту; Chrome E2E покрывает IndexedDB failure/retry, error-summary focus, double-click deduplication, reload recovery и viewport fit на 320×800/1440×900.
- Final closure gate: `pnpm check` проходит; 148 тестов (66 web unit/component, 4 web E2E, 76 API, 2 config), API coverage 97.57%, lint/typecheck/build успешны.
- Final adversarial review: 3 patch findings исправлены — managed Playwright Chromium с явной установкой, полный Vitest discovery с исключением E2E и RFC UUID v4 fixtures; повторный `pnpm check` проходит.

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.
- Outbox расширен совместимым `expense.create` union; pending expenses сохраняются транзакционно, переживают новый repository instance и изолируются по trip.
- Добавлены runtime-validated participant/currency API contracts и IndexedDB reference snapshot без email/token; archived members исключаются из form defaults.
- Добавлены exact draft validation, locale comma normalization и duplicate-safe durable saver с best-effort persistent storage.
- Реализована page-based mobile-first форма с постоянными labels, безопасными defaults, error focus, disabled saving state и responsive layout.
- Pending expense отображается в обычном списке с семантическим badge, не включается в серверный баланс и остаётся видимым при API error.
- App lifecycle восстанавливает pending/reference cache, обновляет валидные справочники online и закрывает форму только после durable transaction.
- Browser QA подтверждает focus/reflow без horizontal overflow на 320×800, центрированную форму 760px на 1440×900 и ровно одну pending row после reload.
- Review patches усилили IndexedDB lifecycle, outbox/cache validation, stale refresh recovery, form accessibility и duplicate-safe local persistence.
- Отложенный browser/component interaction test gap закрыт воспроизводимым Playwright suite на управляемом Chromium; тесты включены в стандартный `pnpm test`/`pnpm check` и не зависят от системного Chrome.
- Development preview использует API-compatible UUID fixtures, поэтому browser flow проверяет тот же validation contract, что и реальный offline save.

### File List

- `_bmad-output/implementation-artifacts/stories/STORY-016.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `.gitignore`
- `apps/web/src/offline/indexed-db.ts`
- `apps/web/src/offline/outbox.test.ts`
- `apps/web/src/offline/outbox.ts`
- `apps/web/src/api/owebee-api.test.ts`
- `apps/web/src/api/owebee-api.ts`
- `apps/web/src/offline/workspace-reference-cache.test.ts`
- `apps/web/src/offline/workspace-reference-cache.ts`
- `apps/web/src/offline/expense-draft.test.ts`
- `apps/web/src/offline/expense-draft.ts`
- `apps/web/src/components/ExpenseForm.test.tsx`
- `apps/web/src/components/ExpenseForm.tsx`
- `apps/web/src/components/AppShell.test.tsx`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/app/App.test.tsx`
- `apps/web/src/app/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/playwright.config.ts`
- `apps/web/tests/e2e/offline-expense.spec.ts`
- `apps/web/package.json`
- `pnpm-lock.yaml`
- `_bmad-output/implementation-artifacts/sprint-plan.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

- 2026-07-01: Создан implementation-ready offline expense contract.
- 2026-07-01: Реализовано durable local-first добавление расхода, reference cache, pending UI и reload recovery; story переведена в review после полного quality gate.
- 2026-07-02: Code review завершён; 16 patch findings исправлены, browser interaction tests deferred, story возвращена в in-progress.
- 2026-07-13: Закрыт deferred interaction coverage: добавлены Playwright E2E для failure/retry/focus/double-click/reload/320px/1440px, исправлены UUID fixtures preview, полный quality gate пройден; story переведена в review.
- 2026-07-13: Финальный adversarial review завершён; 3 findings исправлены, полный quality gate повторно пройден, story переведена в done.
