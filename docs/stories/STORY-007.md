# Create family with share count

- **ID:** STORY-007
- **Epic:** EPIC-003 - Участники, семьи и доли
- **Priority:** Must Have
- **Story Points:** 5
- **Status:** Completed

## User Story

As a **trip owner**  
I want to **create a family with a personal share count**  
So that **shared expenses can later divide fairly while showing the family as one line**

## Acceptance Criteria

- [ ] Owner can create a family inside a trip with display name and `shareCount`.
- [ ] `shareCount` must be greater than zero and stored without forced rounding.
- [ ] Non-owner participant cannot create or edit families.
- [ ] Family appears in the trip participants/families listing as an aggregate target.
- [ ] Archived or deleted trips reject new family creation.
- [ ] Duplicate active family names in one trip are handled with clear validation.

## Technical Notes

### Implementation Approach

Implement the aggregate family model, not individual family member management. This story prepares split calculations but does not implement expense balance math.

### Files/Modules Affected

- `apps/api` - families or participants module.
- `apps/api/migrations` - `families` table if not already present.
- `apps/web` - optional owner UI only if Sprint 2 implementation reaches frontend.

### Data Model Changes

Create or finalize:

- `families`

Recommended fields:

- `id` UUID primary key.
- `trip_id` UUID foreign key.
- `display_name` text.
- `share_count` decimal/numeric.
- `status` text or enum-like constrained value.
- `version` integer.
- `created_at` timestamp.
- `updated_at` timestamp.

### API Changes

- `POST /api/v1/trips/{tripId}/families`
- Optional if needed for verification: `GET /api/v1/trips/{tripId}/participants`

Request:

```json
{
  "displayName": "Ivanov family",
  "shareCount": "2"
}
```

Response:

```json
{
  "family": {
    "id": "uuid",
    "tripId": "uuid",
    "displayName": "Ivanov family",
    "shareCount": "2",
    "status": "active"
  }
}
```

### Edge Cases

- **Invalid share count:** reject zero, negative, empty and non-decimal values.
- **Unauthorized user:** return `403`.
- **Trip not found:** return `404`.
- **Guest participant:** can view later, but cannot manage families in this story.

### Security Considerations

Family creation is owner-only. Server must check ownership from session context, not client-provided role.

## Dependencies

### Story Dependencies

- **Blocked by:** STORY-004.
- **Blocks:** STORY-008, STORY-009, STORY-015.

## Testing Requirements

### Unit Tests

- [ ] Family payload validation.
- [ ] Share count parsing and preservation.
- [ ] Owner permission helper.

### Integration Tests

- [ ] Owner creates family.
- [ ] Non-owner cannot create family.
- [ ] Invalid share count is rejected.
- [ ] Family appears in listing/verification query.

### Manual Testing

- [ ] Create trip as owner and add family with share count `2`.

## Definition of Done

- [ ] All acceptance criteria are met.
- [ ] Unit and integration tests pass.
- [ ] Access control is covered.
- [ ] Story status can be moved to Completed.

## Implementation Notes

Implemented in Sprint 2.

- Added `POST /api/v1/trips/{tripId}/families` for owner-only family aggregate creation.
- Added `GET /api/v1/trips/{tripId}/participants` so created families appear in trip participant context.
- Preserves decimal `shareCount` as submitted while enforcing `shareCount > 0`.
- Rejects guest/non-owner creation, duplicate active family names and archived/deleted trips.

Test evidence:

- `apps/api/src/sprint2.test.ts`
