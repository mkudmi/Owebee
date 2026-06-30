# View all trip expenses

- **ID:** STORY-011
- **Epic:** EPIC-004 - Expenses and history
- **Priority:** Should Have
- **Story Points:** 3
- **Status:** Not Started

## User Story

As a **trip member**  
I want to **view the complete shared expense history**  
So that **everyone in the trip sees the same financial records**

## Acceptance Criteria

- [ ] Any active owner or guest member can list all accepted expenses for their trip.
- [ ] Each item includes payer, creator, original and converted amounts, currencies, expense date, description, rate snapshot summary, and split target summary.
- [ ] Results are ordered by expense date descending and then creation time/id descending with deterministic cursor pagination.
- [ ] An archived trip remains readable to its members; a deleted trip, outsider, inactive member, or unauthenticated caller cannot access the list.
- [ ] The response uses decimal strings and does not recalculate or replace stored converted amounts.

## Technical Notes

### Implementation Approach

Add a read query to the expenses module and reuse the unified registered/guest actor resolver from STORY-009. Fetch one page of expenses plus payer/creator, snapshot, and split summaries without N+1 queries. Cursor fields must match the stable sort.

### Files/Modules Affected

- `apps/api/src/expenses/expense-service.ts` - authorized list query and cursor handling.
- `apps/api/src/expenses/expense-routes.ts` - list endpoint and query validation.
- `apps/api/src/sprint3.test.ts` - visibility, ordering, pagination, and authorization coverage.

### Data Model Changes

No new tables. Reuse indexes created by STORY-009. Add an index only if the integration query plan shows the `(trip_id, expense_date desc, created_at desc, id desc)` access path is missing.

### API Changes

- `GET /api/v1/trips/:tripId/expenses?limit=20&cursor=opaque`
- Authentication: registered bearer session or guest session.

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "payer": { "id": "uuid", "displayName": "Alex" },
      "creator": { "id": "uuid", "displayName": "Maria" },
      "originalAmount": "100.00",
      "originalCurrencyCode": "EUR",
      "convertedAmount": "9000.00",
      "baseCurrencyCode": "RUB",
      "expenseDate": "2026-07-18",
      "description": "Museum",
      "rateSnapshot": {
        "rate": "90.00",
        "rateDate": "2026-07-18",
        "source": "provider_name",
        "isManual": false
      },
      "splitTargets": []
    }
  ],
  "nextCursor": null
}
```

### Edge Cases

- **Equal expense dates/timestamps:** include `id` as a final stable ordering key.
- **Invalid or stale cursor:** return `expenses.invalid_cursor`.
- **Archived member:** deny access even if the trip is readable to active members.
- **No expenses:** return an empty `items` array and `nextCursor: null`.

### Security Considerations

- Authorize trip membership before returning any expense metadata.
- Use the same not-found/forbidden policy for foreign trip IDs to avoid enumeration.
- Do not include emails or session data in payer/creator summaries.

## Dependencies

### Story Dependencies

- **Blocked by:** STORY-009.
- **Blocks:** STORY-014, STORY-016.

### Technical Dependencies

- Expense and snapshot schema from STORY-009.
- Shared registered/guest actor resolver.

## Testing Requirements

### Unit Tests

- [ ] Cursor encode/decode and validation.
- [ ] Stable ordering for equal dates and timestamps.
- [ ] Limit boundaries and default.

### Integration Tests

- [ ] Owner and guest see the same trip expense history.
- [ ] Results contain persisted snapshot and split summaries.
- [ ] Pagination has no duplicates or omissions.
- [ ] Outsider, inactive member, and unauthenticated caller are rejected.
- [ ] Archived trip is readable and deleted trip is not.

### Manual Testing

- [ ] Create several expenses with mixed dates and currencies, then page through the list as owner and guest.

## Definition of Done

- [ ] All acceptance criteria are met.
- [ ] Query is deterministic and avoids N+1 database access.
- [ ] Authorization and archived-trip behavior are covered.
- [ ] Unit and integration tests pass.
- [ ] Lint, typecheck, and build pass.
- [ ] Story status can be moved to Completed.
