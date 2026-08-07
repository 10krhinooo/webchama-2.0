# Webchama

Chama savings and table banking platform, built on Quarkus, React, PostgreSQL and Keycloak. A chama
is a member-owned savings group (common across East Africa) that pools regular contributions, rotates
payouts, issues loans to members, and runs on trust and transparent record-keeping. Webchama digitizes
that: contribution tracking, M-Pesa/card payments, loans, payout rotation, penalties, meetings,
welfare funds, in-app voting, and PDF statements, all scoped per chama with per-chama roles.

See the GitHub project board for tracked issues: https://github.com/users/10krhinooo/projects/3

For a deeper walkthrough of the architecture, key files, common tasks, and debugging tips, see
[ONBOARDING.md](ONBOARDING.md).

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Quarkus 3.37.3, Java 21, Maven |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 3, shadcn/ui primitives (`frontend/`) |
| Database | PostgreSQL 16 via Flyway migrations |
| Auth | Keycloak 24 OIDC, realm `chama`. `SUPER_ADMIN` is a platform-wide Keycloak realm role; `CHAIRPERSON`, `TREASURER`, `SECRETARY`, `MEMBER` are per-chama roles stored in the `member_role` table, not the JWT, since a member can hold different roles in different chamas |
| Payments | M-Pesa Daraja STK Push (contributions) and B2C (loan disbursement), Flutterwave card payments, both with webhook signature verification and idempotent crediting |
| Documents | PDF statement/receipt generation with email delivery |
| CI | GitHub Actions, backend (JaCoCo) and frontend (Vitest) each gated at 90 percent test coverage |

## Getting started

```bash
# Backend config, copy once, application.properties is gitignored
cp src/main/resources/example.application.properties src/main/resources/application.properties

# Infrastructure: PostgreSQL 16 + Keycloak 24. CHAMA_DEV_REALM_IMPORT=true opts in to importing
# the demo realm below; without it Keycloak boots with no realm at all (audit finding P0-2, the
# demo realm is committed to git and must never be imported outside an isolated local/dev setup).
CHAMA_DEV_REALM_IMPORT=true docker compose up -d

# Backend, http://localhost:8080 (Dev UI at /q/dev/)
./mvnw quarkus:dev

# Frontend, http://localhost:5173
cd frontend && npm install && npm run dev
```

Postgres runs on host port 5434 (not 5432) to avoid colliding with other local projects. Keycloak runs on
8180.

Seed users (Keycloak, realm `chama`): `chairperson1/Chairperson1!`, `treasurer1/Treasurer1!`,
`secretary1/Secretary1!`, `member1/Member1!`. The `admin` SUPER_ADMIN user's password is generated fresh
on every `docker compose up` instead of being a fixed value in git; read it from the Keycloak container's
startup logs: `docker compose logs keycloak | grep "Generated SUPER_ADMIN password"`.

## Features

- **Chamas and membership**: multi-tenant, a member can belong to several chamas via `member_role`, each
  with its own per-chama role. Tenant isolation is enforced on every request. An already-registered
  user can self-join another chama with a short join code (chairperson-generated, regenerable, and
  emailable to a prospective member), instead of only being added manually by a chairperson.
- **Contributions**: due dates, partial payments, overdue flagging, on-time streak tracking, and
  opt-in scheduled auto-STK-push so a member's contribution can be charged automatically when due.
- **Payments**: M-Pesa STK Push and Flutterwave card checkout for contributions, self-service only (a
  member can only pay their own remaining balance). M-Pesa B2C for loan disbursement. A background
  sweep reconciles M-Pesa payments still stuck PENDING after a lost or delayed Daraja callback, and
  chairpersons/treasurers can tune or disable the scheduled auto-STK-push per chama.
- **Loans**: request, chairperson/treasurer approval or rejection, repayment schedule and tracking,
  member credit scoring derived from contribution consistency and repayment history.
- **Payout rotation**: define the "merry-go-round" order, track whose turn it is, mark disbursed.
- **Penalties**: configurable fine rules with an approval/waiver flow.
- **Meetings**: agenda, minutes, attendance tracking.
- **Welfare/emergency fund**: tracked as a distinct fund type alongside regular contributions.
- **Governance**: maker-checker dual approval for disbursements above a configurable threshold, and
  in-app voting/resolutions to digitize meeting decisions.
- **Documents**: PDF statement and receipt generation, plus a freeform document generator, delivered
  by email.
- **Audit trail**: an immutable activity log covering financial and governance events, and a synced
  feed of Keycloak security events (logins, failed attempts, password changes), viewable on a
  SUPER_ADMIN-only security events page with suspicious rows highlighted and email alerts on
  account lockouts.
- **Security**: per-IP rate limiting on payment and webhook endpoints, fail-closed Flutterwave webhook
  signature verification, idempotent M-Pesa callback handling, hardened Keycloak realm settings
  (enforced SSL, ROPC disabled on the SPA client), and a branded, custom Keycloak login theme.

## Testing and coverage

Both the backend and frontend enforce a 90 percent minimum test coverage threshold in CI. Every module
added to this project ships with tests alongside it, coverage is not backfilled after the fact.

Backend tests run against their own database, `chama_test`, kept separate from the `chama` database
the dev server uses. `postgres-init/01-create-test-db.sql` creates it automatically the first time the
`postgres` container initializes its data volume (a fresh `docker compose up -d`, or CI). If you already
had a `postgres_data` volume from before this existed, create it once by hand instead:

```bash
docker exec webchama-postgres psql -U chama -d chama -c "CREATE DATABASE chama_test OWNER chama;"
```

`@QuarkusTest` classes wipe every table in `@BeforeEach`, so this separation matters: without it, running
tests locally would wipe out whatever you were looking at in the dev database.

```bash
# Backend: runs tests and checks the JaCoCo coverage gate
./mvnw verify

# Frontend: runs tests and checks the Vitest coverage gate
cd frontend && npm run test:coverage
```

## Contribution workflow

This repository never receives commits directly on `main`. Every change lands on its own feature branch
and goes through a pull request that links the relevant milestone and issue(s) it closes. Commit messages
follow the Conventional Commits format (for example `feat(scope): summary`, `fix(scope): summary`,
`test(scope): summary`, `docs: summary`, `chore: summary`).
