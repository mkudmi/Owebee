# Automatic exchange rate and immutable snapshot

- **ID:** STORY-012
- **Epic:** EPIC-005 - Currencies and rates
- **Priority:** Must Have
- **Story Points:** 8
- **Status:** Completed

## User Story

As a **trip participant**  
I want to **record an expense in a currency different from the trip base currency**  
So that **the system preserves a stable converted amount for balances and history**

## Acceptance Criteria

- [x] When expense currency differs from trip base currency, creation resolves a historical rate for the expense date through `CurrencyRateProvider`.
- [x] The conversion convention is explicit and tested: `convertedAmount = originalAmount * rate`, where rate is units of trip base currency per one unit of expense currency.
- [x] Expense creation stores original amount/currency, base currency, exact rate, converted amount, rate date, provider source, and `manual=false` in an immutable snapshot.
- [x] A later provider-rate change does not mutate an existing expense snapshot or converted amount.
- [x] Same-currency creation continues to use rate `1` and source `same_currency` without calling the provider.
- [x] Unsupported currency, invalid provider response, or unavailable rate returns a structured error and creates no expense, split, snapshot, idempotency, or audit rows.

## Technical Notes

### Implementation Approach

Extend `CurrencyService` with a historical-rate use case around the existing provider contract. Normalize the provider result to the documented direction before converting with decimal-safe arithmetic. Resolve the rate before entering the expense write transaction, then persist the validated snapshot atomically with the expense.

Use `FakeCurrencyRateProvider` for deterministic tests. A production provider adapter and cache may be added if configuration is available, but network availability must not be required by the test suite.

### Files/Modules Affected

- `apps/api/src/currency/currency-service.ts` - historical rate resolution, direction normalization, and provider validation.
- `apps/api/src/currency/*provider*.ts` - production adapter only if configuration is ready.
- `apps/api/src/expenses/expense-service.ts` - cross-currency branch and decimal conversion.
- `apps/api/src/app.ts` - inject `CurrencyRateProvider` into currency/expense services.
- `apps/api/migrations/0004_sprint3_expenses.sql` - snapshot schema from STORY-009; optional rate cache table if implemented.
- `apps/api/src/currency/currency-service.test.ts` - provider, direction, and failure tests.
- `apps/api/src/sprint3.test.ts` - persisted snapshot and atomic failure coverage.

### Data Model Changes

Use the `currency_rate_snapshots` table introduced by STORY-009:

- `expense_id`
- `original_currency_code`
- `base_currency_code`
- `rate`
- `rate_date`
- `source`
- `is_manual`
- `created_at`

The row is immutable in Sprint 3. Manual override and snapshot history belong to STORY-013.

If a provider cache is added, key it by normalized `(original_currency_code, base_currency_code, rate_date, source)` and store provider metadata without changing persisted expense snapshots.

### API Changes

Extend:

- `POST /api/v1/trips/:tripId/expenses`

Cross-currency request:

```json
{
  "payerMemberId": "uuid",
  "amount": "100.00",
  "currencyCode": "EUR",
  "expenseDate": "2026-07-18",
  "description": "Museum",
  "splitTargets": [
    { "type": "member", "id": "uuid" }
  ]
}
```

Relevant response fields:

```json
{
  "originalAmount": "100.00",
  "originalCurrencyCode": "EUR",
  "convertedAmount": "9000.00",
  "baseCurrencyCode": "RUB",
  "rate": "90.00",
  "rateDate": "2026-07-18",
  "rateSource": "provider_name",
  "isManualRate": false
}
```

Provider failure:

```json
{
  "error": {
    "code": "expenses.manual_rate_required",
    "message": "Automatic exchange rate is unavailable"
  }
}
```

### Edge Cases

- **Provider returns inverse pair:** normalize to base-currency-per-expense-currency before conversion.
- **Weekend or holiday date:** provider adapter may return its documented nearest supported historical date, which must be persisted as `rateDate`.
- **Zero, negative, NaN, or excessive precision rate:** reject as invalid provider data.
- **Trip base currency changes during request:** read the trip and persist against one transactional version; do not mix base currencies.
- **Retry after provider failure:** no idempotency success record exists, so the same request can be retried.

### Security Considerations

- Treat provider data as untrusted input and validate codes, dates, source, and rate.
- Do not expose provider credentials in errors or logs.
- Do not allow clients to submit an automatic rate in this story.

## Dependencies

### Story Dependencies

- **Blocked by:** STORY-009, STORY-023.
- **Blocks:** STORY-005, STORY-013, STORY-014, STORY-016.

### Technical Dependencies

- `CurrencyRateProvider` and deterministic `FakeCurrencyRateProvider`.
- Decimal-safe arithmetic package already present or a deliberately selected lightweight dependency.
- Expense transaction and snapshot schema from STORY-009.

## Testing Requirements

### Unit Tests

- [x] Correct rate direction and `amount * rate` conversion.
- [x] Exact decimal behavior for high precision and trailing zeros.
- [x] Same-currency flow skips the provider.
- [x] Invalid, unavailable, and mismatched provider results are rejected.
- [x] Existing snapshot remains unchanged after provider data changes.

### Integration Tests

- [x] Cross-currency expense persists one immutable snapshot and converted amount.
- [x] Provider failure leaves all expense-related tables unchanged.
- [x] Unsupported currency is rejected before provider lookup.
- [x] Repeated idempotent request reuses the original snapshot.

### Manual Testing

- [ ] Create EUR expense in a RUB trip using a configured deterministic rate.
- [ ] Change the fake/provider rate and verify the stored expense remains unchanged.

## Definition of Done

- [x] All acceptance criteria are met.
- [x] Conversion convention is documented and tested.
- [x] Decimal-safe calculations and provider failures are covered.
- [x] Integration tests prove atomic persistence and snapshot immutability.
- [x] Lint, typecheck, test, and build pass.
- [x] Story status can be moved to Completed.

## Implementation Notes

- Provider results are validated as untrusted data and normalized to expense-currency → base-currency direction.
- Snapshot values are written atomically with the expense and are reused unchanged by idempotent replay.
- Production rates come from the Bank of Russia `DailyInfo` SOAP service (`GetCursOnDateXML`). `VunitRate` is used for RUB rates; non-RUB cross-rates are derived through RUB with deterministic decimal arithmetic.
