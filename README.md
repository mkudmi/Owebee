# Owebee

Owebee is a web/PWA application for splitting shared trip expenses across people, families, and currencies.

## Stack

- `pnpm` workspace monorepo
- `apps/web`: React + TypeScript + Vite
- `apps/api`: Fastify + TypeScript
- `packages/config`: shared environment/config helpers
- PostgreSQL 16 and Redis 7 for local development

## First-Time Setup

```bash
cp .env.example .env
pnpm install
pnpm dev:infra
pnpm dev
```

`pnpm dev:infra` starts PostgreSQL and Redis through Docker Compose.
`pnpm dev` starts the API and web app.
`pnpm dev:all` starts infrastructure first, then web/API.
Redis is exposed on host port `6380` to avoid collisions with a locally running Redis on the default `6379`.

Default local URLs:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- API liveness: `http://localhost:4000/health/live`
- API readiness: `http://localhost:4000/health/ready`

## Environment Variables

Use `.env.example` as the source of required local variables:

- `API_HOST`
- `API_PORT`
- `DATABASE_URL`
- `REDIS_URL`

Do not commit `.env` files with secrets.

## Quality Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check
```

## BMAD Artifacts

BMAD Method v6 stores generated artifacts under:

- `_bmad-output/planning-artifacts/`
- `_bmad-output/implementation-artifacts/`
