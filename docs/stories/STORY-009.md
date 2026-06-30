# Add a base-currency expense

- **ID:** STORY-009
- **Epic:** EPIC-004 - Expenses and history
- **Priority:** Must Have
- **Story Points:** 8
- **Status:** Completed

## User Story

As a **trip participant**  
I want to **record an expense with a payer and split targets**  
So that **the trip has a durable, calculation-ready record of what was paid**

## Acceptance Criteria

- [x] An active owner or guest member can create an expense in an active trip using the trip base currency.
- [x] The request accepts an exact positive decimal amount, expense date, description, active payer, and one or more unique active member/family split targets from the same trip.
- [x] A base-currency expense stores `originalAmount`, `convertedAmount`, and rate as decimal values with rate `1`, without forced rounding at the API boundary.
- [x] Expense, split rows, same-currency snapshot, idempotency record, and audit event are committed atomically with status `accepted`.
- [x] Repeating the same `Idempotency-Key` for the same actor and trip returns the original result without duplicate rows.
- [x] Invalid targets, mixed-trip references, inactive entities, archived/deleted trips, outsiders, and unauthenticated requests are rejected with structured errors and no partial write.

## Technical Notes

### Implementation Approach

Create an `expenses` module with Zod DTO validation, authenticated actor resolution for registered and guest sessions, service-level trip membership checks, and transactional PostgreSQL writes. Keep balance calculation out of this story. Preserve decimal values as strings in TypeScript and use a decimal-safe library only if arithmetic is required.

### Files/Modules Affected

- `apps/api/migrations/0004_sprint3_expenses.sql` - expense, split, snapshot, and idempotency schema.
- `apps/api/src/expenses/expense-service.ts` - validation, authorization, idempotency, and transaction.
- `apps/api/src/expenses/expense-routes.ts` - create endpoint and structured error mapping.
- `apps/api/src/auth` - shared registered/guest actor resolution if the current route-specific logic cannot be reused.
- `apps/api/src/app.ts` - expense service construction and route registration.
- `apps/api/src/sprint3.test.ts` - end-to-end API and database coverage.

### Data Model Changes

Add:

- `expenses`: trip, payer, creator, original amount/currency, converted amount/base currency, expense date, description, status, version, timestamps.
- `expense_splits`: expense plus exactly one member or family target and a positive snapshotted share count.
- `currency_rate_snapshots`: immutable expense-level rate, rate date, source, and manual flag.
- `idempotency_keys`: trip, actor identity, key hash/value, request fingerprint, expense id, and timestamps.

Required constraints and indexes:

- Positive amounts, rates, share counts, and versions.
- Supported status values.
- Exactly one split target type per row.
- Unique split target per expense.
- Unique idempotency key within actor and trip scope.
- Expense list index on `(trip_id, expense_date desc, created_at desc)`.

### API Changes

- `POST /api/v1/trips/:tripId/expenses`
- Authentication: registered bearer session or guest session.
- Header: `Idempotency-Key` required.

Request:

```json
{
  "payerMemberId": "uuid",
  "amount": "1250.75",
  "currencyCode": "RUB",
  "expenseDate": "2026-07-18",
  "description": "Dinner",
  "splitTargets": [
    { "type": "member", "id": "uuid" },
    { "type": "family", "id": "uuid" }
  ]
}
```

Response:

```json
{
  "expense": {
    "id": "uuid",
    "tripId": "uuid",
    "status": "accepted",
    "payerMemberId": "uuid",
    "originalAmount": "1250.75",
    "originalCurrencyCode": "RUB",
    "convertedAmount": "1250.75",
    "baseCurrencyCode": "RUB",
    "rate": "1",
    "rateSource": "same_currency",
    "expenseDate": "2026-07-18",
    "description": "Dinner",
    "splitTargets": []
  }
}
```

### Edge Cases

- **Different currency from trip base:** return `expenses.exchange_rate_required`; STORY-012 removes this restriction.
- **Duplicate split target:** return `expenses.duplicate_split_target`.
- **Payer or target from another trip:** return `expenses.invalid_participant`.
- **Provider or calculation work:** do not invoke external providers or calculate balances in this story.
- **Same key with different payload:** return `expenses.idempotency_conflict`.

### Security Considerations

- Resolve the caller to an active member of the route trip before reading payer or target details.
- Do not reveal whether participant IDs belong to another trip.
- Store and log no session tokens or raw authentication material.
- Include actor, trip, and expense identifiers in the audit event.

## Dependencies

### Story Dependencies

- **Blocked by:** STORY-004, STORY-007, STORY-023.
- **Blocks:** STORY-010, STORY-011, STORY-012, STORY-014, STORY-016.

### Technical Dependencies

- Existing PostgreSQL transaction helper and migration runner.
- Existing registered and guest session stores.
- Existing currency catalog validation.

## Testing Requirements

### Unit Tests

- [x] Decimal amount and date validation.
- [x] Duplicate and malformed split target validation.
- [x] Idempotency fingerprint comparison.
- [x] Base-currency snapshot mapping with rate `1`.

### Integration Tests

- [x] Owner creates a valid expense with member and family targets.
- [x] Guest creates an expense and can select another active payer.
- [x] Duplicate idempotency request returns one expense.
- [x] Same key with changed payload returns conflict.
- [x] Outsider, inactive entity, mixed-trip target, and archived trip are rejected.
- [x] Transaction/provider failure leaves no expense, split, snapshot, idempotency, or audit rows.

### Manual Testing

- [ ] Create a trip and family using Sprint 2 endpoints, then create a base-currency expense.
- [ ] Query PostgreSQL and verify exact decimal strings, split rows, rate `1`, and one audit event.

## Definition of Done

- [x] All acceptance criteria are met.
- [x] Migration up/down and constraints are verified.
- [x] Unit and integration tests pass.
- [x] Access control and idempotency are covered by tests.
- [x] Lint, typecheck, and build pass.
- [x] Story status can be moved to Completed.

## Implementation Notes

- Implemented in migration `0004_sprint3_expenses.sql` and the API `expenses` module.
- Durable idempotency is scoped by trip and actor member; only the key hash is stored.
- Exact decimal strings are persisted as PostgreSQL `numeric`; conversion avoids JavaScript floating-point arithmetic.
