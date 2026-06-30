# Guest join by invite link

- **ID:** STORY-002
- **Epic:** EPIC-001 - Доступ, аккаунты и гостевые сессии
- **Priority:** Must Have
- **Story Points:** 5
- **Status:** Completed

## User Story

As an **invited participant**  
I want to **join a trip by invite link with my name and email**  
So that **I can participate without registering a full account**

## Acceptance Criteria

- [ ] User can submit display name, email and locale through a valid invite token.
- [ ] System creates an active participant trip member for the invited guest.
- [ ] System creates a durable guest session separate from the invite token.
- [ ] Response returns member/trip context and a raw guest session token exactly once.
- [ ] Raw guest session token is stored only as a hash.
- [ ] Reusing the same email in the same trip returns a structured recovery-required response instead of creating a duplicate member.
- [ ] Invalid or revoked invite token is rejected.

## Technical Notes

### Implementation Approach

Keep this story focused on joining. Email magic-link recovery remains STORY-003.

### Files/Modules Affected

- `apps/api` - invite/participants module and public join route.
- `apps/api/migrations` - `guest_sessions` table if not present.
- `apps/web` - optional join form route only if implementation reaches UI in scope.

### Data Model Changes

Create or finalize:

- `guest_sessions`

Recommended fields:

- `id` UUID primary key.
- `trip_member_id` UUID foreign key.
- `token_hash` text unique.
- `created_at` timestamp.
- `last_seen_at` timestamp nullable.
- `revoked_at` timestamp nullable.

Use existing:

- `trip_invites`
- `trip_members`

### API Changes

- `POST /api/v1/invites/{inviteToken}/join`

Request:

```json
{
  "displayName": "Alex",
  "email": "alex@example.com",
  "locale": "ru"
}
```

Response:

```json
{
  "tripId": "uuid",
  "memberId": "uuid",
  "role": "participant",
  "guestSessionToken": "raw-session-token"
}
```

### Edge Cases

- **Invalid invite token:** return `404` or structured invalid invite error without revealing hashes.
- **Revoked invite:** reject join.
- **Duplicate email in trip:** do not create duplicate member; return recovery-required error shape.
- **Email already exists in another trip:** allow join because uniqueness is scoped to trip.
- **Session creation failure:** member and session creation must be transactional.

### Security Considerations

- Invite token and guest session token are separate credentials.
- Store only hashes for both token types.
- Do not reveal whether an arbitrary email exists globally.

## Dependencies

### Story Dependencies

- **Blocked by:** STORY-004.
- **Blocks:** STORY-003, STORY-009, STORY-016.

## Testing Requirements

### Unit Tests

- [ ] Join payload validation.
- [ ] Guest session token hashing helper.
- [ ] Duplicate participant decision logic.

### Integration Tests

- [ ] Valid invite creates guest member and session.
- [ ] Invalid invite is rejected.
- [ ] Duplicate email in same trip returns recovery-required response.
- [ ] Raw guest session token is not stored.

### Manual Testing

- [ ] Create trip as owner, copy invite token, join as guest through API.

## Definition of Done

- [ ] All acceptance criteria are met.
- [ ] Unit and integration tests pass.
- [ ] Guest session storage is documented.
- [ ] Story status can be moved to Completed.

## Implementation Notes

Implemented in Sprint 2.

- Added `POST /api/v1/invites/{inviteToken}/join`.
- Validates display name, email and locale for public invite join.
- Creates active guest `trip_members` row and durable `guest_sessions` row transactionally.
- Stores only guest session hash; raw guest session token is returned once in the join response.
- Rejects invalid/revoked invites and returns `invites.recovery_required` for duplicate guest email within the same trip.

Test evidence:

- `apps/api/src/sprint2.test.ts`
