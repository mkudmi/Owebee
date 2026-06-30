# Currency catalog foundation and provider contract

- **ID:** STORY-023
- **Epic:** EPIC-005 - Валюты и курсы
- **Priority:** Must Have
- **Story Points:** 5
- **Status:** Not Started

## User Story

As a **trip organizer**  
I want to **choose a supported base currency from a reliable catalog**  
So that **trip creation and future expense conversion use validated currency codes**

## Acceptance Criteria

- [ ] System stores a supported currency catalog that includes RUB, USD, EUR, GBP, CHF and popular Europe/CIS currencies.
- [ ] API exposes a read endpoint for active currencies with code, display name and minor-unit metadata.
- [ ] Server-side validation rejects unsupported currency codes for trip-facing use cases.
- [ ] Currency provider adapter interface exists for future historical rate lookup.
- [ ] Provider adapter has a fake/test implementation used by automated tests.
- [ ] No automatic expense conversion or rate snapshot persistence is implemented in this story.

## Technical Notes

### Implementation Approach

Add the smallest currency module that future trip and expense stories can share. Prefer deterministic local catalog data over calling an external provider during this story.

### Files/Modules Affected

- `apps/api` - currency module, routes and validation helpers.
- `apps/api/migrations` - currency catalog table or seed migration.
- `packages` - shared currency code/schema helper if useful.
- `apps/web` - optional API client hook only if needed by STORY-004 UI work later.

### Data Model Changes

Create or finalize:

- `currencies`

Recommended fields:

- `code` char(3), primary key.
- `display_name` text.
- `symbol` text nullable.
- `minor_units` integer.
- `is_active` boolean.
- `sort_order` integer.

### API Changes

- `GET /api/v1/currencies`

Example response:

```json
{
  "currencies": [
    {
      "code": "RUB",
      "displayName": "Russian Ruble",
      "symbol": "₽",
      "minorUnits": 2
    }
  ]
}
```

### Edge Cases

- **Unsupported code:** validation fails with structured error code.
- **Lowercase input:** normalize to uppercase before validation.
- **Inactive currency:** not returned by default and not accepted for new trips.
- **Provider unavailable:** not applicable yet; adapter contract should still model timeout/failure for future STORY-012.

### Security Considerations

Currency catalog is public read-only data. Mutation endpoints are not in scope.

## Dependencies

### Story Dependencies

- **Blocked by:** STORY-020, STORY-021.
- **Blocks:** STORY-004, STORY-005, STORY-012.

### Technical Dependencies

- PostgreSQL migrations.
- API validation library.

## Testing Requirements

### Unit Tests

- [ ] Currency code normalization.
- [ ] Supported/unsupported currency validation.
- [ ] Provider adapter fake returns deterministic rates or explicit not-implemented shape.

### Integration Tests

- [ ] Migration seeds supported currencies.
- [ ] `GET /api/v1/currencies` returns active currencies sorted predictably.
- [ ] Trip-facing currency validation helper rejects unsupported code.

## Definition of Done

- [ ] All acceptance criteria are met.
- [ ] Tests pass.
- [ ] Currency catalog contents are documented in implementation notes.
- [ ] No external network dependency is required for local tests.

## Implementation Notes

To be filled during implementation.
