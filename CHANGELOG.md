# Changelog

All notable changes to this project will be documented in this file.

## [unreleased] - 2026-08-07

### Added
- a penalties page, making the existing issue, approve, waive and settle workflow reachable
- loan disbursement from the loans page, making the M-Pesa B2C payout path reachable
- dark mode, selectable per user and following the operating system by default
- a semantic colour token layer, so a theme is defined in one place rather than written into
  each component
- automatically flip a chama to inactive after a period of no contributions
- let a chairperson edit the savings goal and welfare fund target from the chama dashboard
- docker-compose.e2e.yml, a full-stack environment (Postgres, Keycloak, backend, nginx-served
  SPA, payment provider stub) for the end-to-end suite, on its own port block so it runs
  alongside the dev stack
- chama_e2e database, created by postgres-init/02-create-e2e-db.sql on first volume init
- an end-to-end suite driving the deployed stack through a browser, including a real Keycloak
  login, tenant isolation checks, and the M-Pesa contribution path end to end

### Fixed
- frontend: stream server-sent events through nginx unbuffered, so the live activity feed
  works in a deployed environment instead of silently falling back to polling
- db: generate a join_code for each chama in the dev demo seed
- frontend: surface errors when the loan repayment schedule fails to load

### Schema

Flyway version numbers reserved for work in progress, so that branches developed in parallel do
not collide on a version:

| Version | Reserved for |
|---|---|
| V41 | notification and notification_preference tables |
| V42 | chama_reminder_settings and reminder_dispatch tables |
| V43 | WELFARE_WITHDRAWAL approval target type |
| V44 | welfare_withdrawal status, requested_by, requested_at |
| V45 | REMINDER_SENT and MEMBERS_IMPORTED activity event types |
| V46 | analytics aggregation indexes |
| V47 | loan_repayment.paid_at |

V28 has never existed and is a permanent hole in the sequence. Flyway does not care, but it is
worth knowing before someone tries to fill it.
