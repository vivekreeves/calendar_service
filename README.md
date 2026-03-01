# Calendar Service

Docker-ready Fastify + TypeScript service skeleton for holiday checks.

## Prerequisites
- Docker + Docker Compose
- (Local dev) Node 20+ and npm

## Quick start with Docker
```bash
docker compose --project-directory . --file docker-compose.yml --env-file .env up --build
```
Then call health:
```bash
curl http://localhost:3000/healthz
```

## Local dev (without Docker)
```bash
cp .env.example .env
npm install
npm run dev
```

## Sample endpoints
- `GET /healthz` — liveness
- `GET /readyz` — checks DB + Redis
- `GET /v1/holiday/check?project_id=123&date=2026-03-01`
- `POST /v1/holiday/check` with `{ "project_id": "123", "dates": ["2026-03-01"] }`
- `POST /v1/holiday/check-multi` with `{ "queries": [{ "project_id": "123", "date": "2026-03-01" }] }`

The holiday logic is stubbed (weekend vs weekday). Replace with DB + cache lookups per docs in docs/architecture.md.
