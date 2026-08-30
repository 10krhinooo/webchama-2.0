# Onboarding

This is the deeper walkthrough for anyone getting oriented in Webchama beyond the README's
5-minute quick start: why things are built the way they are, where to look for what, and how to
get unstuck. If you just want the app running, see [README.md](README.md) first.

## What is this

Webchama digitizes a chama, an informal savings and table-banking group common in Kenya. Members
contribute on a schedule (weekly or monthly), the pooled money funds a payout rotation and member
loans, and a chairperson/treasurer/secretary run the group day to day. The app replaces the
WhatsApp-and-notebook version of this with contribution tracking, M-Pesa/card payments, loan
approval and repayment, payout rotation scheduling, and penalty/meeting tracking, each gated by
role.

Roles, resolved per chama (see [Architecture](#architecture) below), not globally: SUPER_ADMIN
(platform-level, cross-chama oversight, no default access to any one chama's financial data),
CHAIRPERSON, TREASURER, SECRETARY, MEMBER.

## Architecture

```
Browser (React SPA)
    |
    | REST + JSON, Bearer token from Keycloak
    v
Quarkus backend
    |-- rest/        JAX-RS resources, one per domain area, role-gated
    |-- service/      business logic + external HTTP clients
    |-- repository/   Panache repositories
    |-- domain/       JPA entities + enums
    |
    +--> PostgreSQL (Flyway-owned schema, Hibernate never auto-generates DDL)
    +--> Keycloak, two ways:
    |      - OIDC: validates the bearer token on every authenticated request
    |      - Admin REST API (KeycloakAdminService): provisions member accounts on invite,
    |        and polls Keycloak's own login/admin event log for security-event ingestion
    +--> M-Pesa Daraja: STK push (contributions), B2C (loan disbursement)
    +--> Flutterwave: card checkout (contributions, diaspora members without M-Pesa)
```

Three architectural decisions are worth understanding before you change anything nearby:

- **Chama-scoped roles are never Keycloak realm roles, and SUPER_ADMIN gets no bypass of them.**
  A person's role (chairperson, treasurer, ...) can differ per chama, so it can't live in a JWT
  claim that's the same for every request that user makes. `TenantAccessService` resolves it fresh
  from the `member_role` table for the specific chama in the request path, every time, rather than
  trusting anything cached in the token. SUPER_ADMIN is a real Keycloak realm role, but it carries
  no special treatment inside `TenantAccessService`: a platform owner reaches a chama's own
  members/contributions only if they hold an actual member row in it, exactly like anyone else.
  Platform-level, cross-chama oversight is a separate, deliberately aggregated read path instead,
  `PlatformOverviewResource`/`PlatformStatsService`, gated directly via `CurrentUser.isSuperAdmin()`
  since it isn't chama-scoped to begin with.
- **Money movement above a threshold needs a second sign-off.** `ApprovalService` implements
  maker-checker: `Chama.approvalThreshold` decides whether an action (loan disbursement today)
  needs a cleared `Approval` row before it's allowed to execute, and the person who requested it
  can't also be the one who clears it. Check `ApprovalService`'s doc comments before adding a new
  action that should be gated the same way.
- **Keycloak's own security events are polled, not pushed.** `KeycloakSecurityEventSyncService`
  polls Keycloak's `/events` and `/admin-events` REST endpoints on a schedule rather than
  registering a custom Keycloak Event Listener SPI provider, trading a small ingestion delay for
  not having to build and deploy a custom Keycloak plugin.

## Key files

| Path | Purpose |
|---|---|
| `src/main/java/org/chama/rest/` | JAX-RS resources, one per domain area: Chama, Contribution, Loan, Meeting, Member, Payment/B2C callbacks, Payout, Penalty, plus governance and platform areas added later (Approval, Resolution, ActivityLog, Document, WelfareFund, PlatformOverview, SecurityEvent), and a rate-limit filter |
| `src/main/java/org/chama/service/` | Business logic and external HTTP clients: payment providers (Daraja B2C, Flutterwave, M-Pesa STK), Keycloak Admin API, notifications, plus governance/reporting services (Approval, Resolution, ActivityLog, CreditScore, DocumentGeneration/Pdf, WelfareFund/WelfareContribution, PlatformStats, ContributionAutoPush) |
| `src/main/java/org/chama/repository/` | Panache repositories, one per entity |
| `src/main/java/org/chama/domain/model/` and `domain/enums/` | JPA entities and their enums |
| `src/main/java/org/chama/security/` | `CurrentUser` (request identity), `TenantAccessService` (per-chama role resolution, no SUPER_ADMIN bypass) |
| `src/main/java/org/chama/config/` | `@ConfigMapping` interfaces for the M-Pesa/Flutterwave/B2C credential groups |
| `src/main/resources/db/migration/` | Flyway migrations, `V1` through the current head |
| `frontend/src/pages/public/` | Marketing site (unauthenticated) |
| `frontend/src/pages/staff/` | Authenticated dashboard: Chamas, Members, Contributions, Loans, Payouts, Approvals, Resolutions, WelfareFund, DocumentGenerator, SecurityEvents, AdminOverview, MyChamas |
| `frontend/src/components/{layout,marketing,ui}/` | Layout chrome, marketing-specific components, generic UI primitives |
| `frontend/src/api/` | One thin fetch-wrapper module per backend REST resource |
| `frontend/src/auth/` | `KeycloakProvider`, `ProtectedRoute` |
| `docker-compose.yml` | Local Postgres + Keycloak |
| `postgres-init/` | SQL run once against a fresh Postgres data volume (currently: creating the `chama_test` database) |
| `keycloak/realm-chama.json` | The `chama` realm definition Keycloak imports on first boot, dev-only, see `keycloak/dev-realm-entrypoint.sh` |
| `Dockerfile`, `frontend/Dockerfile`, `DEPLOYMENT.md` | Backend/frontend container images and the runbook for running them somewhere real |

## Common developer tasks

**Add a Flyway migration.** Add `V<next-number>__description.sql` to
`src/main/resources/db/migration/`, following the naming and style of the existing files there.
Never edit an already-applied migration; add a new one.

**Add a REST resource.** `SecurityEventResource.java` is a good, small template: inject a Panache
repository, map entities to a DTO record, gate with `@Authenticated` plus an explicit role check
(`CurrentUser` for platform-level, `TenantAccessService` for chama-scoped).

**Add a frontend dashboard page.** `LoansPage.tsx` shows the shape most `pages/staff/` pages
follow: fetch on mount depending on role, a loading skeleton, a table, and one or more modals for
create/edit actions.

**Run a single test.**

```bash
./mvnw test -Dtest=ClassName
cd frontend && npx vitest run path/to/File.test.tsx
```

**Pick a colour.** Colour comes in two kinds, and choosing the wrong one is what breaks dark mode.

*Semantic tokens* resolve through CSS custom properties defined in `frontend/src/index.css`, so
the same class produces the right value in both themes. Use these in application code:

| Token | Use for |
|---|---|
| `bg-paper`, `bg-paper-dim` | page background, sunken areas such as a table header |
| `bg-surface`, `bg-surface-raised` | cards and anything sitting above the page |
| `text-ink`, `text-muted`, `text-subtle` | body text, secondary text, de-emphasised text |
| `text-brand` | brand-coloured text and links |
| `bg-primary` | a brand-coloured fill sitting behind white text |
| `border-border`, `border-border-strong` | dividers and outlines |
| `text-success`, `text-warning`, `text-danger` | status, each a distinct hue from the brand |

*Static ramps* (`primary-50` through `primary-950`, and the same for `accent` and `neutral`) are
fixed values that mean the same thing in every theme. Reach for a numbered step only when a
specific shade is required regardless of theme, such as a chart series that has to stay
distinguishable in both.

`primary` and `brand` are the same hue and are not interchangeable. `primary` is a fill, so it
stays dark enough to carry white text in both themes. `brand` is a text colour, so it inverts and
goes light in dark mode. Using `text-primary` produces brand-coloured text that disappears against
a dark surface, which is why that class no longer exists.

Never write `bg-white`, `border-black/10` or a literal hex value into a component. Each is correct
in exactly one theme.

**Notify someone.** `NotificationService.record(...)` writes to a user's in-app inbox, and
`notificationService.emailEnabled(...)` says whether the matching email should still go out. A
business service does both, so one event produces an inbox row and a message, and a user who has
switched that family off gets neither:

```java
notificationService.record(member.keycloakUserId, chama.id, NotificationEventFamily.LOAN,
    "Loan approved", "Your loan of KES 10,000 was approved.", "/chamas/" + chama.id + "/loans");
if (notificationService.emailEnabled(member.keycloakUserId, NotificationEventFamily.LOAN)) {
    loanStatusEmailService.sendApproved(...);
}
```

Notifications are addressed to a Keycloak user, not a member row: someone in three chamas has one
inbox, and the bell renders on pages with no chama in the route. `record` joins the caller's
transaction, so a rolled back action cannot leave someone told about something that did not
happen. Preferences are per event family rather than per email, and a missing row means both
channels are on.

**Add a theme-aware colour.** Add the RGB triple to both the `:root` and `.dark` blocks in
`index.css`, then expose it in `tailwind.config.js` through the `withAlpha` helper so it composes
with an alpha channel like any built-in colour.

## Debugging guide

- **Postgres**: `localhost:5434`, database `chama` (dev) or `chama_test` (tests), user/password
  `chama`/`chama`. `docker compose logs postgres`.
- **Keycloak admin console**: `http://localhost:8180`, `admin`/`admin`. Realm `chama`. If OIDC
  calls are failing locally, check the realm actually imported: `docker compose logs keycloak`.
- **Seed users**: see the README's Getting Started section.
- **A test looks like it's hanging on auth or Keycloak**: check that the `postgres` and `keycloak`
  containers are actually up and healthy (`docker compose ps`) before running tests; several
  `@QuarkusTest` classes talk to a real Keycloak instance rather than mocking it, on purpose (they
  provision real users, and provoke real bad-login events), so a missing container looks like a
  hang or a timeout, not a clear "connection refused."
- **A test wiped out data you were looking at locally**: check `%test.quarkus.datasource.jdbc.url`
  in your `application.properties` actually points at `chama_test`, not `chama`. See the README's
  Testing and coverage section for how that separation is supposed to work.

## Contribution guidelines

No direct commits to `main`. One feature branch per unit of work, pushed, landed through a pull
request that links the relevant issue(s) it closes. Conventional Commits
(`feat(scope): summary`, `fix(scope): summary`, `test(scope): summary`, `docs: summary`,
`chore: summary`). Both backend and frontend are gated in CI at 90 percent test coverage; tests
ship alongside the code that needs them, not backfilled afterward.

## Audience-specific notes

**New to the codebase.** Start with `ContributionService`/`ContributionResource` and their tests,
on both backend and frontend (`ContributionsPage.tsx`): it's the simplest end-to-end slice
(create, pay, record) and touches every layer without the extra complexity of the payment
provider integrations or the loan/payout state machines.

**Coming in to make an architectural change.** Read `TenantAccessService` and
`KeycloakSecurityEventSyncService`'s doc comments first; they're the two most load-bearing,
least-obvious decisions in the backend (see [Architecture](#architecture) above), and most new
chama-scoped or security-adjacent work needs to fit within what they already establish.

**Scoped/contractor work.** Stay within one `service`/`rest` pair and its corresponding frontend
page; the `api/` client wrappers on the frontend are the integration boundary, and the DTO records
in `dto/` are the boundary on the backend. You shouldn't need to touch `security/` or
`repository/` classes outside your own feature area.
