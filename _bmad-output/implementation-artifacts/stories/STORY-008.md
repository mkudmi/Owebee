# Family share allocation and breakdown

- **ID:** STORY-008
- **Epic:** EPIC-003 - Participants, families and shares
- **Priority:** Must Have
- **Story Points:** 5
- **Status:** Not Started

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

## Technical Notes

### Implementation Approach

Create a pure calculation module. Represent money and weights without JavaScript floating-point arithmetic. For each expense, divide `convertedAmount` by the sum of selected split weights, multiply by each target weight, and preserve an explanation record. Calculate at `max(convertedAmount scale, 8)` decimal places and assign any remaining smallest units deterministically by `(target_type, target_id)` so allocated totals equal the persisted expense amount.

### Files/Modules Affected

- `apps/api/src/calculation/decimal-ratio.ts` - rational allocation and residual handling.
- `apps/api/src/calculation/family-allocation.ts` - pure expense allocation.
- `apps/api/src/calculation/*.test.ts` - table-driven domain tests.

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

### Security Considerations

The pure module receives already-authorized trip data and must not perform cross-trip queries.

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
