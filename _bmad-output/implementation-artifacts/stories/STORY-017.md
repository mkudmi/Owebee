# Синхронизация после восстановления сети

- **ID:** STORY-017
- **Epic:** EPIC-007 — PWA, offline и синхронизация
- **Priority:** Must Have
- **Story Points:** 13
- **Status:** ready-for-dev

## User Story

Как **участник поездки**,
я хочу, чтобы **сохранённые offline-расходы безопасно отправлялись при появлении сети**,
чтобы **они стали общей частью поездки без потери данных и дубликатов**.

## Acceptance Criteria

1. При запуске приложения с действующей registered или guest session и при событии `online` клиент пытается синхронизировать replayable `expense.create` mutations текущей поездки. `navigator.onLine` используется только как hint: успех определяется валидным ответом API, а недоступность сети не блокирует локальные функции.
2. Один browser profile имеет устойчивый RFC-compatible `clientDeviceId`, созданный один раз и сохранённый в versioned metadata store IndexedDB. Replay всегда повторно использует исходные `clientMutationId`, `clientDeviceId`, `tripId`, `createdAt` и payload; token/session secret в IndexedDB не сохраняется.
3. Replay выполняется single-flight, батчами до 50 mutations, в стабильном порядке и с изоляцией по `tripId`. Startup, reconnect, manual Retry, React StrictMode и несколько вкладок не создают параллельное применение одной mutation; серверная идемпотентность остаётся последней защитой от дублей.
4. До HTTP request mutation атомарно получает durable `syncing` lease с новым `attemptId` и `leaseExpiresAt`. Результат применяется через compare-and-set только если row всё ещё `syncing` с тем же `attemptId`; поздний ответ истёкшей попытки не перезаписывает более новое состояние. Timeout, обрыв соединения, 5xx, invalid/incomplete response или crash не удаляют payload; expired lease после reload становится retryable. Ошибка одной mutation не откатывает уже подтверждённые результаты соседних mutations.
5. `POST /api/v1/sync/push` принимает registered и guest actors, повторно проверяет exact trip membership, active trip/member, payer, split targets и currency. Canonical `expense.create.payload` без альтернативного mapping: `payerMemberId`, `amount`, `currencyCode`, `expenseDate`, `description`, `splitTargets`.
6. Для новой валидной mutation сервер в одной per-mutation transaction создаёт ровно один canonical expense, split snapshots, currency snapshot, expense idempotency record, audit event и applied sync ledger result. Ответ `applied` содержит `clientMutationId`, реальный `serverEntityId`, `serverVersion: 1` и runtime-validated canonical expense DTO.
7. Для `expense.create` sync ledger использует NOT NULL identity `(trip_id, actor_member_id, client_device_id, client_mutation_id)`, где `actor_member_id` получен из текущего registered/guest `TripActor`; browser profile не закрепляется за account. Повтор идентичной mutation после потерянного ответа возвращает `duplicate` с тем же entity/version/expense и считается успешной синхронизацией. Та же identity с другим normalized type или payload возвращает `conflict` без второго domain write и без раскрытия чужого entity или payload. Существующие `sync.test` rows остаются отдельным legacy path и не ослабляют constraints/lookup для expense rows.
8. Terminal server results имеют однозначный contract: `applied | duplicate` содержат canonical entity; `conflict | rejected` содержат stable `errorCode` и не содержат секретов. Permission, inactive trip, invalid participant/currency и immutable identity collision не уходят в бесконечный auto-retry; transient provider/DB failures откатывают transaction и остаются безопасно retryable.
9. Локальная expense row сохраняет одну stable UI identity и проходит `pending → syncing → synced | failed | conflict`. `applied` и `duplicate` обновляют ту же строку canonical DTO; local/server rows дедуплицируются по `serverEntityId`, поэтому row не исчезает при failed refresh и не показывается дважды.
10. Pending, syncing, failed и conflict mutations переживают reload и остаются в обычном списке расходов. Каждый статус выражен текстом, иконкой и semantic color; manual Retry доступен только для retryable failure, не создаёт новую mutation и блокируется во время active attempt.
11. Базовый Sync Center показывает empty state «Все изменения синхронизированы» либо unresolved mutations текущей поездки. Failed row имеет доступный Retry; conflict/rejected row показывает «Требует внимания», причину и полный локальный draft в read-only виде с возможностью копирования. Merge, `Apply my values`, discard единственной копии и automatic conflict resolution не входят в story.
12. Пока существует pending/syncing/failed/conflict mutation, persistent notice сообщает количество изменений, ещё не включённых в серверный баланс. Notice меняется только после durable результата и canonical reconciliation; background sync не крадёт focus, progress объявляется polite live region, а terminal attention state — alert.
13. Sync UI работает клавиатурой, имеет targets минимум 48×48 CSS px на mobile и 44×44 elsewhere, не зависит от hover/цвета/анимации, сохраняет смысл при reduced motion и forced colors и не создаёт horizontal overflow на 320 CSS px. После Retry/Review focus возвращается к затронутой строке.
14. Unit/integration/browser tests подтверждают applied, duplicate after lost response, concurrent replay, guest auth, cross-trip isolation, partial batch, timeout/5xx, stale lease и late-response CAS, rejected/conflict persistence, manual retry, one-row reconciliation и responsive/reflow matrix 320, 390, 768, 1024 и 1440 CSS px. Полный `pnpm check` проходит.

## Tasks / Subtasks

- [ ] Task 1: Зафиксировать transaction-aware server command и sync result contract (AC: 5–8)
  - [ ] RED: расширить sync integration tests для registered/guest `expense.create`, applied entity/version/DTO, exact duplicate, changed-payload conflict, rejected authorization и legacy `sync.test`.
  - [ ] GREEN: вынести canonical expense schema/normalization и transaction-aware create command из `ExpenseService`, сохранив direct endpoint 201/200/409 behavior.
  - [ ] REFACTOR: не дублировать expense validation, decimal/currency/split/audit logic между direct и sync routes.
- [ ] Task 2: Сделать server replay атомарным, actor-scoped и concurrency-safe (AC: 3, 5–8)
  - [ ] Добавить migration: nullable `actor_member_id` только для существующего legacy `sync.test`; check constraint требует NOT NULL `trip_id`/`actor_member_id` для `expense.create`; partial unique `(trip_id, actor_member_id, client_device_id, client_mutation_id)` применяется к expense rows, а прежняя global identity сохраняется отдельным partial index только для legacy rows. Не пытаться выдумывать actor backfill для старых `sync.test`.
  - [ ] Применять каждую mutation в отдельной DB transaction; claim делать через conflict-safe insert/lock, а не check-then-insert.
  - [ ] Поддержать registered/guest `TripActor`, payload collision, concurrent identical/different pushes, partial batch и stable error codes без entity leakage.
- [ ] Task 3: Расширить durable outbox и device identity (AC: 2–4, 9–10)
  - [ ] RED: покрыть IndexedDB upgrade, stable device ID, legal transitions, atomic claim, attempt CAS, lease expiry/late response, FIFO/trip isolation, failed/conflict/synced round-trip и malformed record isolation.
  - [ ] GREEN: добавить versioned metadata store и durable mutation envelope с attempt/error/entity/conflict metadata.
  - [ ] REFACTOR: сохранить collision-safe `add`, transaction completion semantics и legacy `sync.test` compatibility.
- [ ] Task 4: Реализовать typed API client и replay coordinator (AC: 1–4, 6–10)
  - [ ] RED: проверить exact auth/body, runtime validation и correlation каждого result ID, applied/duplicate/conflict/rejected mapping, missing/unknown/duplicate result IDs, timeout и concurrent triggers.
  - [ ] GREEN: добавить `pushMutations` и single-flight `expense-sync` coordinator с batch ≤50, retry policy и durable result application.
  - [ ] REFACTOR: `online`/`navigator.onLine` считать подсказкой; transport result остаётся authoritative.
- [ ] Task 5: Интегрировать lifecycle, one-row reconciliation и Sync Center (AC: 1, 9–13)
  - [ ] На startup восстановить все local states, подписаться/отписаться от `online`/`offline`, не ломая stale-request и frozen-form-reference guards `STORY-016`.
  - [ ] Объединить local/canonical rows по stable identity; после batch refresh выполнить максимум один раз и не скрывать synced row при refresh failure/limit=5.
  - [ ] Реализовать truthful global status, badges, unresolved balance notice, Retry и read-only attention review с accessible focus/live-region behavior.
  - [ ] Обновить временный copy формы о «будущей синхронизации» на фактическое поведение.
- [ ] Task 6: Пройти regression, browser QA и completion gates (AC: 14)
  - [ ] Сохранить все unit/component/Playwright regressions `STORY-016`.
  - [ ] Добавить browser flows: offline save → restart → reconnect → same row synced; lost response → duplicate; retry/late-response race; persistent conflict; viewports 320, 390, 768, 1024 и 1440 CSS px.
  - [ ] Выполнить focused tests, migrations, полный `pnpm check` и обновить story/sprint artifacts только по фактическому evidence.

## Dev Notes

### Canonical Contracts

`STORY-016` payload является единственным input DTO:

```ts
type ExpenseCreatePayload = {
  payerMemberId: string;
  amount: string;
  currencyCode: string;
  expenseDate: string;
  description: string;
  splitTargets: Array<{ type: "member" | "family"; id: string }>;
};
```

Не вводить architecture-draft aliases `originalAmount`, `originalCurrencyCode`, `splits` или `localExpenseId`. Canonical validation уже реализована в `apps/api/src/expenses/expense-service.ts` и должна быть переиспользована direct/sync paths.

Server result union:

```ts
type SyncResult =
  | {
      clientMutationId: string;
      status: "applied" | "duplicate";
      serverEntityId: string;
      serverVersion: number;
      expense: ExpenseDto;
    }
  | {
      clientMutationId: string;
      status: "conflict" | "rejected";
      errorCode: string;
    };
```

- Batch result order соответствует input order; каждый input ID встречается ровно один раз.
- `duplicate` — response, canonical ledger row остаётся `applied`.
- Transient infrastructure/provider error не должен создавать terminal ledger row: transaction rollback позволяет retry с теми же IDs.
- Expense idempotency key должен переживать сброс device metadata: использовать actor/trip-scoped namespace на основе immutable `clientMutationId`; `clientDeviceId` остаётся ledger/device namespace, но не authorization proof.

### Backend Current State and Required Changes

- `apps/api/src/sync/sync-service.ts` сейчас принимает только `sync.test`, выполняет check-then-insert и возвращает synthetic entity ID. Заменить domain application, но сохранить legacy test mutation.
- `apps/api/src/sync/sync-routes.ts` сейчас принимает только registered session. Использовать существующий `resolveTripActor()` и передать `inviteService` из `apps/api/src/app.ts`.
- Переиспользовать `ExpenseService.createExpense` behavior: exact decimal strings, active trip/member checks, payer/target validation, immutable rate snapshot, idempotency fingerprint, audit.
- Нельзя вызвать current `createExpense()` внутри outer sync transaction без refactor: он открывает собственную transaction, а helpers читают root DB. Нужен transaction-aware internal command с явным `Database`/unit-of-work.
- Claim/dedupe нельзя строить как `findMutation()` → insert: concurrent push сейчас может дать unique violation/500. Для `expense.create` ledger identity — NOT NULL `(trip_id, actor_member_id, client_device_id, client_mutation_id)`; использовать atomic insert/lock и проверять type/normalized fingerprint до duplicate response.
- Migration/backfill policy: существующие rows имеют только `sync.test`, поэтому сохраняются без искусственного `actor_member_id`. Новый check разрешает nullable `trip_id`/`actor_member_id` только для legacy `sync.test`; отдельный legacy partial unique index сохраняет прежнее `(client_device_id, client_mutation_id)` behavior. Все новые `expense.create` обязаны иметь trip/member identity и попадают только под actor-scoped partial unique index/lookup. Domain replay никогда не использует global fallback.
- `client_devices` не привязывать навсегда к одному user: browser profile может пережить logout/login. Actor проверяется на каждой mutation.
- Для guest ledger добавить actor member metadata; чужой actor с угаданными device/mutation IDs не должен получить entity ID.
- Не держать DB transaction открытой во время external currency provider call. После получения rate повторно проверить mutable authorization/participant state внутри transaction либо применить эквивалентную locking strategy.

### Frontend Current State and Required Changes

- `apps/web/src/offline/outbox.ts`: DB `owebee-outbox` v1, `mutations` keyPath `clientMutationId`; `expense.create` runtime-valid только как pending, `markSynced` намеренно запрещён. Расширять через versioned upgrade, не переписывать сохранённые rows.
- Новый durable envelope: `status`, `attemptCount`, `lastAttemptAt`, `attemptId`, `leaseExpiresAt`, `error`, `serverEntityId`, `serverVersion`, canonical `expense` для success. Full local payload сохраняется для failed/conflict.
- `clientDeviceId` создать/валидировать в metadata store один раз. Corrupt/missing metadata восстанавливается безопасно; expense idempotency не зависит только от device ID.
- Atomic claim должен перечитать row внутри readwrite transaction, создать новый UUID `attemptId` и записать lease. Runtime single-flight недостаточен для нескольких вкладок; применение результата делает CAS по актуальному `attemptId`, а server ledger гарантирует final dedupe. Late response старой/истёкшей попытки локально игнорируется.
- Expired `syncing` lease становится replayable. Не оставлять row навсегда в syncing после crash/reload.
- `apps/web/src/api/owebee-api.ts`: сохранить request timeout, safe errors и runtime response validation; не доверять unknown/missing/duplicate result IDs.
- `apps/web/src/app/App.tsx`: сохранить `latestRequestId`, serialized reference writes, frozen form references и local rows при API error. React StrictMode не должен дублировать replay/listener.
- `apps/web/src/components/AppShell.tsx`: заменить два независимых `.map()` unified row model; pending payer fallback и normal expense list сохраняются.
- Success DTO сохраняется durably до reconciliation. Не удалять local row сразу после apply: refresh может упасть или entity не попасть в recent `limit=5`.

### State and Error Policy

```text
pending ─claim→ syncing
syncing ─applied/duplicate→ synced
syncing ─transport/5xx/invalid response→ failed(retryable)
syncing ─conflict/non-retryable rejected→ conflict(attention)
failed ─manual/automatic safe retry→ pending ─claim→ syncing
expired syncing lease ─recovery→ pending
```

- Один drain обрабатывает каждую mutation не более одного раза и никогда немедленно не переотправляет собственный transient failure. Automatic retry запускается только отдельным startup (один раз), новым `online` event или явным manual Retry; таймерного polling/backoff в этой story нет. `attemptCount` сохраняется для наблюдаемости, но не уничтожает draft. Non-retryable rejected/conflict автоматически не повторять.
- `navigator.onLine` ненадёжен и не является gate. Не отключать локальную форму только на основании этого флага.
- Failed/conflict payload не удалять. В этой story нет discard/merge/apply action.
- Sync Center показывает только текущую поездку; mutations другой поездки не отправляются и не изменяются.
- Логи/alerts/metrics не содержат bearer token, raw financial payload или description. Допустимы counts, error codes, mutation type и opaque IDs.

### UX and Accessibility Guardrails

- Обычные rows остаются основным местом expense; Sync Center — дополнительная actionable surface, не debug queue.
- Copy/status: `pending` «Ожидает синхронизации», `syncing` «Синхронизируем», `synced` «Синхронизировано», `failed` «Не удалось синхронизировать», `conflict` «Требует внимания».
- Pending/syncing/failed/conflict persistent. Routine synced feedback может ослабнуть после 5 секунд, но canonical expense остаётся видимым.
- `role="status"` для debounced progress/success; `role="alert"` для non-retryable attention. Background update не перемещает focus.
- Для `expense.create` в STORY-017 принят scoped UX contract: conflict review показывает local fields/reason и copy action; если server snapshot отсутствует, не имитировать «Current trip version». Changed-field comparison и resolution actions отложены до расширения Sync API и не входят в эту story.
- 320 CSS px без двухмерного scroll; long names/currencies/error copy wrap; 35% string expansion reserve.
- Status не только цветом: обязательны текст и иконка. Сохранить focus ring, forced-colors и reduced-motion rules.

### Scope Guardrails

- Только replay `expense.create` + legacy `sync.test` regression.
- Не реализовывать pull/change feed, service worker background sync, CRDT/event sourcing, offline edit/delete, automatic merge, settlement или local balance calculation.
- Не добавлять Dexie, router, TanStack Query, form/component libraries. Использовать установленный React/Vite/Vitest/Playwright stack и low-level IndexedDB helpers.
- Не расширять story до полного Balance/Auth/PWA/i18n UI.
- Mockup `sync-conflict.html` иллюстративен; canonical `DESIGN.md` + `EXPERIENCE.md` имеют приоритет. Кнопки Apply/Use current запрещены без server contract.

### Testing Requirements

- Backend integration: registered/guest apply; exact duplicate; payload/type/trip collision; concurrent same/different payload; foreign actor/payer/target; archived/deleted trip; provider/DB rollback; partial ordered batch; max 50; legacy `sync.test`; direct expense regressions.
- Migration: legacy `sync.test` preservation without fake backfill, expense-only NOT NULL actor/trip check, separate partial unique indexes, actor/fingerprint metadata and full migration chain.
- Outbox: v1→v2, stable device ID, transitions, atomic claim, trip isolation, FIFO, lease recovery, status/error/entity round-trip, malformed isolation, collision-safe add.
- Coordinator/API: single-flight, exact IDs on retry, response correlation, partial results, timeout/401/403/5xx/invalid JSON, `online` hint behavior.
- Components/App: startup restore, listener cleanup, StrictMode, local/server dedupe, failed refresh, `limit=5`, status semantics, Retry/Review focus and unresolved notice.
- Playwright: use isolated contexts; `context.setOffline()` for real offline trigger; mock/seed sync API with `context.route()` or run integration server. If request interception is used with a service worker later, set `serviceWorkers: "block"`.
- Preserve `STORY-016` storage failure/double-click/reload/reflow suite.
- Full gate: `pnpm check`.

### Expected File Map

New:

- `apps/api/migrations/0005_sprint5_expense_sync.sql`

Update:

- `apps/api/src/sync/sync-service.ts`
- `apps/api/src/sync/sync-routes.ts`
- `apps/api/src/sync/sync.test.ts`
- `apps/api/src/expenses/expense-service.ts`
- `apps/api/src/expenses/expense-routes.ts` only if shared error mapping requires it
- `apps/api/src/app.ts`
- `apps/api/src/database/migrations.test.ts`
- `apps/web/src/offline/outbox.ts`
- `apps/web/src/offline/outbox.test.ts`
- `apps/web/src/api/owebee-api.ts`
- `apps/web/src/api/owebee-api.test.ts`
- `apps/web/src/app/App.tsx`
- `apps/web/src/app/App.test.tsx`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/components/AppShell.test.tsx`
- `apps/web/src/components/ExpenseForm.tsx`
- `apps/web/src/components/ExpenseForm.test.tsx`
- `apps/web/src/styles.css`
- `apps/web/tests/e2e/offline-expense.spec.ts`

Likely new:

- `apps/web/src/offline/expense-sync.ts`
- `apps/web/src/offline/expense-sync.test.ts`
- `apps/web/src/components/SyncCenter.tsx`
- `apps/web/src/components/SyncCenter.test.tsx`
- `apps/web/tests/e2e/offline-expense-sync.spec.ts`

Не создавать новый backend `expense-sync-service`: orchestration принадлежит Sync Module, domain invariants — Expenses Module.

### Previous Story and Git Intelligence

- `STORY-016` закрыта после adversarial review: IndexedDB lifecycle, collision-safe add, malformed isolation, stable IDs, reference races, a11y и actual browser interactions уже защищены тестами.
- Browser tests используют managed Playwright Chromium; не возвращать dependency на system Chrome и не сужать Vitest discovery.
- Последний committed baseline `d92f82f` содержит закрытие `STORY-016`, включая Playwright E2E и финальные review fixes. Текущий рабочий diff относится только к подготовке `STORY-017` и sprint artifacts.

### Latest Technical Notes

- MDN: `navigator.onLine` inherently unreliable; использовать только hint, не feature gate: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine
- MDN: IndexedDB request success не равен transaction commit; transitions подтверждать на `transaction.complete`, abort/error сохраняют предыдущую консистентную state: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
- Playwright: каждый test получает isolated BrowserContext; offline эмулируется `browserContext.setOffline(true)`: https://playwright.dev/docs/browser-contexts и https://playwright.dev/docs/api/class-browsercontext#browser-context-set-offline
- Playwright network interception может не видеть Service Worker-owned requests; при route-based E2E использовать `serviceWorkers: "block"`: https://playwright.dev/docs/network#missing-network-events-and-service-workers

### References

- [Source: `_bmad-output/planning-artifacts/prd.md` — FR-018, NFR-006, EPIC-007 / STORY-017, Flow 4, UI-004]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — React PWA Client, Sync Module, `sync_mutations`, Sync API, Reliability, Trade-off 3]
- [Source: `_bmad-output/planning-artifacts/ux-design.md` — canonical artifact pointers]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Owebee-2026-06-30/DESIGN.md` — Expense row, Sync Center, semantic status]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Owebee-2026-06-30/EXPERIENCE.md` — Offline & Sync Contract, State Patterns, Flow 4, Accessibility Floor]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-Owebee-2026-06-30/mockups/sync-conflict.html` — illustrative conflict layout only]
- [Source: `_bmad-output/implementation-artifacts/sprint-plan.md` — STORY-017 scope, risks, DoD]
- [Source: `_bmad-output/implementation-artifacts/stories/STORY-016.md` — mutation/persistence contract and review learnings]
- [Source: `apps/api/src/sync/sync-service.ts`, `sync-routes.ts`, `sync.test.ts`]
- [Source: `apps/api/src/expenses/expense-service.ts`, `expense-routes.ts`]
- [Source: `apps/web/src/offline/outbox.ts`, `expense-draft.ts`, `indexed-db.ts`]
- [Source: `apps/web/src/api/owebee-api.ts`]
- [Source: `apps/web/src/app/App.tsx`, `components/AppShell.tsx`, `components/ExpenseForm.tsx`]
- [Source: MDN `Navigator.onLine`, `Using IndexedDB`; Playwright BrowserContext/Network]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Ultimate context engine analysis: PRD, architecture, canonical DESIGN/EXPERIENCE, Sprint 5 plan, STORY-016, sync/expense backend, outbox/API/App frontend, browser constraints and recent Git history.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Canonical payload/result/device/guest/conflict contracts resolved for implementation without further elicitation.
- Story intentionally limits conflict UX to durable read-only attention; merge/apply remains out of scope.

### File List
