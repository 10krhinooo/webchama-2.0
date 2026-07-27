# Webchama

Chama savings and table banking platform, built on Quarkus, React, PostgreSQL and Keycloak. A chama
is a member-owned savings group (common across East Africa) that pools regular contributions, rotates
payouts, issues loans to members, and runs on trust and transparent record-keeping. Webchama digitizes
that: contribution tracking, M-Pesa/card payments, loans, payout rotation, penalties, meetings,
welfare funds, in-app voting, and PDF statements, all scoped per chama with per-chama roles.

See the GitHub project board for tracked issues: https://github.com/users/10krhinooo/projects/3

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

# Infrastructure: PostgreSQL 16 + Keycloak 24
docker compose up -d

# Backend, http://localhost:8080 (Dev UI at /q/dev/)
./mvnw quarkus:dev

# Frontend, http://localhost:5173
cd frontend && npm install && npm run dev
```

Postgres runs on host port 5434 (not 5432) to avoid colliding with other local projects. Keycloak runs on
8180.

Seed users (Keycloak, realm `chama`): `admin/SuperAdmin1234!` (SUPER_ADMIN), `chairperson1/Chairperson1!`,
`treasurer1/Treasurer1!`, `secretary1/Secretary1!`, `member1/Member1!`.

## Features

- **Chamas and membership**: multi-tenant, a member can belong to several chamas via `member_role`, each
  with its own per-chama role. Tenant isolation is enforced on every request.
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
