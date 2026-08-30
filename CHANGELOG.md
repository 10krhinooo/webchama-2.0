# Changelog

All notable changes to this project will be documented in this file.

## [unreleased] - 2026-08-07

### Added
- automatic contribution reminders: a nudge some days before the due date, one on the day, and a
  repeating one while a contribution stays outstanding, in the app and by email. Off until a
  chairperson turns them on, and configurable per chama
- chama analytics on the dashboard: a health score with the components behind it, contributions
  billed against contributions collected month by month, and unpaid balances aged into buckets
- an in-app notification centre, with a bell, a live stream, and per-event-type preferences
  covering both the inbox and email
- a penalties page, making the existing issue, approve, waive and settle workflow reachable
- loan disbursement from the loans page, making the M-Pesa B2C payout path reachable
- a meetings page with minutes and an attendance register, which also unblocks opening a
  resolution, since a resolution is raised against a meeting
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

### Changed
- welfare fund withdrawals above the chama's approval threshold now require the same maker-checker
  dual sign-off as loan disbursements and payouts, and move no money until it clears
- rebuilt the member credit score: it measures amounts rather than counting statuses, weights
  recent behaviour more heavily than old, smooths thin records toward a neutral middle, drops a
  component the chama records nothing for instead of scoring it as a pass, deducts for penalties
  that stood, caps the score on a defaulted loan, and reports a member with no history as having
  no score rather than a perfect one
- the loans table reads every credit score in one request instead of one request per member

### Fixed
- credit scoring compared due dates in UTC rather than Africa/Nairobi, so contributions due today
  read as overdue for the first three hours of a Nairobi morning
- frontend: the dashboard contribution chart used hard-coded colours and stayed light in dark mode
- deleting a chama that had recorded any activity failed on a foreign key, because activity_log
  was missing from the ordered cleanup
- frontend: stream server-sent events through nginx unbuffered, so the live activity feed
  works in a deployed environment instead of silently falling back to polling
- db: generate a join_code for each chama in the dev demo seed
- frontend: surface errors when the loan repayment schedule fails to load

### Schema

Flyway version numbers reserved for work in progress, so that branches developed in parallel do
not collide on a version:

| Version | Reserved for |
|---|---|
| V41 | notification and notification_preference tables (applied) |
| V42 | chama_reminder_settings and reminder_dispatch tables (applied) |
| V43 | WELFARE_WITHDRAWAL approval target type (applied) |
| V44 | welfare_withdrawal status, requested_by, requested_at (applied) |
| V45 | MEMBERS_IMPORTED activity event type (reminders needed no event, see reminder_dispatch) |
| V46 | analytics aggregation indexes (applied) |
| V47 | loan_repayment.paid_at (applied) |

V28 has never existed and is a permanent hole in the sequence. Flyway does not care, but it is
worth knowing before someone tries to fill it.
