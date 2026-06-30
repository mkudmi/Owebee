# Explain trip balance

- **ID:** STORY-015
- **Epic:** EPIC-006 - Balances and totals
- **Priority:** Should Have
- **Story Points:** 5
- **Status:** Not Started

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

## Technical Notes

### Implementation Approach

Reuse the STORY-008 explanation records and STORY-014 authorization/query model. Add a target-filtered breakdown endpoint; do not independently recalculate conversion or allocation with a second algorithm.

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

