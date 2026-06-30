# Offline sync spike and mutation contract

- **ID:** STORY-022
- **Epic:** EPIC-007 - PWA, offline и синхронизация
- **Priority:** Must Have
- **Story Points:** 5
- **Status:** Completed

## User Story

As a **developer**  
I want to **validate the offline outbox and server mutation contract with a minimal mutation**  
So that **future offline expense creation can be implemented without redesigning sync**

## Acceptance Criteria

- [x] Client has an IndexedDB-backed outbox abstraction or prototype.
- [x] Client can enqueue a minimal test mutation while offline or in simulated offline mode.
- [x] API exposes `POST /api/v1/sync/push` for a no-op/test mutation.
- [x] Server stores mutation result by `client_device_id` and `client_mutation_id` to prove idempotency.
- [x] Replaying the same mutation returns duplicate/applied result without duplicating server state.
- [x] Version conflict response shape is documented even if no real entity conflict is implemented.
- [x] Spike findings are documented in an ADR or implementation note.

## Technical Notes

### Implementation Approach

This is a risk-reduction spike, not full offline expense delivery. Use a minimal mutation type such as `sync.test` or `note.create` in a test namespace. The important output is contract clarity: mutation identity, auth context, result statuses, retry behavior and conflict response.

### Files/Modules Affected

- `apps/web` - IndexedDB outbox prototype.
- `apps/api` - sync module and endpoint.
- Database migration if `sync_mutations` is not already present.
- Architecture/ADR docs for sync contract.

### Data Model Changes

Create or finalize minimal:

- `client_devices`
- `sync_mutations`

Required uniqueness:

- Unique constraint on `client_device_id, client_mutation_id`.

### API Changes

- `POST /api/v1/sync/push`

Minimum request:

```json
{
  "tripId": "uuid-or-null-for-spike",
  "clientDeviceId": "uuid",
  "mutations": [
    {
      "clientMutationId": "uuid",
      "type": "sync.test",
      "createdAt": "2026-07-01T10:00:00Z",
      "payload": {
        "message": "hello"
      }
    }
  ]
}
```

Minimum response:

```json
{
  "results": [
    {
      "clientMutationId": "uuid",
      "status": "applied"
    }
  ]
}
```

### Edge Cases

- **Duplicate mutation:** returns deterministic duplicate/applied result.
- **Invalid mutation schema:** returns rejected status with error code.
- **Network failure after server apply:** client retry does not duplicate result.
- **Unauthorized actor:** mutation is rejected by server even if queued offline.

### Performance Considerations

Batch push should support multiple mutations, but Sprint 1 can test with small batches.

### Security Considerations

Server must not trust client actor, trip or permission claims blindly. All real mutations later must re-run authorization at apply time.

## Dependencies

### Story Dependencies

- **Blocked by:** STORY-020, STORY-021.
- **Blocks:** STORY-016, STORY-017 and future offline expense work.

### Technical Dependencies

- IndexedDB helper selection, Dexie.js recommended.
- Sync mutation table.
- Basic auth/session context if mutation is authenticated; unauthenticated spike can be allowed only in development/test mode.

### Open Questions

- [x] Should Sprint 1 spike require authenticated sessions, or can it run against a dev-only endpoint? Decision: authenticated bearer session required.

## Testing Requirements

### Unit Tests

- [x] Client outbox enqueue/dequeue behavior.
- [x] Mutation payload validation.
- [x] Idempotency key handling.

### Integration Tests

- [x] First sync push stores mutation as applied.
- [x] Replayed sync push does not duplicate mutation.
- [x] Invalid mutation returns rejected status.

### Manual Testing

- [x] Simulate offline, enqueue mutation, restore network, push mutation.
- [x] Refresh page and verify pending mutation persists until sync.

## Definition of Done

- [x] All acceptance criteria are met.
- [x] Spike output is documented.
- [x] Tests prove idempotency behavior.
- [x] Follow-up stories for real offline expense sync are updated if contract changes.

## Notes

This story intentionally avoids CRDT and full event sourcing. It validates the architecture decision from `docs/bmad/architecture.md`: client outbox, idempotent server mutations and explicit conflict states.

## Implementation Notes

- Added `apps/web/src/offline/outbox.ts` with IndexedDB-backed pending mutation storage.
- Added `POST /api/v1/sync/push` for authenticated `sync.test` mutations.
- Added `sync_mutations` and `client_devices` schema in `0002_sync_mutations.sql`.
- Duplicate replay returns `duplicate` without inserting another mutation row.
- Real expense offline sync remains future scope for STORY-016/STORY-017.
