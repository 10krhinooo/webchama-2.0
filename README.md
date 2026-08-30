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

# Infrastructure: PostgreSQL 16 + Keycloak 24, importing the demo realm below (audit finding
# P0-2: the realm is committed to git and must never be imported outside an isolated local/dev
# setup). Set CHAMA_SUPERADMIN_PASSWORD to pick your own admin password; otherwise a fixed dev
# default is used, see keycloak/dev-realm-entrypoint.sh.
docker compose up -d

# Backend, http://localhost:8080 (Dev UI at /q/dev/)
./mvnw quarkus:dev

# Frontend, http://localhost:5173
cd frontend && npm install && npm run dev
```

Postgres runs on host port 5434 (not 5432) to avoid colliding with other local projects. Keycloak runs on
8180.

Seed users (Keycloak, realm `chama`): `chairperson1/Chairperson1!`, `treasurer1/Treasurer1!`,
`secretary1/Secretary1!`, `member1/Member1!`, and `admin/Superadmin1!` (SUPER_ADMIN, override with
`CHAMA_SUPERADMIN_PASSWORD`). None of these are fixed values in `realm-chama.json` except the seed
users; the SUPER_ADMIN password is substituted in at container start, see
`keycloak/dev-realm-entrypoint.sh`.

## Features

- **Chamas and membership**: multi-tenant, a member can belong to several chamas via `member_role`, each
  with its own per-chama role. Tenant isolation is enforced on every request. An already-registered
  user can self-join another chama with a short join code (chairperson-generated, regenerable, and
  emailable to a prospective member), instead of only being added manually by a chairperson. A
  chairperson can also reissue a member's temporary password and re-send the credential email if the
  original invite was lost or never arrived, or add a whole group at once by importing a CSV file,
  previewing every problem in it before anything is created. Deleting a member with any financial history is
  rejected in favor of marking them exited, so contribution/loan/payment/penalty records are never
  silently lost.
- **Member self-service**: a My Money page gathering a member's own contributions, loans, payouts,
  penalties and welfare contributions into one mobile-first summary, so they can see where they
  stand without visiting five pages and doing the arithmetic themselves.
- **Contributions**: due dates, partial payments, overdue flagging, on-time streak tracking, and
  opt-in scheduled auto-STK-push so a member's contribution can be charged automatically when due.
  A chama can also switch on automatic reminders, a nudge some days before the due date, one on the
  day, and a repeating one while a contribution stays outstanding, delivered in the app and by
  email at an hour of the chama's choosing.
- **Payments**: M-Pesa STK Push and Flutterwave card checkout for contributions, self-service only (a
  member can only pay their own remaining balance). M-Pesa B2C for loan disbursement. A background
  sweep reconciles M-Pesa payments still stuck PENDING after a lost or delayed Daraja callback, and
  chairpersons/treasurers can tune or disable the scheduled auto-STK-push per chama.
- **Loans**: request, chairperson/treasurer approval or rejection, repayment schedule and tracking,
  and member credit scoring. A score weighs how completely and how promptly the member contributes
  and repays, whether they attend, and whether they have attracted penalties, weighting recent
  behaviour more heavily and reporting how much evidence it rests on. A component the chama does
  not record is dropped rather than scored as a pass, and a member with no history is reported as
  such rather than given a number.
- **Payout rotation**: define the "merry-go-round" order, track whose turn it is, mark disbursed.
- **Penalties**: configurable fine rules with an approval/waiver flow.
- **Meetings**: agenda, minutes, attendance tracking.
- **Welfare/emergency fund**: tracked as a distinct fund type alongside regular contributions. A
  withdrawal above the chama's approval threshold needs dual sign-off before any money leaves the
  fund, and the balance is re-checked at that point in case another withdrawal has since drained it.
- **Governance**: maker-checker dual approval for disbursements above a configurable threshold, and
  in-app voting/resolutions to digitize meeting decisions.
- **Documents**: PDF statement and receipt generation, plus a freeform document generator, delivered
  by email.
- **Notifications**: an in-app notification centre, reached from the bell in the header, with a live
  stream and a per-user inbox spanning every chama the user belongs to. The same events are also sent
  by email: approval requests, loan status changes (approved, disbursed, failed), payment receipts,
  payout and penalty status, meeting scheduling, welfare withdrawals, and failed auto-STK-push
  attempts. Each user chooses per event type whether to be told in app, by email, both, or neither.
- **Analytics**: a chama health score built from collection rate, arrears, loan repayment, meeting
  attendance and membership stability, with the components behind it shown rather than only the
  number. Alongside it, contributions billed against contributions collected month by month, unpaid
  balances aged into buckets, and a loan book broken down by status. A component the chama records
  nothing for is dropped rather than scored as a pass, and a chama with no history reports no score
  instead of a flattering one.
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

### End-to-end environment

`docker-compose.e2e.yml` stands up the whole product the way it is actually deployed: Postgres,
Keycloak, the Quarkus backend, and the SPA served by nginx rather than the Vite dev server, so the
`/api` reverse proxy and the OIDC redirect are exercised for real. A WireMock service stands in for
Safaricom Daraja and Flutterwave, so no test ever reaches a payment provider.

```bash
docker compose -f docker-compose.e2e.yml up -d --build
```

| Service | URL |
|---|---|
| SPA | http://localhost:5174 |
| Backend | http://localhost:8082 |
| Keycloak | http://localhost:8181 |
| Payment provider stub | http://localhost:8090 |
| Postgres | localhost:5435, database `chama_e2e` |

Every port differs from the dev stack and the volumes are namespaced by the `webchama-e2e` project
name, so this runs alongside `docker compose up -d` and `npm run dev` without colliding. Port 5174 is
whitelisted next to the dev server's 5173 on the `webchama-frontend` client in
`keycloak/realm-chama.json`; the OIDC redirect is rejected on any port that is not listed there.

`chama_e2e` is created by `postgres-init/02-create-e2e-db.sql` on first volume init. On a volume that
predates it:

```bash
docker exec webchama-e2e-postgres psql -U chama -d chama -c "CREATE DATABASE chama_e2e OWNER chama;"
```

### Running the end-to-end suite

```bash
cd e2e
npm ci
npx playwright install --with-deps chromium
npm test              # or: npm run test:headed, npm run test:ui
npm run report        # opens the last HTML report
```

The suite covers authentication and role-scoped navigation, tenant isolation, member
administration, the penalty lifecycle, a loan from request through M-Pesa disbursement, dual
sign-off above the approval threshold, and the M-Pesa contribution path end to end.

`globalSetup` waits for all three services, then truncates `chama_e2e` and applies the files in
`e2e/fixtures/`. If a run is interrupted and leaves the data in an odd state, reapply the
fixture by hand with `npm run db:reset`.

Three things about the fixture are worth knowing before changing it:

- **Ids are literal**, so a spec can navigate straight to `/chamas/4/loans` rather than discovering
  the id first, and every date derives from `date_trunc('month', CURRENT_DATE)` rather than a
  literal, so "last month is overdue" stays true next year.
- **Each mutating spec owns its own chama.** That is what lets the reset happen once per run
  instead of between files. A spec that writes to a chama it does not own will eventually break a
  different spec.
- **Member `phone` and `national_id` are stored as ciphertext**, because their unique indexes are on
  the ciphertext rather than the plaintext. Those rows are therefore written from TypeScript
  (`e2e/support/db.ts`) with the encryption applied in flight, from the plaintext in
  `e2e/fixtures/members.ts`, rather than being checked in as ciphertext. Changing the key needs no
  regeneration.

### Cross-browser smoke journeys

Playwright runs on Chromium only, which leaves everything that differs between engines unmeasured.
A small Selenium suite covers that gap against the same running stack:

```bash
docker compose -f docker-compose.e2e.yml up -d --build
./mvnw -Psmoke verify
```

Four journeys run in both Chrome and Firefox, about ninety seconds in total: the branded Keycloak
login page and its inline script, the single-sign-on session surviving keycloak-js's login-status
poll and a second tab, a chairperson creating a chama and reaching a dashboard whose activity feed
opens a real EventSource, and the platform overview CSV export writing an actual file to disk.

The suite deliberately seeds whatever it needs through the UI, so it does not depend on the
Playwright fixture and can run against a stack that has only just started.

`./mvnw verify` is unaffected: the journeys live in `src/test/java/org/chama/smoke` as `*IT` classes,
which only failsafe runs and only under `-Psmoke`. They cannot move the coverage numbers either,
since JaCoCo instruments `target/classes` and the gate reads an execution file written during the
test phase, before failsafe starts.

Useful overrides:

| Property | Default | Why |
|---|---|---|
| `-Dsmoke.browsers` | `chrome,firefox` | Narrow to one engine while iterating |
| `-Dsmoke.headless` | `true` | `false` to watch a journey run |
| `-Dsmoke.firefoxBinary` | (PATH) | Ubuntu's `/usr/bin/firefox` is a shell wrapper around the snap and is not launchable; point this at `/snap/firefox/current/usr/lib/firefox/firefox` |
| `-Dsmoke.chromeBinary` | (PATH) | Same escape hatch for Chrome |
| `-Dsmoke.baseUrl` | `http://localhost:5174` | Aim at a stack on other ports |

Downloads land in `target/smoke-downloads/` rather than a temporary directory, because the snap
Firefox is not permitted to write under `/tmp` and the download then never appears at all.

## Contribution workflow

This repository never receives commits directly on `main`. Every change lands on its own feature branch
and goes through a pull request that links the relevant milestone and issue(s) it closes. Commit messages
follow the Conventional Commits format (for example `feat(scope): summary`, `fix(scope): summary`,
`test(scope): summary`, `docs: summary`, `chore: summary`).
