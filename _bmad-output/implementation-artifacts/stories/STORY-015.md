---
baseline_commit: 790839e40bab8988929b7fbcd599fb0976676f9c
---

# Explain trip balance

- **ID:** STORY-015
- **Epic:** EPIC-006 - Balances and totals
- **Priority:** Should Have
- **Story Points:** 5
- **Status:** done

## User Story

As a **trip participant**  
I want to **open a balance line and see which expenses produced it**  
So that **I can verify the result without a manual spreadsheet**

## Acceptance Criteria

- [ ] An authorized trip member can request a member or family balance breakdown using the same access policy as STORY-014.
- [ ] The response reconciles exactly to the selected balance line and separates payer credits from allocated-share debits per expense.
- [ ] Each contribution includes expense ID, date, description, payer summary, original amount/currency, persisted converted amount/base currency, signed contribution, and rate snapshot summary.
- [ ] Family breakdown includes the family's snapshotted share count used by each expense.
- [ ] Results are ordered by expense date descending, then creation time and ID descending, with deterministic cursor pagination.
- [ ] Foreign-trip, inactive, unknown, and malformed targets/cursors return structured errors without leaking trip metadata.

## Tasks / Subtasks

- [x] Task 1: Preserve a reusable contribution trace from balance calculation (AC: 2-4)
  - [x] Add typed payer-credit and allocated-share-debit records derived from persisted expense data and STORY-008 allocations.
  - [x] Include expense, payer, original/converted amount, base/original currency, and immutable rate snapshot metadata.
  - [x] Include snapshotted family share count on family debit records.
  - [x] Prove signed contributions reconcile exactly to each summary line.
- [x] Task 2: Implement target validation and deterministic pagination (AC: 1, 5, 6)
  - [x] Validate target type, UUID, limit, and opaque cursor with structured errors.
  - [x] Authorize the route trip before resolving the requested target.
  - [x] Sort by expense date, creation timestamp, and expense ID descending; add contribution type as a stable final tie-breaker.
  - [x] Encode all ordering fields in the cursor and prevent duplicates/omissions.
- [x] Task 3: Implement the balance breakdown service and endpoint (AC: 1-6)
  - [x] Add `GET /api/v1/trips/:tripId/balance/:targetType/:targetId`.
  - [x] Reuse the STORY-014 authorization policy and the same STORY-008 allocation path.
  - [x] Return target metadata, reconciled balance, items, and `nextCursor`.
  - [x] Keep target and expense loading bounded without per-item queries.
- [x] Task 4: Add unit and integration tests (AC: 1-6)
  - [x] Cover member/family reconciliation, payer-only credit, zero-net target, and historical family snapshots.
  - [x] Cover same-currency and cross-currency immutable rate summaries.
  - [x] Cover stable multi-page traversal without duplicates or omissions.
  - [x] Cover malformed cursor/type/UUID, foreign/unknown/inactive target, outsider, and unauthenticated rejection.
- [x] Task 5: Run coverage and full quality gates (AC: 1-6)
  - [x] Enforce at least 90% coverage for calculation paths.
  - [x] Run lint, typecheck, all tests, and build; update story/sprint evidence only when green.

### Review Findings

- [x] [Review][Patch] Keep archived historical payers and split targets in detailed rows so breakdown uses the same allocation set as summary [apps/api/src/calculation/balance-service.ts:341]
- [x] [Review][Patch] Allow breakdown for archived targets that are visible as historical summary lines [apps/api/src/calculation/balance-service.ts:313]
- [x] [Review][Patch] Execute authorization, summary, target resolution, and detailed loading in one transaction snapshot with membership locking [apps/api/src/calculation/balance-service.ts:247]
- [x] [Review][Patch] Apply target/cursor filtering and `limit + 1` before materializing the full trip history [apps/api/src/calculation/balance-service.ts:271]
- [x] [Review][Patch] Validate target type, UUID, limit, and cursor before running the expensive summary calculation [apps/api/src/calculation/balance-service.ts:264]
- [x] [Review][Patch] Reject empty, non-canonical, non-strict, or invalid-timestamp cursors instead of falling back to page one [apps/api/src/calculation/balance-service.ts:268]
- [x] [Review][Patch] Accept limits only in canonical decimal form from 1 through 100 [apps/api/src/calculation/balance-service.ts:570]
- [x] [Review][Patch] Complete the required test matrix for historical contributors, payer-only/empty cases, target errors, strict validation, and ordering tie-breakers [apps/api/src/sprint4.test.ts:422]

## Technical Notes

### Implementation Approach

Reuse the STORY-008 explanation records and STORY-014 authorization/query model. Add a target-filtered breakdown endpoint; do not independently recalculate conversion or allocation with a second algorithm.

Represent payer credits and allocation debits as separate contribution items. If a payer is also a split target, the expense produces two items whose signed sum may be zero; this makes the reconciliation auditable rather than collapsing causally different entries.

### Files/Modules Affected

- `apps/api/src/calculation/balance-service.ts` - target breakdown and reconciliation.
- `apps/api/src/calculation/balance-routes.ts` - breakdown route and cursor validation.
- `apps/api/src/sprint4.test.ts` - reconciliation, snapshots, pagination, access control.

### Data Model Changes

No schema changes.

### API Changes

`GET /api/v1/trips/:tripId/balance/:targetType/:targetId?limit=20&cursor=opaque`

### Edge Cases

- Target has payment credits but no allocated debits.
- Family share count differs between historical expenses because split rows are snapshots.
- Same-currency expense reports rate `1` and `same_currency`.
- Target with zero net balance can still have non-empty contributions.
- Empty breakdown returns an empty item list and zero balance.

### Performance Considerations

Use cursor fields aligned with the expense-history index and avoid per-item queries.

### Security Considerations

Authorize the route trip before resolving the requested target.

## Dev Notes

### Existing Contracts to Reuse

- `BalanceService.getBalance` performs trip/member authorization and uses a three-query bounded path.
- `calculateBalanceLines` and `allocateExpense` are the canonical summary/allocation implementations.
- `ExpenseService.listExpenses` already defines the required history order and opaque base64url cursor style.
- `currency_rate_snapshots` contains immutable `rate`, `rate_date`, `source`, and `is_manual` values for every accepted expense.

### Contribution Contract

Each item must contain:

- `contributionType`: `payer_credit` or `allocated_share_debit`.
- Expense ID, expense date, description, and creation timestamp (timestamp may remain cursor-only).
- Payer `{ id, displayName }`.
- Original amount/currency and persisted converted amount/base currency.
- Signed exact `contribution` (`+convertedAmount` for credit, `-allocatedAmount` for debit).
- Rate snapshot `{ rate, rateDate, source, isManual }`.
- `snapshottedShareCount` only for an allocated family debit.

The response-level `balance` equals the exact sum of all contribution items for the selected target and must equal the corresponding `GET .../balance` line.

### Pagination Contract

- Default limit 20, range 1-100.
- Order: `expenseDate DESC`, `createdAt DESC`, `expenseId DESC`, then `contributionType ASC`.
- Cursor payload contains all four ordering fields and is base64url-encoded JSON.
- Fetch/derive `limit + 1`, return the first `limit`, and build `nextCursor` from the final returned item.
- A malformed/unsupported cursor returns `balance.invalid_cursor`; it must never fall back to page one.

### Security and Error Contract

- Resolve the actor, trip, and active membership first.
- Then validate/resolve a target scoped to the authorized trip.
- Invalid target type/UUID/cursor/limit: 400 structured error.
- Unknown, inactive targets without historical contributions, or foreign targets: one indistinguishable `balance.target_not_found` response. Archived targets with visible historical balance lines remain explainable.
- Unauthorized callers receive the same 401/403 policy as STORY-014.

### Scope Guardrails

- No new schema, cache, second allocation formula, exchange-rate fetch, or per-item query.
- Use decimal strings and `BigInt` helpers only.
- Do not expose email, user IDs, session data, internal creation actor, or raw cursor timestamps outside the opaque cursor.

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Calculation Module and Balance API]
- [Source: `_bmad-output/planning-artifacts/ux-design.md` — calculation details and precision]
- [Source: `apps/api/src/calculation/balance-service.ts`]
- [Source: `apps/api/src/calculation/family-allocation.ts`]
- [Source: `apps/api/src/expenses/expense-service.ts` — expense cursor]
- [Source: `apps/api/migrations/0004_sprint3_expenses.sql`]

## Dependencies

### Story Dependencies

- **Blocked by:** STORY-008, STORY-014
- **Blocks:** export and richer settlement explanations

### Technical Dependencies

- Balance calculation and explanation records from STORY-008/STORY-014.

## Testing Requirements

### Unit Tests

- [ ] Signed contribution mapping and line reconciliation.
- [ ] Cursor encode/decode and stable ordering.
- [ ] Historical family share snapshots.

### Integration Tests

- [ ] Member and family breakdowns reconcile to summary balances.
- [ ] Cross-currency contribution returns the persisted snapshot.
- [ ] Pagination has no duplicates or omissions.
- [ ] Unauthorized and foreign-target requests are rejected.

### Manual Testing

- [ ] Expand a member and family line and verify every displayed contribution.

## Definition of Done

- [ ] All acceptance criteria are met.
- [ ] Breakdown reconciles to summary for all automated fixtures.
- [ ] Pagination and authorization tests pass.
- [ ] Lint, typecheck, test, and build pass.
- [ ] Story status can be moved to Completed.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Create-story analysis: shared allocation/balance core, immutable rate snapshots, and existing expense cursor patterns reviewed.
- RED: breakdown integration tests failed on the absent target route.
- GREEN: 29 focused tests pass with 98% statements/lines, 100% functions, and 92.68% branches across calculation modules.
- Regression: `pnpm check` passes with 70 API tests plus web/config suites.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Added separate payer-credit and allocated-share-debit trace items from the canonical allocation path.
- Added exact response-to-summary reconciliation, including zero-net targets.
- Added deterministic opaque cursor pagination with historical family share and immutable rate details.
- Added structured malformed cursor/request and non-leaking target-not-found errors.
- Closed all eight code-review findings with a shared repeatable-read snapshot, bounded `limit + 1` candidate loading, strict cursor validation, and archived-contributor breakdown support.

### File List

- `_bmad-output/implementation-artifacts/stories/STORY-015.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/api/src/calculation/balance-routes.ts`
- `apps/api/src/calculation/balance-service.test.ts`
- `apps/api/src/calculation/balance-service.ts`
- `apps/api/src/sprint4.test.ts`

## Change Log

- 2026-06-30: Expanded STORY-015 into an implementation-ready, test-first developer contract.
- 2026-06-30: Implemented and verified paginated balance explanations; status moved to review.
- 2026-07-01: Addressed all code-review findings and moved the story to done.
