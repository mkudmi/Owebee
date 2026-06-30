# Core persistence baseline and migrations

- **ID:** STORY-021
- **Epic:** Technical Foundation
- **Priority:** Must Have
- **Story Points:** 5
- **Status:** Completed

## User Story

As a **developer**  
I want to **create the first canonical PostgreSQL schema and migration baseline**  
So that **auth, trips, members, invites and sync stories share one reliable data model**

## Acceptance Criteria

- [x] Migration system is configured and documented.
- [x] Initial tables exist for `users`, `auth_sessions`, `trips`, `trip_invites`, `trip_members`, `audit_events`.
- [x] Initial tables include primary keys, timestamps, required foreign keys and key indexes from architecture.
- [x] Token-like values are represented as hashes, not raw token strings.
- [x] Migration can be applied and rolled back locally.
- [x] Basic database integration test verifies schema creation and one insert path for user/trip/member.

## Technical Notes

### Implementation Approach

Implement only the schema needed for Sprint 1 and immediate Sprint 2 work. Do not create the full expense/currency/sync schema unless it is needed for STORY-022; keep the baseline understandable.

### Files/Modules Affected

- `apps/api` - database module/configuration.
- `packages/shared-schemas` or backend domain package - shared IDs/types if established.
- Migration directory - initial migration.
- Test setup - PostgreSQL integration test harness.

### Data Model Changes

Create initial schema:

- `users`
- `auth_sessions`
- `trips`
- `trip_invites`
- `trip_members`
- `audit_events`

Optional if needed for STORY-022:

- `client_devices`
- `sync_mutations`

### API Changes

No public product API required, except any internal database health check introduced by STORY-020.

### Edge Cases

- **Duplicate user email:** unique constraint prevents duplicate registered accounts.
- **Deleted/archived trip states:** status enum or constrained text supports lifecycle.
- **Invite token storage:** raw invite token must not be persisted.

### Performance Considerations

Add indexes needed for lookup by email, owner trips, trip members and invite token hash.

### Security Considerations

Use parameterized queries/ORM migrations. Avoid storing raw session or invite tokens.

## Dependencies

### Story Dependencies

- **Blocked by:** STORY-020.
- **Blocks:** STORY-001, STORY-004, STORY-005, STORY-022.

### Technical Dependencies

- PostgreSQL local service.
- ORM/migration tool decision.

### Open Questions

- [x] Confirm ORM/migration tool: SQL migrations with a small TypeScript runner for Sprint 1.

## Testing Requirements

### Unit Tests

- [x] Schema helper/type tests where applicable.

### Integration Tests

- [x] Migration applies successfully to empty database.
- [x] Migration rollback succeeds or documented rollback path exists.
- [x] User/trip/member insert path succeeds.
- [x] Unique email constraint works.

### Manual Testing

- [x] Developer can reset local DB and re-run migrations.

## Definition of Done

- [x] All acceptance criteria are met and verified.
- [x] Migration files are committed.
- [x] Database setup is documented.
- [x] Integration tests pass locally.

## Notes

This story deliberately avoids the full final schema. Expenses, currency snapshots and full sync tables can be added in later stories when their product slices start.

## Implementation Notes

- Migration baseline is `apps/api/migrations/0001_core_baseline.sql`.
- Migration runner is `apps/api/src/database/migrations.ts`.
- CLI command is `pnpm --filter @owebee/api db:migrate`.
- Tests use PGlite for fast isolated integration coverage.
- Docker/Colima migration smoke passed against live PostgreSQL: `0001_core_baseline` and `0002_sync_mutations` applied, then a repeated run returned `No pending migrations`.
