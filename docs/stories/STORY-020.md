# Project scaffold, local dev environment and quality pipeline

- **ID:** STORY-020
- **Epic:** Technical Foundation
- **Priority:** Must Have
- **Story Points:** 5
- **Status:** Completed

## User Story

As a **developer**  
I want to **run Owebee locally with web, API, database and quality checks**  
So that **future product stories can be implemented safely and consistently**

## Acceptance Criteria

- [x] Monorepo structure exists with `apps/web`, `apps/api`, and shared package area.
- [x] Local development command starts web app, API, PostgreSQL and Redis or documents how to start them separately.
- [x] API exposes a health endpoint that verifies process liveness and readiness basics.
- [x] CI or local scripts exist for lint, typecheck, test and build.
- [x] Project README documents setup, environment variables and common commands.
- [x] No secrets are committed; sample environment file is provided.

## Technical Notes

### Implementation Approach

Use the architecture recommendation: TypeScript monorepo, React/Vite frontend, Node.js backend, PostgreSQL and Redis. Keep tooling simple and runnable before adding product complexity.

### Files/Modules Affected

- `apps/web` - PWA/web app scaffold.
- `apps/api` - REST API scaffold and health endpoints.
- `packages` - shared schemas/config package area.
- `docker-compose.yml` - local PostgreSQL and Redis.
- `README.md` - local setup documentation.
- CI config if repository provider is known; otherwise add local scripts first.

### Data Model Changes

None beyond local database container setup.

### API Changes

- `GET /health/live`
- `GET /health/ready`

### Edge Cases

- **Database unavailable:** readiness endpoint returns non-200 or degraded status.
- **Redis unavailable:** readiness endpoint reports dependency failure.
- **Missing env vars:** API fails fast with clear startup message.

### Performance Considerations

No product performance requirement yet; keep dev server startup reasonable and avoid heavyweight tooling.

### Security Considerations

Environment variables must not leak secrets. Add `.env.example`, `.gitignore` and documented secret handling.

## Dependencies

### Story Dependencies

- **Blocked by:** None.
- **Blocks:** STORY-021, STORY-001, STORY-022.

### Technical Dependencies

- Node.js runtime.
- PostgreSQL.
- Redis.
- Package manager selection.

### Open Questions

- [x] Confirm final package manager: `pnpm` selected.
- [x] Confirm backend framework: Fastify selected for Sprint 1 scaffold.

## Testing Requirements

### Unit Tests

- [x] Health service returns expected liveness payload.

### Integration Tests

- [x] Readiness endpoint detects PostgreSQL availability.
- [x] Readiness endpoint detects Redis availability.

### Manual Testing

- [x] Fresh checkout can run local stack using documented commands.
- [x] Web app builds successfully.
- [x] API health endpoint behavior is covered by integration tests.

## Definition of Done

- [x] Code is written and follows project coding standards.
- [x] All acceptance criteria are met and verified.
- [x] Unit tests are written and passing for new code.
- [x] Integration tests are written and passing where applicable.
- [x] Documentation is updated.
- [x] Local setup is reproducible from a fresh checkout.

## Notes

This is an enabler story added by sprint planning. It is required before PRD product stories can be implemented efficiently.

## Implementation Notes

- Package manager: `pnpm`.
- Backend framework: Fastify.
- Docker/Colima smoke test passed with PostgreSQL on host port `5432` and Redis on host port `6380`.
- Live API readiness check returned healthy PostgreSQL and Redis dependency statuses.
- Automated readiness tests also cover PostgreSQL and Redis success/failure behavior through dependency-checker injection.
