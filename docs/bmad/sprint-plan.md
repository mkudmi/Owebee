# Sprint Plan: Owebee

- **Sprint Number:** 3
- **Sprint Dates:** 2026-07-14 - 2026-07-27
- **Sprint Duration:** 2 weeks / 10 working days
- **Created:** 2026-06-30
- **Status:** Planned

## Sprint Overview

**Sprint Goal:** Deliver the first complete online expense flow: a trip participant can create an expense with validated split targets, the system persists an immutable exchange-rate snapshot for cross-currency expenses, and every trip member can view the shared expense history.

**Sprint Capacity:** 20 story points
**Stories Planned:** 3 stories
**Total Story Points:** 19 points

**Capacity Calculation:**
- **Baseline velocity:** 20 points in Sprint 1 and 20 points in Sprint 2.
- **Team:** 1 full-stack developer.
- **Adjustment:** Commit 19 points and keep 1 point as contingency for the first financial-data slice.

## Velocity Metrics

**Historical Velocity:**
- Sprint 1: planned 20, completed 20, completion rate 100%.
- Sprint 2: planned 20, completed 20, completion rate 100%.
- Two-sprint average: 20 points.

**Recommended Capacity:** 20 points.

**Planning Note:** STORY-009 first delivers independently testable base-currency expense creation. STORY-012 extends the same flow to cross-currency expenses and immutable rate snapshots. This sequencing prevents offline synchronization and base-currency recalculation from being built on an undefined expense contract.

## Sprint Backlog

### Epic 4: Expenses and history (11 points)

**Epic Goal:** Participants can record an accepted expense and all trip members can inspect the shared financial history.

#### STORY-009: Add a base-currency expense
- **Priority:** Must Have
- **Points:** 8
- **Status:** Not Started
- **Dependencies:** STORY-004, STORY-007, STORY-023
- **Brief:** Add the expense persistence model and authenticated creation endpoint with payer, exact amount, date, description, and member/family split targets.

#### STORY-011: View all trip expenses
- **Priority:** Should Have
- **Points:** 3
- **Status:** Not Started
- **Dependencies:** STORY-009
- **Brief:** Add a paginated expense history endpoint available to every active trip member and forbidden to outsiders.

---

### Epic 5: Currencies and rates (8 points)

**Epic Goal:** Cross-currency expenses retain a stable converted amount that does not change with later market rates.

#### STORY-012: Automatic exchange rate and immutable snapshot
- **Priority:** Must Have
- **Points:** 8
- **Status:** Not Started
- **Dependencies:** STORY-009, STORY-023
- **Brief:** Resolve the historical rate for the expense date, calculate the base-currency amount, and persist provider/source/rate metadata atomically with the expense.

## Story Prioritization

### Must Have

1. STORY-009 - Add a base-currency expense (8 points)
2. STORY-012 - Automatic exchange rate and immutable snapshot (8 points)

**Total Must Have:** 16 points

### Should Have

1. STORY-011 - View all trip expenses (3 points)

**Total Should Have:** 3 points

### Deferred From Candidate Backlog

- STORY-005 - Edit trip base currency: deferred until canonical expense and rate snapshot behavior exists.
- STORY-006 - Archive and delete trip: valuable but outside the Sprint 3 expense goal.
- STORY-016 - Offline expense creation: deferred until the online mutation and idempotency contract is proven.
- STORY-013 - Manual exchange-rate override: provider failure returns an explicit manual-rate-required response in Sprint 3; editing and audit history remain a later story.

## Implementation Order

1. **Days 1-4:** STORY-009 - Add a base-currency expense
   - Rationale: establishes the canonical expense, split, authorization, transaction, and idempotency contract.

2. **Days 5-8:** STORY-012 - Automatic exchange rate and immutable snapshot
   - Rationale: extends the proven creation path to cross-currency data while keeping snapshot persistence atomic.

3. **Day 9:** STORY-011 - View all trip expenses
   - Rationale: exposes the stored expense and snapshot data to every trip member after the write model is stable.

4. **Day 10:** Integration hardening and contingency
   - Rationale: reserve time for migration verification, decimal edge cases, provider failure behavior, and complete end-to-end regression.

## Story Dependencies

```text
STORY-004 Create trip and invite link
  ├─> STORY-007 Create family with share count
  └─> STORY-009 Add a base-currency expense
        ├─> STORY-012 Automatic exchange rate and immutable snapshot
        └─> STORY-011 View all trip expenses

STORY-023 Currency catalog and provider contract
  ├─> STORY-009 Add a base-currency expense
  └─> STORY-012 Automatic exchange rate and immutable snapshot
```

**Critical Path:** STORY-009 -> STORY-012.

## Risks and Mitigation

### Risk 1: Decimal money values lose precision
- **Probability:** Medium
- **Impact:** High
- **Mitigation:** Persist amounts and rates as PostgreSQL `numeric`, exchange decimal strings at the API boundary, and avoid JavaScript floating-point arithmetic.
- **Contingency:** Block completion until high-precision and boundary-value integration tests pass.

### Risk 2: Currency provider failure leaves partial expenses
- **Probability:** Medium
- **Impact:** High
- **Mitigation:** Resolve the rate before the write transaction and persist expense, splits, snapshot, and audit event atomically.
- **Contingency:** Return a structured `manual_rate_required` error and create no expense.

### Risk 3: Split targets reference another trip or inactive entities
- **Probability:** Medium
- **Impact:** High
- **Mitigation:** Validate payer and every member/family target against the active trip inside the service layer and cover authorization with integration tests.
- **Contingency:** Reject the whole request without partial rows.

### Risk 4: STORY-009 expands into balance calculation
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:** Persist validated split weights only. Balance calculation, family allocation, and settlement remain in EPIC-006.
- **Contingency:** Move calculation work back to the backlog if discovered during implementation.

## Sprint Milestones

- **Day 4:** Base-currency expense creation and split persistence pass integration tests.
- **Day 8:** Cross-currency expense stores an immutable rate snapshot and provider failures are atomic.
- **Day 9:** Every active trip member can list shared expenses; outsiders are rejected.
- **Day 10:** Full migration, API, authorization, decimal, and regression suites pass.

## Definition of Done

A story is complete when:
- [ ] All acceptance criteria are met.
- [ ] Unit tests cover decimal, validation, and conversion domain logic.
- [ ] Integration tests cover API, PostgreSQL transaction, and authorization paths.
- [ ] Migration up/down behavior is verified.
- [ ] Structured error codes are stable and documented in the story.
- [ ] Lint, typecheck, test, and build pass locally.
- [ ] Story status can be moved to Completed.

## Burndown Tracking

| Date | Completed | Remaining | Ideal Remaining | Notes |
|------|-----------|-----------|-----------------|-------|
| 2026-07-14 | 0 | 19 | 19 | Sprint begins |
| 2026-07-17 | - | - | 13 | Target: STORY-009 complete |
| 2026-07-22 | - | - | 6 | Target: STORY-012 complete |
| 2026-07-24 | - | - | 2 | Target: STORY-011 complete |
| 2026-07-27 | - | - | 0 | Sprint end and hardening complete |

## Next Sprint Candidate Backlog

1. STORY-016 - Offline expense creation using the Sprint 3 mutation contract.
2. STORY-005 - Edit trip base currency and recalculate display values from canonical snapshots.
3. STORY-013 - Manual exchange-rate override with audit history.
4. STORY-006 - Archive and delete trip.
5. STORY-010 - Expense editing permissions.

## Notes

- Sprint 3 deliberately commits 19 of 20 points; the remaining point is contingency, not hidden scope.
- STORY-009 is a thin vertical slice for base-currency expenses. Cross-currency support is accepted only through STORY-012.
- Expense creation should accept an idempotency key now so STORY-016 can reuse the online mutation contract.
- Balance calculation and family aggregation are not part of this sprint.
