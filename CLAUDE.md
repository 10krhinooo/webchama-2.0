# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Webchama 2.0 is a from-scratch rewrite of `Projects/web-chama/` (a Laravel/Filament chama/table-banking
prototype) on the same stack used by `Projects/dondooHomes/`. See `MIGRATION_PLAN.md` in this repo for the
full plan (domain model, roles, payments, security review, standout features) and the GitHub project board
(https://github.com/users/10krhinooo/projects/3) for phase-by-phase issues.

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Quarkus 3.37.3, Java 21, Maven |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 3 (`frontend/`) |
| Database | PostgreSQL 16 via Flyway migrations |
| Auth | Keycloak 24 OIDC — realm `chama`, roles: SUPER_ADMIN / CHAIRPERSON / TREASURER / SECRETARY / MEMBER |
| Payments | M-Pesa Daraja STK Push + B2C payout, Flutterwave card payments (planned — see MIGRATION_PLAN.md §6) |
| Root package | `org.chama` |

## Commands

```bash
# Backend
./mvnw quarkus:dev          # Dev mode — http://localhost:8080 (Dev UI at /q/dev/)
./mvnw compile              # Compile only
./mvnw verify               # Tests

# Frontend
cd frontend && npm run dev   # Vite dev server — http://localhost:5173
cd frontend && npm run build # Production build (also runs tsc -b)

# Infrastructure
docker compose up -d         # Start PostgreSQL 16 + Keycloak 24
docker compose down -v       # Stop and remove volumes
```

## Running locally

1. `docker compose up -d` — wait for postgres + keycloak to be healthy
2. `./mvnw quarkus:dev` — Flyway applies migrations automatically; Quarkus starts on :8080
3. `cd frontend && npm run dev` — Vite dev proxy forwards `/api` → `http://localhost:8080`

Seed users (Keycloak, realm `chama`): `admin/SuperAdmin1234!` (SUPER_ADMIN), `chairperson1/Chairperson1!`,
`treasurer1/Treasurer1!`, `secretary1/Secretary1!`, `member1/Member1!`.

Postgres runs on host port **5434** (not 5432) to avoid colliding with other local projects — see
`docker-compose.yml`. Keycloak runs on **8180**, matching DondooHomes' convention.

## Current state (Phase 1 complete)

Only the Phase 1 scaffold exists so far: empty backend package skeleton
(`config/domain/repository/service/rest/dto/security/scheduler/exception`, all `.gitkeep`), a placeholder
`HomePage`, the `chama` Keycloak realm/roles, Docker Compose, a Flyway baseline migration, and CI. No
domain model, business logic, or real UI yet — that starts at Phase 2. Do not assume any endpoint, entity,
or page exists beyond what's listed here without checking the code first.

**Keycloak login theme**: `keycloak/themes/chama/login/theme.properties` is currently just `parent=keycloak`
(stock look). The branded theme (login.ftl etc., matching DondooHomes' `keycloak/themes/dondoo/login/`
structure) is Phase 7 work, not done yet.

**Design tokens**: `frontend/tailwind.config.js` has a *starter* palette (indigo `primary` #4F46E5, plus
secondary/danger/success/warning/muted/ink/canvas/night tokens) — distinct-but-consistent with DondooHomes
per MIGRATION_PLAN.md §3. Confirmed direction, but treat as provisional until revisited at UI kickoff.

See `MIGRATION_PLAN.md` for the full architecture, domain model, payments/security plan, and the phase
breakdown — that document is the source of truth for anything not yet built.
