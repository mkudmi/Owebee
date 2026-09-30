---
name: Owebee
status: final
updated: 2026-06-30
sources:
  - "{planning_artifacts}/prd.md"
  - "{planning_artifacts}/architecture.md"
  - "imports/ux-design-v1.md"
design: "DESIGN.md"
---

# Owebee — Experience Spine

## Foundation

Owebee is a responsive web/PWA for Russian- and English-speaking trip groups. The primary surface is a phone used in uneven connectivity; tablet and desktop support review, management, and denser comparison. Touch, keyboard, mouse, VoiceOver, TalkBack, and NVDA are first-class input paths.

The frontend foundation is React + TypeScript + Vite. No component library is currently inherited, so every named custom component in this document has a corresponding visual contract in `DESIGN.md`. `DESIGN.md` owns appearance; this file owns information architecture, behavior, states, interactions, accessibility, and journeys.

The four key-screen references illustrate decided composition only:

- [Guest join](mockups/guest-join.html)
- [Expense form](mockups/expense-form.html)
- [Balance](mockups/balance.html)
- [Sync conflict](mockups/sync-conflict.html)

The two spines win on conflict with any mockup, wireframe, or import.

## Information Architecture

| Surface | Reached from | Purpose |
|---|---|---|
| Welcome / sign in | App open without session | Sign in or move to registration/recovery. |
| Register | Welcome | Create the registered account required to create trips. |
| Invite preview | Invite URL | Confirm trip context before sharing personal data. |
| Join as guest | Invite preview | Enter name and email without full registration. |
| Recover guest access | Existing-email result / Welcome | Request a generic magic-link response. |
| Magic-link result | Email link | Verify, explain expiry/use failure, and return to the intended trip. |
| Trips | Authenticated app open | Resume active trips, reveal archived trips, or create one. |
| Create trip | Trips | Set name and base currency. |
| Account | Account menu | Language, session, and account-level preferences. |
| Overview | Trip open | Show personal balance, primary action, recent expenses, and people summary. |
| Expenses | Trip navigation | Browse/filter all expenses and unresolved sync work. |
| Expense detail | Expense row | Inspect calculation, rate, split, history, and permitted actions. |
| Add/edit expense | Primary action / permitted edit | Capture or correct an expense. |
| Balance | Trip navigation | Explain every participant/family direction and total. |
| Balance breakdown | Balance row | Show contributing expenses and share arithmetic. |
| People | Trip navigation | Maintain participants, families, and shares. |
| Family editor | People | Explain and change aggregate identity/share count. |
| Trip settings | Header settings, owner only | General, invite, lifecycle, base-currency, and deletion controls. |
| Sync Center | Global status layer | Inspect pending, syncing, failed, and conflicting local work. |
| PWA install explainer | After demonstrated value | Offer optional installation without blocking a core task. |

Mobile trip navigation is a persistent bottom bar: Overview, Expenses, Balance, People. Add expense is the visually dominant contextual action on Overview and Expenses. At 768px and above, navigation becomes a left rail. Settings remains in the trip header and is owner-only.

Modal stacks stop at one. Multi-field expense forms are pages below 768px. Every IA surface is reached by at least one flow or named navigation path; no hidden drawer is required for a core action.

## Voice and Tone

Owebee is direct, calm, and specific. Microcopy explains what happened, what remains safe, and what the person can do next.

| Do | Don't |
|---|---|
| “Saved on this device. It will sync when you’re online.” | “Network error.” |
| “You owe ₽2,500.” | “Balance: −₽2,500.” |
| “This balance does not include 2 changes waiting to sync.” | “Balance may be inaccurate.” |
| “We couldn’t save this expense. Your entries are still here.” | “Something went wrong.” |
| “Email me a sign-in link.” | “User already exists.” |
| “The previous invite link will stop working.” | “Rotate token.” |

Use complete parameterized sentences; never concatenate translated fragments around names or amounts. Avoid idioms, jokes, celebratory finance language, and technical terms such as payload, HTTP, version conflict, or idempotency.

## Component Patterns

Visual specifications live in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| App shell | Every authenticated surface | First focusable item is “Skip to main content.” DOM order remains header/navigation/main regardless of responsive placement. |
| Trip navigation | Trip workspace | Active item has `aria-current="page"`. Bottom bar and rail expose the same destinations in the same conceptual order. |
| Button — primary | One main action per region | Loading label preserves meaning; repeated activation is idempotent; focus remains predictable after completion. |
| Button — destructive | Delete/irreversible actions | Consequence text and object name appear before action. Trip deletion uses an explicit acknowledgment checkbox; exact-name typing is not required. Never auto-triggered or closed by backdrop. |
| Form field | All forms | Persistent label; validate on blur and submit; error linked by `aria-describedby`; preserve values after failure. |
| Amount/currency field | Expense form | Amount receives initial focus; `inputmode="decimal"`; locale input normalizes to exact decimal storage; ambiguous symbols include ISO code. |
| Select/combobox | Currency, payer, filters | Searchable values use standard combobox semantics; Enter selects, Escape closes, arrow keys navigate, typed query is announced. |
| Share selector/stepper | Expense split, family editor | Checklist defaults to all active units; Select all supports indeterminate; numeric change never requires dragging; live sentence explains resulting personal shares. |
| Expense row | Overview/Expenses | One descriptive detail link plus separate permitted actions; sync state is always visible; unresolved conflict cannot be filtered away by default. |
| Balance summary | Overview/Balance | Direction sentence precedes absolute amount; base currency, calculation time, and pending-change notice remain adjacent. |
| Balance row | Balance | Disclosure button expands contributing expenses and arithmetic; multiple rows may remain open for comparison. |
| Status badge — synced | Expense rows / Sync Center | Text + icon + color; may become visually quiet after routine success but remains available in detail. |
| Status badge — pending | Expense rows / Sync Center | Text + icon + color; persists until synchronization completes or fails. |
| Status badge — conflict | Expense rows / Sync Center | Text + icon + color; persists with a nearby Review conflict action. |
| Sync Center | Global status trigger | Lists mutations by trip and state; retry acts on safe items; conflict opens comparison; local payload remains until resolution or safe copy. |
| Dialog | Short desktop tasks | Move focus to title or first invalid field; trap focus; Escape closes non-destructive dialogs; return focus to trigger. |
| Mobile sheet | Short mobile tasks | Same focus contract as Dialog; never contains the full expense form. |
| Invite link field | Invite-ready/settings | Read-only labeled URL; Copy always available; native Share only when supported; success announced politely. |
| Toast/inline message | Routine completion vs contextual state | Toast is never the only copy of important information; routine status uses `role="status"`, urgent error uses `role="alert"`. |
| Error summary | Failed form submission | Receives focus, summarizes count, and links each item to its field. |
| Empty state | Empty data surface | Names the absence and provides one valid next action; filtered-empty differs from truly empty. |

## State Patterns

### Surface-state contract

`N/A` means the state cannot occur by design; it is not an unmade decision.

| Surface | Cold-load / empty | Error / offline | Permission / focus |
|---|---|---|---|
| Welcome / sign in | Form renders without data skeleton. | Localized inline error; entered email retained. Offline explains that sign-in needs a connection. | Focus email. Password choice, if adopted, must support password managers and paste. |
| Register | Form renders immediately. | Inline and summary errors; values retained. Offline blocks submission without clearing. | Focus first field; no cognitive-function test. |
| Invite preview | Skeleton matching trip summary. | Invalid/expired/rotated link gives safe explanation and “Ask the organizer for a new link.” Offline-without-cache explains connection need. | Focus page heading; no participant data is exposed before valid invite. |
| Join as guest | Name/email form. | Existing email routes to generic recovery; submission errors retain values. | Focus name; `autocomplete="name"` and `"email"`. |
| Recover guest access | Request form, then generic accepted state. | Same accepted copy regardless of account existence; offline retains email. | Focus email, then accepted-state heading. |
| Magic-link result | Verification progress with text status. | Expired, used, and generic failure each offer safe recovery. | Success moves to intended trip; focus destination heading. |
| Trips | Skeleton cards; empty state offers Create trip. | Cached trips remain visible offline; recoverable load error has Retry. | Create hidden for guests without account; focus list heading after refresh. |
| Create trip | Form with locale-derived currency default. | Inputs retained on validation/network failure; offline creation is unavailable. | Registered users only; focus trip name. |
| Account | Current settings load in place. | Offline permits local language preference only when persistence is safe. | Focus heading; session controls have explicit names. |
| Overview | Skeleton matching summary/rows; no-expense state offers Add expense. | Cached content stays visible; stale/pending notice appears beside balance. | Owner-only settings hidden without leaving empty controls; focus heading on navigation. |
| Expenses | Skeleton rows; true-empty and filtered-empty differ. | Cached list remains; failed refresh is inline; conflicts remain visible. | Edit controls shown only when authorized; focus returns to affected row. |
| Expense detail | Calculation-shaped skeleton. | Offline uses cached detail; missing cache explains limitation. | Unauthorized edit is absent; permission loss is announced. |
| Add/edit expense | Defaults produce a valid fast path. | Provider failure offers manual rate; offline save closes only after durable local persistence; storage-full preserves copyable input. | Edit permission checked before entry and save; focus amount or first invalid field. |
| Balance | Skeleton rows; all-zero state says “Everyone is settled.” | Cached balance marked stale; pending/conflict notice explains exclusions. | Readable to all trip participants; focus heading after calculation refresh is not stolen. |
| Balance breakdown | Expanded row loads contributions in place. | Partial data names what is missing and offers Retry. | Disclosure remains operable by keyboard; focus stays on trigger. |
| People | Skeleton groups; empty group explains participant/family distinction. | Offline view is read-only unless a mutation is explicitly supported. | Owner controls hidden/disabled with visible “Owner only” context where ambiguity remains. |
| Family editor | Current name/share count shown with impact preview. | Values retained after save failure; offline change only if outbox supports it. | Owner only; focus name or first invalid field. |
| Trip settings | Current values load by section. | Cached view is read-only where mutation safety is unknown. Delete shows named consequences plus an acknowledgment checkbox before enabling “Delete trip.” | Owner only; unauthorized route returns to Overview with explanation. |
| Sync Center | Empty state: “All changes synced.” | Pending, syncing, failed, and conflict rows persist with available action. | Every retry/review action has accessible name; resolution returns focus to affected row. |
| PWA install explainer | Appears only after join or first expense. | Unsupported/manual platforms get accurate steps; dismissal persists. | Optional; focus remains in current task unless user opens the explainer. |

During background refresh, usable cached content remains in place. No data region uses a full-screen spinner over readable content.

## Interaction Primitives

- Tap/click activates visible controls; hover never reveals the only action.
- Tab order follows reading order. Shift+Tab reverses it. Escape closes the top non-destructive overlay.
- Enter submits when focus is in a conventional form context; Ctrl/Cmd+Enter is not required for any core task.
- Disclosure uses a button with `aria-expanded` and `aria-controls`; expanded content follows its trigger in DOM order.
- Lists use explicit “Load more” pagination unless assistive-technology verification proves a virtualized alternative equivalent.
- No core task requires drag, swipe, long-press, precise tapping, or timed completion.
- Repeated Save/Create taps share one idempotency key and never create duplicate-looking expenses.
- Route changes move focus to the page heading except when an operation intentionally returns focus to its originating row/control.
- PWA installation never interrupts join, expense capture, balance review, or conflict resolution.

## Financial Language & Calculation Disclosure

- A signed amount is never the only meaning. Use “You owe,” “You are owed,” “Owes,” “Is owed,” or “Settled,” followed by an absolute formatted amount.
- Family rows state identity and share count, for example “Family · 2 shares.”
- Expanded balance rows end with the arithmetic summary and list contributing expenses.
- Cross-currency details show original amount, base amount, rate direction, rate date, source, and whether the rate is a saved snapshot or custom.
- Pending local expenses produce a nearby sentence stating how many changes are excluded from the displayed balance.
- The MVP does not imply a settlement-transfer matrix.

## Offline & Sync Contract

- Local work is real work. An expense becomes visible only after durable local persistence succeeds.
- Pending expenses remain in the normal expense list and survive PWA restart.
- Global status progresses through: Offline → Waiting to sync → Syncing → Synced, Failed, or Needs attention.
- Routine “Synced” feedback may recede after five seconds; pending, failed, offline, and conflict states persist.
- A conflict comparison shows only changed fields under “Current trip version” and “Your offline change” when the Sync API provides a trustworthy server snapshot.
- Scoped Sprint 5 decision for `STORY-017`: `expense.create` without a server snapshot shows the full local draft and reason in read-only form with Copy; changed-field comparison, “Apply my values,” accept-current and discard are deferred until the API guarantees safe resolution semantics.
- “Apply my values” may appear in later mutation flows only when authorization and the Sync API explicitly permit it. Otherwise the person can keep/copy the local draft.
- Neither a retry nor a reconnect can duplicate an expense.

## Accessibility Floor

Target: WCAG 2.2 AA for all user-facing routes.

- Normal text contrast is at least 4.5:1; large text, focus indicators, and essential component boundaries are at least 3:1.
- Interactive boundaries use `{colors.border-control}`; subtle dividers may use `{colors.border-subtle}` only when they are not required to identify a control.
- Focus uses a 2px `{colors.focus-gap}` plus 3px `{colors.focus-ring}` outer ring. It must remain visible on white, background, primary, semantic, and forced-color surfaces.
- All operations work with keyboard alone. Focus is never fully hidden by sticky headers, bottom navigation, sheets, or the on-screen keyboard.
- Targets are at least 48×48 CSS px on mobile and 44×44 elsewhere, with enough separation to avoid accidental activation.
- Authentication supports paste, password managers/passkeys when applicable, and does not require solving, recalling, or transcribing a cognitive-function test.
- Previously entered information is not requested again in the same process unless essential for security. Trip deletion uses named consequences plus an acknowledgment checkbox; it never requires exact-name typing.
- Status, balance direction, validation, selection, and sync never rely on color alone.
- Screen-reader announcements are concise and debounced: polite for copied/saved/sync progress; alert for persistence failure, permission loss, and unresolved conflict.
- Text supports 200% scaling, text-spacing overrides, and reflow to 320 CSS px without two-dimensional scrolling for core content.
- Reduced motion removes non-essential transitions and rotating indicators while retaining static status text.
- Forced-colors mode uses system colors for boundaries, selection, and focus; custom icons remain visible.
- Test matrix: keyboard in Chrome/Firefox/Safari; VoiceOver + Safari; NVDA + Firefox/Chrome; TalkBack + Chrome; 320/390/768/1024/1440 px plus landscape; 200% zoom and 320 CSS px reflow; text spacing; reduced motion; forced colors; axe on primary routes.

## Responsive & Platform

| Viewport | Layout | Navigation | Forms and overlays |
|---|---|---|---|
| 320–767px | Single column, 16px gutter | Bottom trip navigation | Full-width controls; page-based expense form; short bottom sheets |
| 768–1023px | One/two columns, 24px gutter | Compact left rail | Forms up to 560px; centered dialogs or sheets |
| 1024–1439px | Rail + content, max 1200px content | Full labeled rail | Supporting content may be two-column; primary form remains single-column |
| 1440px+ | Centered shell, max 1440px | Full rail | More whitespace, not denser primary forms |

Long names, emails, currencies, and translations wrap without covering controls. Russian and English layouts allow at least 35% string expansion. Sticky actions account for safe-area insets. Mobile tables become semantic card lists; primary financial content never requires horizontal scrolling.

## Key Flows

### Flow 1: Создание поездки зарегистрированным пользователем

**Анна**, organizing a five-person trip from her phone before boarding, has not used Owebee before.

1. Anna opens Owebee and chooses Register.
2. She creates an accessible account or signs in without a cognitive-function challenge.
3. Trips opens and moves focus to the page heading; the empty state offers Create trip.
4. She enters “Georgia 2026”; RUB is preselected from locale, and she changes it if needed.
5. She submits. The action shows “Creating trip…” without changing width or accepting a second activation.
6. **Climax:** Invite ready appears with the trip name, labeled link, Copy, supported Share, and Open trip. Anna copies the link; “Copied” is announced and the link remains available.

Failure: registration, creation, or network failure retains every entered value, focuses the error summary, and provides a retry. Offline trip creation explains that a connection is required.

### Flow 2: Присоединение гостя

**Михаил**, standing outside a hotel with one hand free and weak mobile signal, opens Anna’s invite link.

1. Invite preview shows trip name, organizer, base currency, and why email is requested.
2. Mikhail chooses Join as guest; focus moves to Name.
3. He enters name and email using browser autofill and submits.
4. **Climax:** Trip Overview opens without a registration wall. The heading names the trip, and the Add expense action is immediately available.

Failure: an expired/rotated invite asks him to request a new link. If the email already belongs to a participant, the generic path offers “Email me a sign-in link” without revealing account existence. Offline input remains intact.

### Flow 3: Добавление расхода

**Елена**, representing her family of two at dinner, needs to record a €48.20 bill before putting her phone away.

1. Elena activates Add expense; Amount receives focus beside Currency.
2. She enters €48.20 and “Dinner.” Payer, date, and all active calculation units already have valid defaults.
3. She opens Split only to verify “5 personal shares; Ivanov family receives 2 of 5.”
4. The provider supplies the date-specific rate; the review sentence shows `€1 = ₽92.50; €48.20 becomes ₽4,458.50`.
5. She activates “Add €48.20.”
6. **Climax:** The form closes after durable save and the expense appears once in the normal list with its original amount and “Synced.”

Failure: rate lookup offers a custom rate; validation focuses the error summary; server failure retains all entries. Repeated activation never duplicates the row.

### Flow 4: Offline расход и sync

**Сергей**, on a train with no connection, adds a grocery expense and later reconnects.

1. Overview shows “Offline — changes stay on this device” while cached trip data remains readable.
2. Sergey opens Add expense, enters the amount and description, and saves.
3. Local persistence completes; the form closes and announces “Saved on this device. It will sync when you’re online.”
4. The expense appears in the normal list as “Waiting to sync.” Sergey closes and reopens the installed PWA; the row remains.
5. Connectivity returns. Global status moves through “Syncing 1 of 1.”
6. **Climax:** The same row changes to “Synced,” the balance refreshes once, and a polite announcement confirms completion without moving focus.

Failure: a safe retry remains pending. A version/permission conflict becomes “Needs attention” and preserves the local payload. When the Sync API provides a trustworthy server snapshot, it may open the changed-field comparison shown in [Sync conflict](mockups/sync-conflict.html). In Sprint 5 `STORY-017`, `expense.create` without that snapshot instead opens the full local draft read-only with Copy and no resolution action.

### Flow 5: Просмотр баланса

**Ольга**, checking what her family owes before checkout, opens Balance on a 390px phone.

1. The page heading and base currency establish context.
2. Her summary reads “You owe ₽3,200,” never a bare negative value.
3. The Ivanov family row states “Family · 2 shares” and repeats the direction sentence.
4. Olga opens Show calculation; contributing expenses, original amounts, rates, and share arithmetic appear under the trigger.
5. **Climax:** The breakdown ends with a plain arithmetic summary matching ₽3,200, so Olga can explain the total without asking the organizer or opening a spreadsheet.

Failure: cached data remains visible offline with a stale timestamp. Pending/conflict expenses produce a sentence stating what the balance excludes; a partial-data error identifies the missing portion and offers Retry.

## Open Product Decisions

These decisions do not change the interaction spine above, but they must resolve before the affected stories become implementation-ready:

1. Registered-user authentication: password, passwordless email, passkey, or a supported combination. The chosen method must preserve the Accessibility Floor.
2. Family domain model: aggregate record only or named member records beneath the aggregate.
3. Share-count changes: recalculate existing expenses or affect future/default splits only.
4. Supported currency catalog, decimal display rules, and provider-attribution wording.
5. Conflict actions supported by the Sync API beyond read-only review/copy. Sprint 5 `STORY-017` intentionally ships no apply/accept/discard action for `expense.create`.
6. Retention, recovery, and participant-facing outcome after trip deletion.

Until resolved, UI copy and controls must not imply behavior that the domain model or API cannot guarantee.

## Source Coverage

Requirement names mirror the PRD; this table records UX disposition without restating acceptance criteria.

| Source item | UX disposition | Contract location |
|---|---|---|
| FR-001: Создание зарегистрированного аккаунта | Covered | IA, State Patterns, Flow 1 |
| FR-002: Создание поездки зарегистрированным пользователем | Covered | Flow 1 |
| FR-003: Редактирование базовой валюты поездки | Covered | IA, Component Patterns, State Patterns |
| FR-004: Приглашение участников по ссылке | Covered | Invite link field, Flow 1 |
| FR-005: Гостевой вход по ссылке, имени и email | Covered | Flow 2 |
| FR-006: Восстановление гостевого доступа через email magic link | Covered | IA, State Patterns |
| FR-007: Управление участниками и семьями | Covered | IA, Share selector/stepper, State Patterns |
| FR-008: Добавление расхода | Covered | Flow 3 |
| FR-009: Редактирование расходов по ролям | Covered | State Patterns, Component Patterns |
| FR-010: Просмотр всех расходов всеми участниками | Covered | IA, Expense row |
| FR-011: Расчет персональных долей и семейной агрегации | Covered | Financial Language, Flows 3 and 5 |
| FR-012: Мультивалютный расход и snapshot курса | Covered | Financial Language, Flow 3 |
| FR-013: Ручная правка курса валюты | Covered | State Patterns, Flow 3 failure |
| FR-014: Поддержка популярных валют Европы, СНГ, USD и EUR | Covered as searchable currency behavior; catalog remains source-owned | Select/combobox |
| FR-015: Отображение баланса без обязательной минимизации переводов | Covered | Financial Language, Flow 5 |
| FR-016: Архивирование поездки | Covered | IA and Trips states |
| FR-017: Удаление поездки с подтверждением | Covered | Button — destructive, Accessibility Floor |
| FR-018: Offline-режим и синхронизация | Covered | Offline & Sync, Flow 4 |
| FR-019: Русский и английский интерфейс | Covered | Voice and Tone, Responsive & Platform |
| FR-020: Установка PWA | Covered | IA, State Patterns, Interaction Primitives |
| FR-021: История изменений расходов | Covered | Expense detail |
| FR-022: Экспорт данных поездки | Deferred with PRD COULD priority; no MVP surface | Source-owned future scope |
| NFR-001: Время открытия основных экранов | UX supports stable skeleton/cached states; timing remains architecture/testing-owned | State Patterns |
| NFR-002: Время пересчета баланса | UX defines non-disruptive refresh; timing remains architecture/testing-owned | Balance state |
| NFR-003: Контроль доступа | Covered behaviorally; server enforcement remains architecture-owned | State Patterns |
| NFR-004: Безопасность magic link | Covered behaviorally; token controls remain architecture-owned | Magic-link states |
| NFR-005: Профиль нагрузки MVP | UX supports explicit pagination and verified virtualization | Interaction Primitives |
| NFR-006: Надежность синхронизации offline-изменений | Covered | Offline & Sync, Flow 4 |
| NFR-007: Доступность и responsive | Covered, raised to WCAG 2.2 AA | Accessibility, Responsive |
| NFR-008: Скорость выполнения ключевых flow | Covered | Flows 1 and 3 |
| NFR-009: Покрытие расчетной логики тестами | Not UX-owned; explainability supports verification | Financial Language |
