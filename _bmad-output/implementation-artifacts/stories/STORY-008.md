---
baseline_commit: 790839e40bab8988929b7fbcd599fb0976676f9c
---

# Family share allocation and breakdown

- **ID:** STORY-008
- **Epic:** EPIC-003 - Participants, families and shares
- **Priority:** Must Have
- **Story Points:** 5
- **Status:** done

## User Story

As a **trip participant**  
I want **family targets to contribute their snapshotted number of personal shares**  
So that **expense allocation is fair and the family total can be explained**

## Acceptance Criteria

- [ ] Every accepted expense is allocated only across its selected split targets, proportionally to each split row's snapshotted `shareCount`.
- [ ] A member target contributes its snapshotted personal share count and a family target contributes its snapshotted family share count.
- [ ] Allocation uses the expense's persisted `convertedAmount`; it never fetches a current rate or mutates an expense snapshot.
- [ ] Allocation is decimal-safe and deterministic for repeating fractions: use `max(convertedAmount scale, 8)` decimal places and assign remaining smallest units by `(target_type, target_id)`.
- [ ] A family allocation result includes family ID, display name, snapshotted share count, allocated amount, and per-expense explanation data.
- [ ] Deleted expenses are excluded, while accepted expenses in active or archived trips remain calculable.

## Tasks / Subtasks

- [x] Task 1: Implement exact decimal primitives for proportional allocation (AC: 1, 3, 4)
  - [x] Add `apps/api/src/calculation/decimal-ratio.ts` using decimal-string parsing and `BigInt`; do not use `Number` for financial values.
  - [x] Normalize output at `max(convertedAmount input scale, 8)` while retaining trailing zeros required by that scale.
  - [x] Allocate by floor division, then distribute remaining smallest units in ascending `(targetType, targetId)` order.
  - [x] Reject malformed, zero, or negative amounts/weights explicitly.
- [x] Task 2: Implement the pure family allocation contract (AC: 1, 2, 3, 5)
  - [x] Add `apps/api/src/calculation/family-allocation.ts` with typed expense, split, allocation, and explanation records.
  - [x] Use only persisted `convertedAmount` and each split row's snapshotted `shareCount`.
  - [x] Reject duplicate `(targetType, targetId)` split targets at the calculation boundary.
  - [x] Include family ID, display name, snapshotted share count, allocated amount, and expense explanation data.
- [x] Task 3: Prove calculation behavior with unit tests (AC: 1-5)
  - [x] Add equal-member, weighted-family, fractional-weight, one-target, repeating-fraction, deterministic-residual, and exact-sum tests.
  - [x] Add invalid amount, invalid weight, empty splits, and duplicate-target tests.
  - [x] Verify the calculation module reaches at least 90% statement/branch/function/line coverage.
- [x] Task 4: Add a read-only persistence adapter for accepted expenses (AC: 3, 6)
  - [x] Add `apps/api/src/calculation/allocation-loader.ts` to load accepted, non-deleted expense/split rows in a bounded query set.
  - [x] Preserve archived-trip calculability and exclude deleted expenses without consulting a rate provider.
  - [x] Resolve member/family display names without N+1 queries.
- [x] Task 5: Add database integration and manual-fixture evidence (AC: 1-6)
  - [x] Add `apps/api/src/calculation/allocation-loader.test.ts` using existing PGlite migrations and representative member/family splits.
  - [x] Verify deleted expenses are excluded and persisted converted amounts/snapshotted weights drive results.
  - [x] Record the hand calculation for two one-share members plus one two-share family.
- [x] Task 6: Run full quality gates and update story evidence (AC: 1-6)
  - [x] Run focused tests, full tests, coverage, lint, typecheck, and build.
  - [x] Update Dev Agent Record, File List, Change Log, and story/sprint status only after all gates pass.

### Review Findings

- [x] [Review][Decision] Coverage provider dependency approved — retain `@vitest/coverage-v8` in `apps/api/package.json` and `pnpm-lock.yaml`.
- [x] [Review][Patch] Keep residual distribution entirely in `BigInt` instead of converting financial units with `Number(residual)` [apps/api/src/calculation/decimal-ratio.ts:47]
- [x] [Review][Patch] Assert that allocated units exactly equal input amount units after residual distribution [apps/api/src/calculation/decimal-ratio.ts:47]
- [x] [Review][Patch] Reject duplicate keys in the exported decimal allocation primitive before constructing the result `Map` [apps/api/src/calculation/decimal-ratio.ts:19]
- [x] [Review][Patch] Add the required positive test for fractional split weights [apps/api/src/calculation/decimal-ratio.test.ts:8]
- [x] [Review][Patch] Make the integration test distinguish persisted `convertedAmount` from the original amount [apps/api/src/calculation/allocation-loader.test.ts:64]
- [x] [Review][Patch] Surface accepted expenses without split rows instead of silently dropping them through an inner join [apps/api/src/calculation/allocation-loader.ts:32]
- [x] [Review][Patch] Reject split targets that belong to a different trip instead of loading their display data into the calculation [apps/api/src/calculation/allocation-loader.ts:34]

## Technical Notes

### Implementation Approach

Create a pure calculation module. Represent money and weights without JavaScript floating-point arithmetic. For each expense, divide `convertedAmount` by the sum of selected split weights, multiply by each target weight, and preserve an explanation record. Calculate at `max(convertedAmount scale, 8)` decimal places and assign any remaining smallest units deterministically by `(target_type, target_id)` so allocated totals equal the persisted expense amount.

Implementation algorithm:

1. Parse unsigned decimal strings into `{ coefficient: bigint, scale: number }`; preserve the converted amount's source scale.
2. Convert all weights to a common integer scale.
3. Convert `convertedAmount` to integer smallest units at `outputScale = max(inputScale, 8)`.
4. For each sorted target, calculate `floor(amountUnits * weightUnits / totalWeightUnits)`.
5. Distribute the positive residual one smallest unit at a time in sorted target order. The residual is strictly less than target count.
6. Format every allocation at exactly `outputScale` digits and assert allocated units equal input amount units.

### Files/Modules Affected

- `apps/api/src/calculation/decimal-ratio.ts` - rational allocation and residual handling.
- `apps/api/src/calculation/family-allocation.ts` - pure expense allocation.
- `apps/api/src/calculation/*.test.ts` - table-driven domain tests.
- `apps/api/src/calculation/allocation-loader.ts` - bounded read-only persistence adapter.

### Data Model Changes

No new canonical tables. Use `expenses`, `expense_splits`, and their snapshotted decimal values.

### API Changes

No public endpoint in this story. Export typed calculation results for STORY-014 and STORY-015.

### Edge Cases

- One selected target receives the full converted amount.
- Fractional share counts such as `2.5` remain exact inputs.
- Repeating allocations remain deterministic and sum back to the expense total.
- Duplicate targets are impossible by schema but rejected by the calculation boundary.
- Zero/negative amounts or weights fail explicitly.
- Empty split lists fail explicitly.
- Target ordering in the input must not affect residual assignment or output.

### Security Considerations

The pure module receives already-authorized trip data and must not perform cross-trip queries.

The loader accepts a trip ID but performs no authorization; STORY-014 owns route authorization. Do not expose the loader directly through HTTP in this story.

## Dev Notes

### Existing System Contract

- `apps/api/src/expenses/decimal.ts` already uses `BigInt` for multiplication/division. Reuse its decimal-string conventions, but do not use `divideDecimals` for allocation because its half-up rounding cannot preserve a deterministic exact-sum residual contract.
- `apps/api/src/expenses/expense-service.ts` snapshots `trip_members.share_count` or `families.share_count` into `expense_splits.share_count` at creation. Never join current share counts as calculation weights.
- Migration `apps/api/migrations/0004_sprint3_expenses.sql` stores PostgreSQL `numeric` values and guarantees one member/family target column plus positive split weights.
- Persisted expense status values are `accepted` and `deleted`; there is no separate trip-level calculation snapshot.
- The repository uses ESM imports with `.js` suffixes, strict TypeScript, Vitest, PGlite integration tests, pnpm workspace scripts, and no decimal library.

### Architecture and Scope Guardrails

- Keep the canonical calculation pure and under `apps/api/src/calculation`.
- No new npm dependency, schema migration, endpoint, balance cache, currency-provider call, or current-rate lookup belongs in STORY-008.
- PostgreSQL is source of truth; values cross TypeScript boundaries as decimal strings.
- Summary and future breakdowns must consume the same explanation records to prevent divergence.
- Calculation remains valid for accepted expenses in active or archived trips; deleted expenses are filtered before calculation.

### Output Contract

```ts
type AllocationTargetType = "family" | "member";

interface ExpenseAllocationInput {
  expenseId: string;
  convertedAmount: string;
  baseCurrencyCode: string;
  targets: Array<{
    targetType: AllocationTargetType;
    targetId: string;
    displayName: string;
    shareCount: string;
  }>;
}

interface ExpenseAllocation {
  expenseId: string;
  targetType: AllocationTargetType;
  targetId: string;
  displayName: string;
  snapshottedShareCount: string;
  allocatedAmount: string;
  outputScale: number;
}
```

The function returns allocations sorted by `(targetType, targetId)`. Family and member records use the same shape; `snapshottedShareCount` is mandatory so STORY-015 can explain historical family allocations.

### Testing and Verification

- Unit tests must assert exact strings, not approximate numeric equality.
- Required deterministic fixture: amount `1`, three equal targets → scale 8 allocations `0.33333334`, `0.33333333`, `0.33333333` according to sorted target order.
- Required weighted fixture: amount `100`, member weight `1` plus family weight `2` → `33.33333333` and `66.66666667`, with residual assigned by sorted key.
- Required manual fixture: amount `120`, two one-share members and one two-share family → `30`, `30`, `60` represented at output scale 8.
- Run targeted Vitest coverage for `src/calculation/**`; Vitest 3.2+ V8 coverage uses AST remapping, but adding a coverage provider package requires approval, so use the repository's available provider/configuration only.

### Project Structure Notes

- New files belong in `apps/api/src/calculation/`; do not add calculation behavior to routes or `ExpenseService`.
- Use `Database` from `apps/api/src/database/database.ts`.
- Follow existing PGlite setup from `apps/api/src/sprint3.test.ts` for integration coverage.

### References

- [Source: `_bmad-output/planning-artifacts/prd.md` — EPIC-003 / STORY-008]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Calculation Module]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — `expenses` and `expense_splits` entities]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — NFR-002 and exact decimal storage]
- [Source: `_bmad-output/planning-artifacts/ux-design.md` — precision, family share, and calculation-detail rules]
- [Source: `apps/api/src/expenses/decimal.ts`]
- [Source: `apps/api/src/expenses/expense-service.ts`]
- [Source: `apps/api/migrations/0004_sprint3_expenses.sql`]

## Dependencies

### Story Dependencies

- **Blocked by:** STORY-007, STORY-009
- **Blocks:** STORY-014, STORY-015

### Technical Dependencies

- Persisted `converted_amount` and snapshotted `expense_splits.share_count`.

## Testing Requirements

### Unit Tests

- [ ] Equal member allocation.
- [ ] Member plus multi-share family allocation.
- [ ] Fractional weights and repeating decimal residual.
- [ ] Sum of allocations equals the persisted expense amount.
- [ ] Invalid amount, weight, and duplicate target failures.

### Integration Tests

- [ ] Load an accepted expense with member/family splits and produce the expected allocation.
- [ ] Exclude deleted expenses.

### Manual Testing

- [ ] Compare a two-member plus two-share-family example with a hand calculation.

## Definition of Done

- [ ] All acceptance criteria are met.
- [ ] Calculation behavior is deterministic and documented.
- [ ] Critical calculation paths have at least 90% test coverage.
- [ ] Lint, typecheck, test, and build pass.
- [ ] Story status can be moved to Completed.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Create-story analysis: existing Sprint 3 decimal, expense persistence, PGlite, and migration patterns reviewed.
- RED: calculation tests failed on missing modules before implementation.
- GREEN: 13 focused tests pass; calculation coverage is 100% statements/functions/lines and 96.77% branches.
- Regression: `pnpm check` passes with 54 API tests plus web/config tests.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented exact BigInt proportional allocation with deterministic residual assignment.
- Implemented shared member/family explanation records from persisted amount and split snapshots.
- Implemented a one-query read-only loader for accepted expenses; archived trips remain calculable and deleted expenses are excluded.
- Verified manual fixture `120 / (1 + 1 + 2) = 30, 30, 60` at output scale 8.

### File List

- `_bmad-output/implementation-artifacts/stories/STORY-008.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `apps/api/package.json`
- `apps/api/src/calculation/allocation-loader.test.ts`
- `apps/api/src/calculation/allocation-loader.ts`
- `apps/api/src/calculation/decimal-ratio.test.ts`
- `apps/api/src/calculation/decimal-ratio.ts`
- `apps/api/src/calculation/family-allocation.test.ts`
- `apps/api/src/calculation/family-allocation.ts`
- `pnpm-lock.yaml`

## Change Log

- 2026-06-30: Expanded STORY-008 into an implementation-ready, test-first developer contract.
- 2026-06-30: Implemented and verified exact family/member allocation; status moved to review.
