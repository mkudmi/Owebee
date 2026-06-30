# Sprint Plan: Owebee

- **Sprint Number:** 4
- **Sprint Dates:** 2026-07-28 - 2026-08-10
- **Sprint Duration:** 2 weeks / 10 working days
- **Created:** 2026-06-30
- **Status:** Planned

## Sprint Overview

**Sprint Goal:** Turn accepted expenses into an explainable, zero-sum trip balance: allocate member and family shares deterministically, expose the shared balance to every trip member, and provide per-expense breakdowns.

**Sprint Capacity:** 20 story points
**Stories Planned:** 3 stories
**Committed Story Points:** 18 points

**Capacity Calculation:**

- Sprint 1 completed 20/20 points.
- Sprint 2 completed 20/20 points.
- Sprint 3 completed 19/19 points.
- Three-sprint rolling average is 19.7 points; recommended capacity is 20.
- Commit 18 points and retain 2 points for calculation precision, benchmark, and integration contingency.

## Sprint Audit

| Sprint | Planned | Completed | Result | Evidence |
|---|---:|---:|---|---|
| 1 | 20 | 20 | Completed | STORY-001, STORY-020, STORY-021, STORY-022 and passing foundation tests |
| 2 | 20 | 20 | Completed | STORY-002, STORY-004, STORY-007, STORY-023 and Sprint 2 API tests |
| 3 | 19 | 19 | Completed | STORY-009, STORY-011, STORY-012, migration 0004 and Sprint 3 API tests |

Audit corrections:

- Sprint 3 is recorded as completed in machine-readable status.
- The completed Sprint 3 plan is archived as `_bmad-output/implementation-artifacts/sprint-plan-3.md`.
- Sprint dates are planning windows; implementation has run ahead of the nominal calendar.
- Sprint 2 story checklists contain historical documentation drift, but headers, code, tests, Git history, and sprint status consistently show completion.

## Sprint Backlog

### Epic 3: Participants, families and shares (5 points)

#### STORY-008: Family share allocation and breakdown

- **Priority:** Must Have
- **Points:** 5
- **Status:** Not Started
- **Dependencies:** STORY-007, STORY-009
- **Brief:** Add the pure, decimal-safe allocation contract that expands snapshotted member/family weights and preserves explanation records.

### Epic 6: Balances and totals (13 points)

#### STORY-014: View trip balance

- **Priority:** Must Have
- **Points:** 8
- **Status:** Not Started
- **Dependencies:** STORY-008, STORY-009, STORY-011
- **Brief:** Calculate payer credits and target liabilities from persisted converted amounts and expose an authorized, zero-sum trip balance.

#### STORY-015: Explain trip balance

- **Priority:** Should Have
- **Points:** 5
- **Status:** Not Started
- **Dependencies:** STORY-008, STORY-014
- **Brief:** Expose a paginated per-expense explanation for any member or family balance line.

## Prioritization

### Must Have — 13 points

1. STORY-008 — Family share allocation and breakdown (5)
2. STORY-014 — View trip balance (8)

### Should Have — 5 points

1. STORY-015 — Explain trip balance (5)

If capacity is threatened, STORY-015 is the first scope-release candidate; STORY-008 and STORY-014 together still achieve the core balance goal.

## Implementation Order

1. **Days 1–3:** STORY-008
   - Freeze decimal precision, residual, and explanation contracts before adding an API.
2. **Days 4–7:** STORY-014
   - Build the balance query and endpoint on the tested allocation core.
3. **Days 8–9:** STORY-015
   - Reuse calculation explanations for drill-down and pagination.
4. **Day 10:** Hardening
   - Run the 20-participant/300-expense benchmark, authorization regression, and full quality gates.

## Dependency Graph

```text
STORY-007 Create family ─┐
STORY-009 Add expense ──┴─> STORY-008 Family allocation
STORY-011 View history ─────> STORY-014 View balance
STORY-008 ──────────────────> STORY-014 ──> STORY-015 Explain balance
```

**Critical Path:** STORY-008 → STORY-014 → STORY-015.

## Risks and Mitigation

### Repeating decimal allocation

- **Probability:** High
- **Impact:** High
- **Mitigation:** Use rational/BigInt calculation, a documented output scale, deterministic residual assignment, and a zero-sum invariant.
- **Contingency:** Complete STORY-008 before any endpoint work; do not duplicate allocation logic in routes.

### Historical family shares change

- **Probability:** Medium
- **Impact:** High
- **Mitigation:** Calculate from `expense_splits.share_count`, never the family's current mutable value.
- **Contingency:** Add fixtures where one family has different snapshots across expenses.

### N+1 queries or slow recalculation

- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:** Load bounded datasets in a fixed number of queries and benchmark the architecture target of 20 participants/300 expenses.
- **Contingency:** Optimize indexes/query shape; do not introduce a canonical balance cache in this sprint.

### Breakdown diverges from summary

- **Probability:** Medium
- **Impact:** High
- **Mitigation:** Generate both from the same explanation records and assert reconciliation in automated tests.
- **Contingency:** Defer STORY-015 rather than ship a second calculation path.

## Milestones

- **Day 3:** Allocation contract passes precision and family-share fixtures.
- **Day 7:** Authorized zero-sum balance endpoint passes integration tests.
- **Day 9:** Breakdown reconciles to every summary line.
- **Day 10:** Benchmark and full regression gates pass.

## Definition of Done

A story is complete when:

- [ ] All acceptance criteria are verified with evidence.
- [ ] Calculation logic has at least 90% coverage and includes edge/error cases.
- [ ] Authorization and archived/deleted behavior are integration-tested.
- [ ] Query count is bounded and the representative benchmark passes.
- [ ] Decimal strings are used at API boundaries; JavaScript floating point is not used for financial arithmetic.
- [ ] Lint, typecheck, test, coverage validation, and build pass.
- [ ] Story and sprint status are updated.

## Burndown Tracking

| Date | Completed | Remaining | Ideal Remaining | Notes |
|---|---:|---:|---:|---|
| 2026-07-28 | 0 | 18 | 18 | Sprint begins |
| 2026-07-30 | - | - | 14 | Target: STORY-008 complete |
| 2026-08-04 | - | - | 7 | Target: STORY-014 complete |
| 2026-08-07 | - | - | 2 | Target: STORY-015 complete |
| 2026-08-10 | - | - | 0 | Hardening and sprint close |

## Deferred Backlog

1. STORY-016 — Offline expense creation.
2. STORY-017 — Synchronize expenses after connectivity returns.
3. STORY-013 — Manual exchange-rate override.
4. STORY-005 — Edit trip base currency.
5. STORY-006 — Archive and delete trip.
6. STORY-010 — Edit own expense with role rules.

The next likely theme after Sprint 4 is offline expense synchronization (`STORY-016` and `STORY-017`), because the canonical online expense and derived balance contracts will then both be stable.
