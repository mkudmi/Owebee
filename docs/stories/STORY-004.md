# Create trip and invite link

- **ID:** STORY-004
- **Epic:** EPIC-002 - Поездки и управление жизненным циклом
- **Priority:** Must Have
- **Story Points:** 5
- **Status:** Not Started

## User Story

As a **registered trip organizer**  
I want to **create a trip with a base currency and invite link**  
So that **I can start shared expense tracking with friends**

## Acceptance Criteria

- [ ] Authenticated registered user can create a trip with name and base currency.
- [ ] Unauthenticated user cannot create a trip.
- [ ] Unsupported base currency is rejected with a structured validation error.
- [ ] System creates an owner trip member linked to the registered user.
- [ ] System creates an active invite token and returns an invite link.
- [ ] Raw invite token is never stored; only a hash is persisted.
- [ ] Duplicate or invalid trip names are handled according to validation rules.

## Technical Notes

### Implementation Approach

Implement a vertical API slice first: service, repository/database queries, route, tests. UI can remain minimal unless implementation naturally adds a simple page.

### Files/Modules Affected

- `apps/api` - trips module, route registration, auth dependency.
- `apps/api/migrations` - adjust `trips`, `trip_members`, `trip_invites` if Sprint 1 baseline is missing fields.
- `apps/web` - optional create-trip form or API client harness.

### Data Model Changes

Use existing Sprint 1 tables:

- `trips`
- `trip_members`
- `trip_invites`
- `audit_events`

May add constraints/indexes if missing:

- Active invite lookup by `token_hash`.
- Owner trip list lookup by `owner_user_id, status`.

### API Changes

- `POST /api/v1/trips`

Request:

```json
{
  "name": "Georgia Trip",
  "baseCurrencyCode": "RUB"
}
```

Response:

```json
{
  "trip": {
    "id": "uuid",
    "name": "Georgia Trip",
    "baseCurrencyCode": "RUB",
    "status": "active"
  },
  "inviteLink": "http://localhost:5173/t/raw-invite-token"
}
```

### Edge Cases

- **Missing/invalid bearer token:** return `401`.
- **Registered user not found:** return `401`.
- **Unsupported currency:** return `400` with currency error code.
- **Invite creation fails after trip insert:** create trip, owner member and invite in one transaction.

### Security Considerations

- Store invite token hash, not raw token.
- Do not log raw invite token.
- Only registered users can create trips.

## Dependencies

### Story Dependencies

- **Blocked by:** STORY-001, STORY-021, STORY-023.
- **Blocks:** STORY-002, STORY-007, STORY-009.

## Testing Requirements

### Unit Tests

- [ ] Trip input validation.
- [ ] Invite token hashing helper.
- [ ] Invite link generation helper.

### Integration Tests

- [ ] Authenticated owner creates trip, owner member and invite.
- [ ] Unauthenticated request is rejected.
- [ ] Unsupported currency is rejected.
- [ ] Raw invite token is not stored.

### Manual Testing

- [ ] Create trip through API using session token from registration.
- [ ] Confirm returned invite link can be used by STORY-002 flow after that story is implemented.

## Definition of Done

- [ ] All acceptance criteria are met.
- [ ] Unit and integration tests pass.
- [ ] Access control is covered by tests.
- [ ] Story status can be moved to Completed.

## Implementation Notes

To be filled during implementation.
