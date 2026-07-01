---
baseline_commit: 790839e40bab8988929b7fbcd599fb0976676f9c
---

# View trip balance

- **ID:** STORY-014
- **Epic:** EPIC-006 - Balances and totals
- **Priority:** Must Have
- **Story Points:** 8
- **Status:** done

## User Story

As a **trip participant**  
I want to **see the net balance of every participant and family**  
So that **the group understands who paid more or owes more**

## Acceptance Criteria

- [ ] Any active owner or guest member can request the balance for an active or archived trip; outsiders, inactive members, deleted trips, and unauthenticated callers are rejected.
- [ ] Each accepted expense credits its payer by the persisted converted amount and debits selected targets using STORY-008 allocation.
- [ ] The response contains one deterministic line per member or family involved in the calculation, including archived historical contributors, with ID, type, display name, balance, and family share count where applicable.
- [ ] Positive balance means the target paid more than its allocated share; negative balance means it owes more than it paid.
- [ ] All balances use decimal strings in the trip base currency, and the sum of returned lines is exactly zero under the documented precision policy.
- [ ] The calculation uses one bounded query set without N+1 access and meets the architecture target for 20 participants and 300 expenses.

## Tasks / Subtasks

- [x] Task 1: Implement exact signed balance aggregation (AC: 2-5)
  - [x] Add signed decimal addition/subtraction helpers backed by `BigInt`.
  - [x] Credit each payer by persisted `convertedAmount`; debit allocation targets using the shared STORY-008 result.
  - [x] Emit deterministic member/family lines and assert their exact sum is zero.
  - [x] Cover empty trips and payer-not-selected cases with unit tests.
- [x] Task 2: Implement authorized bounded balance loading (AC: 1, 2, 3, 6)
  - [x] Add `BalanceService` authorization for active registered/guest trip membership.
  - [x] Reject missing/deleted trips, outsiders, inactive members, and cross-trip guest sessions without leaking metadata.
  - [x] Load members, families, accepted expenses, splits, and payer data in a fixed query count.
  - [x] Return active or archived entities involved by payment credit or split allocation.
- [x] Task 3: Add the balance API route (AC: 1, 3-5)
  - [x] Register `GET /api/v1/trips/:tripId/balance`.
  - [x] Return `tripId`, `baseCurrencyCode`, and exact decimal-string lines.
  - [x] Map unauthenticated calls to 401 and forbidden/hidden trip access to a structured 403.
- [x] Task 4: Add API, authorization, and calculation integration tests (AC: 1-6)
  - [x] Cover owner/guest parity, mixed member/family splits, payer-not-targeted, empty trip, and cross-currency persisted conversion.
  - [x] Cover archived readability and unauthenticated, outsider, inactive member, and deleted trip rejection.
  - [x] Instrument database access and assert query count is independent of expense count.
- [x] Task 5: Prove the representative performance target (AC: 6)
  - [x] Build a 20-participant/300-expense fixture without network/provider access.
  - [x] Assert calculation completes under 500 ms in the test environment.
- [x] Task 6: Run coverage and full repository quality gates (AC: 1-6)
  - [x] Enforce at least 90% coverage for calculation paths.
  - [x] Run lint, typecheck, all tests, and build; update story/sprint evidence only when green.

### Review Findings

- [x] [Review][Decision] Preserve historical contributions — include archived payers and split targets in balance lines when they participate in accepted expenses so snapshotted allocation and the zero-sum invariant remain intact.
- [x] [Review][Patch] Load archived payers and split targets without dropping expenses or reallocating their historical shares [apps/api/src/calculation/balance-service.ts:193]
- [x] [Review][Patch] Validate `tripId` as UUID before querying PostgreSQL so malformed route parameters cannot produce an unhandled 500 [apps/api/src/calculation/balance-service.ts:163]
- [x] [Review][Patch] Return the structured forbidden contract for an authenticated inactive guest instead of treating the token as unauthenticated [apps/api/src/calculation/balance-routes.ts:25]
- [x] [Review][Patch] Enforce the 90% calculation coverage threshold in an executable repository quality gate [apps/api/package.json:9]
- [x] [Review][Patch] Compare empty and 300-expense service query counts through the same instrumentation path [apps/api/src/sprint4.test.ts:188]
- [x] [Review][Patch] Prevent membership revocation from racing between authorization and financial data loading [apps/api/src/calculation/balance-service.ts:181]
- [x] [Review][Patch] Reject family calculation inputs without the mandatory current `shareCount` instead of emitting `undefined` [apps/api/src/calculation/balance-service.ts:102]

## Technical Notes

### Implementation Approach

Add an authorized calculation service and `GET /api/v1/trips/:tripId/balance`. Load trip members, families, accepted expenses, and splits in bounded queries, run the pure allocation module, credit payer members, aggregate family targets as one display line, and sort by target type, normalized display name, and ID.

Use exact signed integer units at a common scale for aggregation. Do not use `Number`, `parseFloat`, SQL floating-point casts, current exchange rates, or a second allocation implementation.

### Files/Modules Affected

- `apps/api/src/calculation/balance-service.ts` - authorization, loading, aggregation.
- `apps/api/src/calculation/balance-routes.ts` - endpoint and error mapping.
- `apps/api/src/app.ts` - service construction and route registration.
- `apps/api/src/sprint4.test.ts` - API, authorization, and database coverage.

### Data Model Changes

No new tables. A cache or `balance_snapshots` table is explicitly out of scope until profiling proves it necessary.

### API Changes

`GET /api/v1/trips/:tripId/balance`

Response fields:

```json
{
  "tripId": "uuid",
  "baseCurrencyCode": "RUB",
  "lines": [
    {
      "targetType": "member",
      "targetId": "uuid",
      "displayName": "Alex",
      "balance": "2500.00"
    }
  ]
}
```

### Edge Cases

- Empty trip returns `lines: []`.
- A payer not selected as a split target still receives payment credit.
- Archived trips remain readable but cannot receive new expenses.
- Deleted expenses are excluded; archived payers and targets remain visible when they have historical contributions.
- Equal names are ordered by stable IDs.

### Performance Considerations

Add a benchmark fixture with 20 participants and 300 expenses; calculation target is under 500 ms in the test environment.

### Security Considerations

Authorize membership before loading financial rows and do not expose email or session data.

## Dev Notes

### Existing Contracts to Reuse

- `apps/api/src/calculation/family-allocation.ts` is the sole allocation algorithm and exposes per-expense explanation records.
- `apps/api/src/calculation/allocation-loader.ts` currently loads allocation inputs in one query but does not include payer credits; extend or replace it without duplicating allocation math.
- `apps/api/src/auth/trip-actor.ts` resolves registered and guest bearer sessions. Routes must call it before `BalanceService`.
- `apps/api/src/expenses/expense-service.ts` demonstrates active membership checks and structured route errors.
- `apps/api/src/app.ts` constructs services explicitly; register the balance route there.

### Exact Aggregation Rules

- Convert each decimal string to signed `{ coefficient: bigint, scale }`.
- For each contribution, align scales before addition; retain the maximum observed scale, with a minimum line scale of 8.
- Payer contribution is positive `convertedAmount`; allocated target contribution is negative `allocatedAmount`.
- The payer may also be a split target; aggregate both contributions into one member line.
- Return only entities with at least one contribution, including zero-net lines.
- Assert aggregate signed units equal zero before formatting.
- Sort by `targetType`, `displayName.normalize("NFKC").toLocaleLowerCase("en")`, then `targetId`.

### Query and Authorization Guardrails

- Query 1: trip metadata only.
- Query 2: active actor membership only (owner included; do not special-case owner without checking active membership).
- After authorization, use a bounded query set for active member/family display metadata and accepted expense/payer/split rows.
- Archived trips are readable; deleted/missing trips and unauthorized actors return the same forbidden contract.
- Filter deleted expenses while retaining display metadata for archived historical contributors.
- No email, user ID, session hash, rate-provider call, or mutable current family share count may enter the response.

### API Contract

```json
{
  "tripId": "uuid",
  "baseCurrencyCode": "RUB",
  "lines": [
    {
      "targetType": "family",
      "targetId": "uuid",
      "displayName": "Family",
      "balance": "-66.66666667",
      "shareCount": "2"
    }
  ]
}
```

Family `shareCount` is current display metadata; calculation weights and future breakdowns remain snapshotted per expense.

### Testing and Performance

- Use existing PGlite/API helpers from `apps/api/src/sprint3.test.ts`.
- Inject or wrap `Database.query` to count calls; compare empty/small and 300-expense cases.
- Generate the benchmark fixture directly in PostgreSQL/PGlite to avoid timing HTTP setup.
- Time only the balance service call with `performance.now()`; keep the 500 ms assertion focused on the representative calculation path.
- Use the installed `@vitest/coverage-v8` provider for the 90% calculation threshold.

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Calculation Module]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Balance API]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — NFR-002]
- [Source: `_bmad-output/planning-artifacts/ux-design.md` — balance direction and precision]
- [Source: `apps/api/src/calculation/family-allocation.ts`]
- [Source: `apps/api/src/auth/trip-actor.ts`]
- [Source: `apps/api/src/app.ts`]

## Dependencies

### Story Dependencies

- **Blocked by:** STORY-008, STORY-009, STORY-011
- **Blocks:** STORY-015, settlement and export stories

### Technical Dependencies

- Shared registered/guest actor resolver.
- Pure family allocation contract from STORY-008.

## Testing Requirements

### Unit Tests

- [ ] Payer credit and target debit aggregation.
- [ ] Zero-sum invariant and deterministic line ordering.
- [ ] Empty trip and payer-not-targeted cases.

### Integration Tests

- [ ] Owner and guest receive the same balance.
- [ ] Mixed member/family and same/cross-currency expenses use persisted converted amounts.
- [ ] Archived trip is readable; outsider, inactive member, deleted trip, and unauthenticated caller are rejected.
- [ ] Query count remains bounded as expense count grows.

### Manual Testing

- [ ] Create several expenses and compare the API balance with a hand calculation.

## Definition of Done

- [ ] All acceptance criteria are met.
- [ ] Authorization, zero-sum behavior, and performance are covered.
- [ ] Critical calculation paths have at least 90% test coverage.
- [ ] Lint, typecheck, test, and build pass.
- [ ] Story status can be moved to Completed.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Create-story analysis: STORY-008 calculation, route registration, actor resolution, and Sprint 3 PGlite patterns reviewed.
- RED: balance unit tests failed on missing signed aggregation/service modules; API tests failed on missing route.
- GREEN: 27 focused tests pass with 97.86% statements/lines, 100% functions, and 93.06% branches across calculation modules.
- Regression: `pnpm check` passes with 68 API tests plus web/config suites.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Added exact payer-credit and allocation-debit aggregation with a runtime zero-sum invariant.
- Added authorized owner/guest balance API for active and archived trips with structured access errors.
- Kept the service data path at three queries independent of expense count.
- Verified the 20-participant/300-expense calculation target under 500 ms.
- Preserved snapshotted historical balances for archived contributors and closed all seven code-review findings.
- Added transactional membership locks, malformed-ID protection, structured inactive-guest denial, and an enforced 90% calculation coverage gate.

### File List

- `_bmad-output/implementation-artifacts/stories/STORY-014.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/api/package.json`
- `apps/api/src/app.ts`
- `apps/api/src/auth/trip-actor.ts`
- `apps/api/src/calculation/balance-routes.ts`
- `apps/api/src/calculation/balance-service.test.ts`
- `apps/api/src/calculation/balance-service.ts`
- `apps/api/src/calculation/signed-decimal.test.ts`
- `apps/api/src/calculation/signed-decimal.ts`
- `apps/api/src/invites/invite-service.ts`
- `apps/api/src/sprint4.test.ts`
- `apps/api/vitest.config.ts`

## Change Log

- 2026-06-30: Expanded STORY-014 into an implementation-ready, test-first developer contract.
- 2026-06-30: Implemented and verified the authorized zero-sum trip balance; status moved to review.
- 2026-07-01: Addressed all code-review findings, enforced historical archived-contributor accounting, and moved the story to done.
