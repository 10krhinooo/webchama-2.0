# Changelog

All notable changes to this project will be documented in this file.

## [unreleased] - 2026-08-07

### Added
- automatic contribution reminders: a nudge some days before the due date, one on the day, and a
  repeating one while a contribution stays outstanding, in the app and by email. Off until a
  chairperson turns them on, and configurable per chama
- chama analytics on the dashboard: a health score with the components behind it, contributions
  billed against contributions collected month by month, and unpaid balances aged into buckets
- bulk member import from a CSV file, with a preview that reports every problem in the file before
  anything is created
- a My Money page: a member's own contributions, loans, payouts, penalties, welfare contributions
  and credit score gathered into one mobile-first summary instead of five pages to visit and add up
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
- end-to-end coverage of member administration, the penalty lifecycle, and a loan from request
  to money leaving the chama, including dual sign-off on an amount above the approval threshold
- a cross-browser smoke suite in Chrome and Firefox, run with `mvn -Psmoke verify` against the
  same stack, covering the branded Keycloak login page, single-sign-on session survival, chama
  creation, and the CSV export

### Changed
- quarkus-groovy-junit5 moved to test scope. It was shipping a test framework into the production
  image, with no Groovy sources anywhere in the tree
- armed the Qodana severity thresholds, which were fully commented out, so the quality gate can
  actually fail a build
- removed the unused PasswordRules component and the @radix-ui/react-slot dependency
- the staff pages now share the Card, StatTile and EmptyState primitives instead of writing the
  same surface, the same figure and the same empty row out by hand on each page, so elevation,
  spacing and type no longer drift between them
- an empty table now says what would fill it, rather than only that it is empty
- replaced the platform overview's two-slice pie charts with proportion bars. A pie of "active and
  inactive" is a featureless disc whenever everything is active, which is the ordinary case, and
  disappears entirely when the total is zero
- welfare fund withdrawals above the chama's approval threshold now require the same maker-checker
  dual sign-off as loan disbursements and payouts, and move no money until it clears
- rebuilt the member credit score: it measures amounts rather than counting statuses, weights
  recent behaviour more heavily than old, smooths thin records toward a neutral middle, drops a
  component the chama records nothing for instead of scoring it as a pass, deducts for penalties
  that stood, caps the score on a defaulted loan, and reports a member with no history as having
  no score rather than a perfect one
- the loans table reads every credit score in one request instead of one request per member

### Fixed
- a failed list request rendered as a confident empty state. A page that could not reach the server
  said "you are not part of any chama yet" and invited the reader to create one
- every modal in the app was positioned off centre, because the open and close animations set the
  transform the centring relied on. On a desktop screen it read as slightly off; on a phone the
  dialog hung off the right edge with its fields cut in half
- the two-column groups in the chama, loan and dashboard forms did not collapse on a narrow screen
- the mark above the Keycloak sign-in form was not a link, and the one link back to the site sat in
  a panel that is hidden below 1024px, so there was no way back from a phone
- the forgot-password page fell through to Keycloak's stock markup, whose grid escaped the card
  padding on a narrow screen and put the instructions after the submit button
- the welfare fund page raced two requests into the same state for a manager, so a slow response
  could reduce the page to one member's history
- the token refresh left an unhandled rejection every twenty seconds once a session expired
- credit scoring compared due dates in UTC rather than Africa/Nairobi, so contributions due today
  read as overdue for the first three hours of a Nairobi morning
- frontend: the dashboard contribution chart used hard-coded colours and stayed light in dark mode
- email sending shared one bounded thread pool instead of eleven unbounded ones, so a bulk action
  queues its messages rather than opening a connection per recipient at once
- deleting a chama that had recorded any activity failed on a foreign key, because activity_log
  was missing from the ordered cleanup
- frontend: stream server-sent events through nginx unbuffered, so the live activity feed
  works in a deployed environment instead of silently falling back to polling
- db: generate a join_code for each chama in the dev demo seed
- frontend: surface errors when the loan repayment schedule fails to load
- the reason an action was refused now reaches the person who tried it. Every deliberate refusal
  the backend writes, such as why a member with history cannot be deleted or why the person who
  requested an approval cannot also sign it, was answered with an empty body and shown as
  "Request failed with status code 400"
- frontend: a confirm dialog stayed open when the action behind it was refused, hiding the
  explanation behind its own overlay, so the button read as having done nothing
- frontend: the "Your phone" and "Phone" form labels pointed at no element, so clicking a label
  did not focus its field and a screen reader announced the input unlabelled
- frontend: text on the surfaces that stay dark in both themes, the staff sidebar, the public
  footer and the marketing call to action, was drawn with a surface token that inverts, so it
  turned dark on dark the moment dark mode was on. The sidebar navigation was close to unreadable
- frontend: the savings pot on the dashboard drew its empty portion and its outline from hex
  literals, so in dark mode it was a cream block with an invisible rim
- frontend: chart tooltips kept a white background and near-black text in dark mode, and chart
  legends listed every series against a black swatch

### Schema

Flyway version numbers reserved for work in progress, so that branches developed in parallel do
not collide on a version:

| Version | Reserved for |
|---|---|
| V41 | notification and notification_preference tables (applied) |
| V42 | chama_reminder_settings and reminder_dispatch tables (applied) |
| V43 | WELFARE_WITHDRAWAL approval target type (applied) |
| V44 | welfare_withdrawal status, requested_by, requested_at (applied) |
| V45 | MEMBERS_IMPORTED activity event type (applied) |
| V46 | analytics aggregation indexes (applied) |
| V47 | loan_repayment.paid_at (applied) |

V28 has never existed and is a permanent hole in the sequence. Flyway does not care, but it is
worth knowing before someone tries to fill it.
