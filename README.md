# Webchama

Chama savings and table banking platform, built on Quarkus, React, PostgreSQL and Keycloak.

See the GitHub project board for phase by phase issues: https://github.com/users/10krhinooo/projects/3

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Quarkus 3.37.3, Java 21, Maven |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 3 (`frontend/`) |
| Database | PostgreSQL 16 via Flyway migrations |
| Auth | Keycloak 24 OIDC, realm `chama`, roles: SUPER_ADMIN, CHAIRPERSON, TREASURER, SECRETARY, MEMBER |
| Payments | M-Pesa Daraja STK Push and Flutterwave card payments (backend), B2C payout (planned) |
| CI | GitHub Actions, backend and frontend each gated at 90 percent test coverage |

## Getting started

```bash
# Backend config, copy once, application.properties is gitignored
cp src/main/resources/example.application.properties src/main/resources/application.properties

# Infrastructure: PostgreSQL 16 + Keycloak 24
docker compose up -d

# Backend, http://localhost:8080
./mvnw quarkus:dev

# Frontend, http://localhost:5173
cd frontend && npm install && npm run dev
```

Postgres runs on host port 5434 (not 5432) to avoid colliding with other local projects. Keycloak runs on
8180.

Seed users (Keycloak, realm `chama`): `admin/SuperAdmin1234!` (SUPER_ADMIN), `chairperson1/Chairperson1!`,
`treasurer1/Treasurer1!`, `secretary1/Secretary1!`, `member1/Member1!`.

## Testing and coverage

Both the backend and frontend enforce a 90 percent minimum test coverage threshold in CI. Every module
added to this project ships with tests alongside it, coverage is not backfilled after the fact.

```bash
# Backend: runs tests and checks the JaCoCo coverage gate
./mvnw verify

# Frontend: runs tests and checks the Vitest coverage gate
cd frontend && npm run test:coverage
```

## Contribution workflow

This repository never receives commits directly on `main`. Each phase of work happens on its own feature
branch, gets pushed, and lands through a pull request that links the relevant milestone and issue(s) it
closes. Commit messages follow the Conventional Commits format (for example `feat(scope): summary`,
`fix(scope): summary`, `test(scope): summary`, `docs: summary`, `chore: summary`).

## Project status

Phase 1 (project scaffold, CI/CD gate, design system and public homepage) and Phase 2 (core domain
model: chama, member, contribution, tenant-scoped auth, admin CRUD UI) are complete. Phase 3 backend
(M-Pesa STK push and Flutterwave card payments for contributions) is merged, with the M-Pesa
confirmation-gate modal on the frontend. Card payment frontend and the branded Keycloak login theme
are not built yet. See the project board for phase by phase progress.
