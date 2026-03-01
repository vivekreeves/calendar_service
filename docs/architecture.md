# Holiday Calendar Service – Project Plan

## Goals & Scope
- Provide a service-oriented platform to determine if a given date is a working day for a project, based on its country/region holiday calendar.
- Expose REST endpoints consumable by schedulers (Control-M, Airflow) and other services.
- Support multi-project queries, caching, batching, and fan-out notifications to dependent systems.
- Backed by PostgreSQL with clear separation between DB layer and service layer.

## High-Level Architecture
- **DB Layer (PostgreSQL):** Stores projects, calendars, holidays, regional overrides, and notification subscriptions.
- **Service Layer (REST API):** CRUD for calendars/projects, holiday checks, batch queries, and notification triggers.
- **Caching:** Read-through cache for holiday lookups; short-lived cache for batch results; optional CDN for static calendars.
- **Batching:** API endpoints accept lists of project IDs/dates; server coalesces requests to minimize DB round-trips.
- **Fan-out:** Async event publishing (e.g., via message bus like SNS/SQS, Kafka, or webhooks) to notify downstream systems.
- **Infra:** Containerized service; can be deployed behind API gateway; supports horizontal scaling.

## Database Schema (PostgreSQL)
Tables (representational):

```sql
-- Countries/regions metadata
CREATE TABLE regions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,          -- e.g., US, US-CA, IN, IN-KA
    name VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL
);

-- Projects configured to a region/calendar
CREATE TABLE projects (
    id BIGSERIAL PRIMARY KEY,
    external_ref VARCHAR(100) UNIQUE NOT NULL, -- provided by caller
    name VARCHAR(150) NOT NULL,
    region_id INT NOT NULL REFERENCES regions(id),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Holiday definitions per region
CREATE TABLE holidays (
    id BIGSERIAL PRIMARY KEY,
    region_id INT NOT NULL REFERENCES regions(id),
    holiday_date DATE NOT NULL,
    name VARCHAR(150) NOT NULL,
    is_working_day_override BOOLEAN DEFAULT FALSE, -- allow marking a weekend as working
    UNIQUE(region_id, holiday_date)
);

-- Optional project-specific overrides
CREATE TABLE project_overrides (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id),
    override_date DATE NOT NULL,
    is_working_day BOOLEAN NOT NULL,
    note VARCHAR(200),
    UNIQUE(project_id, override_date)
);

-- Subscriptions for fan-out notifications
CREATE TABLE subscriptions (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id),
    target_type VARCHAR(30) NOT NULL,  -- webhook|sns|sqs|kafka|email
    target_endpoint TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit / changes (optional but recommended)
CREATE TABLE calendar_audit (
    id BIGSERIAL PRIMARY KEY,
    actor VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,  -- create|update|delete
    entity VARCHAR(50) NOT NULL,  -- region|holiday|override|project
    entity_id BIGINT NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Indexes:
- `holidays(region_id, holiday_date)`
- `project_overrides(project_id, override_date)`
- `projects(external_ref)`
- `subscriptions(project_id, active)`

## REST API (Service Layer)
Base path: `/v1`

### Project & Calendar Management
- `POST /projects` – create project (name, external_ref, region_id)
- `GET /projects/{id}` – fetch project
- `GET /projects?external_ref=...` – lookup by external ref
- `PATCH /projects/{id}` – update project (name, region, active)
- `GET /regions` – list regions
- `POST /regions` – create region (admin-only)

### Holiday Management
- `POST /regions/{region_id}/holidays` – bulk upsert list of holidays
- `DELETE /regions/{region_id}/holidays/{date}` – remove a holiday
- `POST /projects/{id}/overrides` – upsert overrides (working/non-working)
- `DELETE /projects/{id}/overrides/{date}` – delete override

### Holiday Check & Batch Queries
- `GET /holiday/check?project_id=...&date=YYYY-MM-DD` – returns `{is_working_day: bool, reason: string}`
- `POST /holiday/check` – body: `{project_id, dates: [YYYY-MM-DD...]}` returns array of results
- `POST /holiday/check-multi` – body: `{queries: [{project_id, date}]}` for cross-project batching
- `GET /holiday/next-working-day?project_id=...&from=YYYY-MM-DD` – compute next working day

### Notifications / Fan-out
- `POST /projects/{id}/subscriptions` – create subscription (webhook/SNS/SQS/Kafka/email)
- `GET /projects/{id}/subscriptions` – list
- `DELETE /subscriptions/{id}` – deactivate
- `POST /notify/daily` – trigger daily digest (batch) to subscribers for that project/region

### Health & Ops
- `GET /healthz` – liveness
- `GET /readyz` – readiness (checks DB/cache)
- `GET /metrics` – Prometheus scrape endpoint

## Caching Strategy
- **Primary cache (e.g., Redis/Memcached):**
  - Key: `holiday:{region_code}:{date}` → holiday metadata + is_working_day flag.
  - Key: `project_override:{project_id}:{date}` → override record.
  - TTL: medium (e.g., 6–24h) for static calendars; shorter (e.g., 1–6h) when calendars change frequently.
  - Populate via read-through; invalidate on writes (holiday/upsert/override changes).
- **Batch cache:**
  - Key: `batch:{project_id}:{start}:{end}` storing compressed arrays of working-day flags.
  - Useful for week/month queries used by schedulers.
- **Client-side cache hints:** `Cache-Control` for read-only endpoints; `ETag` on calendar resources.

## Batching Strategy
- Accept arrays for dates and multi-project queries to reduce round-trips.
- Coalesce concurrent identical requests (request de-duplication) using a single-flight mechanism per key `(project_id, date)`.
- Precompute daily materialized views (or cache warming job) for the next N days per region, refreshing nightly.

## Fan-out / Notifications
- On `POST /notify/daily`, the service computes that day’s working status per subscribed project and publishes events:
  - Webhook POST payload: `{project_id, date, is_working_day, reason}`
  - Message bus events (topic keyed by region or project) for SQS/SNS/Kafka
- Retries with backoff; DLQ for failures; idempotency keys per date+project.

## Scalability & Reliability
- Horizontal scaling of stateless service pods; DB read replicas for read-heavy traffic.
- Use connection pooling (PgBouncer) and tune idle timeouts.
- Circuit breakers around cache and DB; graceful degradation (fallback to DB if cache misses, short TTLs on error).
- Rate limiting per caller/API key; auth via tokens/API keys.
- Observability: structured logs with correlation IDs, metrics (cache hit rate, request latency, fan-out successes), traces.

## Data Flows
1) **Holiday check (single):** API → cache lookup; on miss → DB query → cache set → respond.
2) **Holiday check (batch):** API → cache warm batch (if present) or fetch per date with request coalescing → aggregate → cache batch.
3) **Calendar updates:** Admin/API → upsert holidays → invalidate cache keys for affected region/dates → publish audit.
4) **Daily notifier:** Scheduler/cron → call `/notify/daily` → compute statuses → publish events/webhooks → record delivery results.

## Operational Tasks / Jobs
- Nightly cache warm for next N days per active region/project.
- Periodic sync/import from authoritative holiday sources (government APIs or ICS feeds).
- DLQ replayer for failed notifications.

## Testing Approach
- Unit tests: date logic, timezone handling, weekend vs holiday overrides.
- Integration tests: DB + cache interactions, batch endpoints, idempotent upserts.
- Contract tests for webhooks/event payloads.
- Load tests on batch endpoints and cache hit behavior.

## MVP Milestones
1) DB schema + migrations; seed a few regions/holidays.
2) Core holiday check endpoints (`/holiday/check`, `/holiday/check-multi`).
3) Override handling; cache integration; request coalescing.
4) Notifications fan-out (webhook + one queue provider to start).
5) Ops endpoints (`healthz`, `readyz`, `metrics`) and dashboards.
