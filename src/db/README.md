# Database Operations Guide

This guide summarizes the steps to launch Postgres via Docker Compose, create the holiday tables, seed them, and verify the data.

## 1. Launch Postgres (and optional pgAdmin UI)
From the project root:
```bash
docker compose up -d db pgadmin
```
- Postgres credentials come from `.env` (`calendar_user` / `calendar_pass`).
- pgAdmin UI (optional) is served at http://localhost:5050 with credentials in `.env`.

## 2. Apply Schema and Seed Data
```bash
# Create/refresh tables
docker compose exec -T db psql -U calendar_user -d calendar_service < src/db/schema.sql

# Insert regional holiday data
docker compose exec -T db psql -U calendar_user -d calendar_service < src/db/sample_data.sql
```
The schema defines:
- `region(country_code PK, region_name, created_at)`
- `country(id PK, country_code FK -> region.country_code, holiday_date, holiday_name, last_updated, UNIQUE(country_code, holiday_date))`

## 3. Verify Tables
List all tables:
```bash
docker compose exec -T db psql -U calendar_user -d calendar_service -c '\dt'
```
Describe a table:
```bash
docker compose exec -T db psql -U calendar_user -d calendar_service -c '\d region'
```
Sample joined data:
```bash
docker compose exec -T db psql -U calendar_user -d calendar_service -c \
"SELECT region_name, country_code, holiday_date, holiday_name FROM region JOIN country USING (country_code) ORDER BY region_name, country_code, holiday_date LIMIT 12;"
```

## 4. Shutdown
```bash
docker compose down
```
Add `-v` if you want to remove the Postgres/pgAdmin volumes as well.
