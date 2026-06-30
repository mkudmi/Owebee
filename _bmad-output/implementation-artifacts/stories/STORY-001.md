# Registered owner account creation

- **ID:** STORY-001
- **Epic:** EPIC-001 - Доступ, аккаунты и гостевые сессии
- **Priority:** Must Have
- **Story Points:** 5
- **Status:** Completed

## User Story

As a **trip organizer**  
I want to **register as an owner using email**  
So that **I can create and manage trips as a registered user**

## Acceptance Criteria

- [x] User can register with valid email, display name and selected locale (`ru` or `en`).
- [x] System validates email format, required fields and duplicate email.
- [x] System creates a registered user and authenticated session.
- [x] Session token is stored securely server-side as a hash.
- [x] Registration errors are returned as structured error codes with localized message support.
- [x] Unauthenticated user cannot access an owner-only test endpoint or protected route.

## Technical Notes

### Implementation Approach

Implement minimum registered owner flow needed before trip creation. Passwordless or password-based auth can be chosen during implementation, but session storage must use secure opaque tokens or equivalent revocable mechanism. Email magic links for guest recovery are not part of this story.

### Files/Modules Affected

- `apps/api` - auth module, register endpoint, session middleware.
- `apps/web` - minimal registration page or API client harness if frontend is in scope.
- Database tables from STORY-021: `users`, `auth_sessions`, `audit_events`.
- Shared validation schemas.

### Data Model Changes

Use existing Sprint 1 tables. Add fields only if required for selected auth method.

### API Changes

- `POST /api/v1/auth/register`
- Optional: `GET /api/v1/me`

Example request:

```json
{
  "email": "owner@example.com",
  "displayName": "Mikhail",
  "locale": "ru"
}
```

### Edge Cases

- **Duplicate email:** returns conflict error without creating a second user.
- **Invalid locale:** falls back to default or returns validation error according to schema.
- **Session creation failure:** user creation and session creation should be transactional or safely recoverable.

### Performance Considerations

Registration is low volume; prioritize correctness and security over optimization.

### Security Considerations

- Store token hash, not raw token.
- Normalize email before uniqueness checks.
- Apply rate limiting to unauthenticated auth endpoints if rate limit middleware exists.
- Do not log raw session tokens.

## Dependencies

### Story Dependencies

- **Blocked by:** STORY-020, STORY-021.
- **Blocks:** STORY-004, STORY-006 and other owner-only trip management stories.

### Technical Dependencies

- Auth/session strategy decision.
- Validation library.
- Database migrations from STORY-021.

### Open Questions

- [x] Use passwordless owner login from the start, or temporary password/email registration? Decision: opaque session token returned after registration; email verification/magic login remains later scope.

## Testing Requirements

### Unit Tests

- [x] Email normalization and validation.
- [x] Locale validation.
- [x] Session token hashing helper.

### Integration Tests

- [x] Successful registration creates user and session.
- [x] Duplicate email is rejected.
- [x] Protected endpoint rejects unauthenticated request.
- [x] Protected endpoint accepts valid session.

### Manual Testing

- [x] Register owner through API.
- [x] Confirm valid session can retrieve `/api/v1/me`.

## Definition of Done

- [x] All acceptance criteria are met and verified.
- [x] Unit and integration tests pass.
- [x] Auth behavior is documented in API docs or README.
- [x] No raw tokens are logged or stored.

## Notes

This refines PRD STORY-001 for Sprint 1 and intentionally stops before trip creation.

## Implementation Notes

- Implemented `POST /api/v1/auth/register`.
- Implemented protected `GET /api/v1/me`.
- Session tokens are opaque random tokens; only SHA-256 hashes are stored in `auth_sessions`.
- Owner login beyond immediate registration and email verification/magic-link behavior remain future stories.
