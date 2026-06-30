# View trip balance

- **ID:** STORY-014
- **Epic:** EPIC-006 - Balances and totals
- **Priority:** Must Have
- **Story Points:** 8
- **Status:** Not Started

## User Story

As a **trip participant**  
I want to **see the net balance of every participant and family**  
So that **the group understands who paid more or owes more**

## Acceptance Criteria

- [ ] Any active owner or guest member can request the balance for an active or archived trip; outsiders, inactive members, deleted trips, and unauthenticated callers are rejected.
- [ ] Each accepted expense credits its payer by the persisted converted amount and debits selected targets using STORY-008 allocation.
- [ ] The response contains one deterministic line per active member or family involved in the calculation, with ID, type, display name, balance, and family share count where applicable.
- [ ] Positive balance means the target paid more than its allocated share; negative balance means it owes more than it paid.
- [ ] All balances use decimal strings in the trip base currency, and the sum of returned lines is exactly zero under the documented precision policy.
- [ ] The calculation uses one bounded query set without N+1 access and meets the architecture target for 20 participants and 300 expenses.

## Technical Notes

### Implementation Approach

Add an authorized calculation service and `GET /api/v1/trips/:tripId/balance`. Load trip members, families, accepted expenses, and splits in bounded queries, run the pure allocation module, credit payer members, aggregate family targets as one display line, and sort by target type, normalized display name, and ID.

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
- Deleted expenses and inactive entities are excluded according to their persisted status.
- Equal names are ordered by stable IDs.

### Performance Considerations

Add a benchmark fixture with 20 participants and 300 expenses; calculation target is under 500 ms in the test environment.

### Security Considerations

Authorize membership before loading financial rows and do not expose email or session data.

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

