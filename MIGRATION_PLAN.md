# Web-Chama → Quarkus/React/PostgreSQL/Keycloak Migration Plan

Status: decisions confirmed — ready to scope into tickets
Owner: Victor (vkimanga@gmail.com)
Companion reference implementation: `dondooHomes` (Quarkus 3.35.2 + React 19 + PostgreSQL 16 + Keycloak 24) — this plan reuses its architecture, security patterns, and design system wherever it fits a chama (savings group / table-banking) domain.

## Decisions (confirmed 2026-07-22)

| Decision | Answer | Impact |
|---|---|---|
| Tenancy model | **Multi-tenant SaaS** — one instance hosts many chamas; a member may belong to more than one | `SUPER_ADMIN` platform role is in scope; tenant isolation is the #1 security requirement, not optional (§7); `member_role` many-to-many is required, not deferrable (§4) |
| Brand palette | **Distinct but consistent** with DondooHomes | Own hex palette, same design-system architecture (fonts, tokens, motifs, component conventions) (§3) |
| Existing data | **Transfer real data + seed additional dummy data** | Data-export/clean/import step is required (§10), plus a dummy-data seed migration for demo/QA — same pattern as DondooHomes' V21/V26 sample-data migrations |
| Loan disbursement | **M-Pesa B2C automated payout** | New integration beyond what DondooHomes has already proven (it only has STK push + Flutterwave, no B2C) — needs its own security review (§7) |
| V1 standout features (Phase 7) | **Maker-checker approval + WhatsApp bot + credit score + auto-STK-push** (bundles 1 & 2 combined) | Larger Phase 7 than originally proposed — USSD, Swahili UI, voting, and welfare-fund tracking pushed to Phase 8 (§9, §11) |

---

## 1. Why this migration

The current app (`web-chama`) is Laravel 11 + Filament 3.2 + Vue/Bootstrap, and per its own `CLAUDE.md` is closer to a prototype than a working product:

- Both Filament panels (`admin`, `treasurer`) are **not registered** in `bootstrap/providers.php` — they likely don't boot at all.
- `/dashboard` and `/profile/*` routes point at controllers/methods that don't exist.
- The `chamas` migration calls Filament form-builder methods (`->required()`, `->searchable()`) directly on a schema `Blueprint` column — will throw on `migrate`.
- Model relationships are backwards or missing: `Chama belongsTo Contributions` (should be the other way round), no FK between `chamas`/`members`/`contributions`, `Members` model has no relations at all.
- Auth is a bespoke `id_number` + password flow with a hand-rolled password-reset table, sitting next to a dead second auth implementation (`UserController`).
- A debug-only route (`GET /test-insert-token`) inserts a token with no auth guard.
- No real test coverage, no payments, no loan/payout logic, no notifications.

Rather than patch this in place, we're rebuilding on the stack you already run in production for DondooHomes — same backend framework, same auth provider, same payment rails, same design language — so the two apps share infra knowledge, ops tooling, and a consistent brand.

## 2. Target stack

| Layer | Choice | Rationale |
|---|---|---|
| Backend | Quarkus 3.35.2, Java 21, Maven | Matches DondooHomes; you already know the dev loop, Panache pattern, RBAC via `@RolesAllowed`. |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS 3 | Matches DondooHomes; component/hook conventions transfer directly. |
| Database | PostgreSQL 16, Flyway migrations | Matches DondooHomes; native PG enums, Flyway version history as the audit trail of schema evolution. |
| Auth | Keycloak 24 OIDC, dedicated realm `chama` | Matches DondooHomes; role-based access, Keycloak Admin API for user provisioning/password reset. |
| Payments | M-Pesa Daraja STK Push + Flutterwave card payments | Same providers as DondooHomes — reuse `MpesaService`/`FlutterwaveService` patterns and their hardening (see §7). |
| Notifications | Email (Quarkus Mailer) + SMS (Celcom Africa) + optional WhatsApp | Matches DondooHomes' `TenantNotificationService` pattern. |
| Deployment | Docker Compose locally; Fly.io for Keycloak, DO App Platform (or similar) for the app — mirrors DondooHomes' `Dockerfile` + `keycloak/Dockerfile.fly` | Reuse existing ops playbook rather than inventing a new one. |

## 3. Design theme parity with DondooHomes

You asked for the Keycloak (and general UI) design to match DondooHomes. Concretely, that means adopting the **same design system architecture**, not necessarily the identical color values (a chama app and a homestay-booking app are different brands, but the visual *language* should feel like the same family of products):

- **Same 3-font role system**: Inter (body/UI/forms/tables), a display face for headlines/KPI numerals (DondooHomes uses Bricolage Grotesque — reuse it unless you want a distinct chama identity face), IBM Plex Mono for currency amounts, receipt/reference numbers, phone numbers, timestamps. Chama is a money app, so the mono-for-currency convention matters as much here as it does for rent.
- **Same token-based Tailwind config** (`primary`, `primary-dark`, `primary-light`, `secondary`, `danger`, `success`, `warning`, `muted`, `ink`, two background tones, two dark-surface tones) — never raw `bg-blue-*`/`bg-green-*` in components. **Confirmed: a new, distinct palette for the chama brand** (not DondooHomes' exact hex values) — keep `danger`/`success`/`warning` hue-distinct from `primary` the same way DondooHomes does, so status colors never get confused with brand color. Suggest a palette direction rooted in the merry-go-round/community-trust theme (e.g. a confident green or indigo primary, distinct from DondooHomes' ocean blue) — pick during UI kickoff, not blocking backend work.
- **A signature motif**, chama's answer to DondooHomes' "Tideline" — e.g. a rotating-circle or interlocking-ring motif evoking the merry-go-round/round-robin payout structure central to chama savings. Used sparingly (hero divider, footer edge, active-nav marker), not as decoration everywhere.
- **Same interaction conventions**: `TransientAlert` toasts (5s auto-dismiss), `Modal` with focus trap + Escape-to-close, `LoadingButton` instead of manual `{saving ? ... : ...}`, `Skeleton`/`SkeletonLayouts` instead of spinners for list/table/dashboard/detail pages, `Pagination` component, `PasswordRules` live checklist, `PhoneInput` defaulting to `ke`.
- **Same M-Pesa confirmation-gate pattern**: any STK-push-triggering button opens a confirmation modal (phone + amount visible) before the API call fires — critical for a chama app where members are triggering contribution/loan-repayment charges themselves.
- **Keycloak login theme**: create `keycloak/themes/chama/login/` mirroring DondooHomes' `keycloak/themes/dondoo/login/` structure exactly — `theme.properties` (`parent=keycloak`), `login.ftl`, `login-update-password.ftl`, `login-update-profile.ftl`, `error.ftl`, `resources/logo.png`. Same split-screen/carousel layout as `AuthLayout.tsx`/`LoginPage.tsx`, restyled with the chama palette. Note: in DondooHomes the Keycloak theme and `printInvoice.ts` still only use Inter (the 3-font system hasn't reached them yet) — this migration is a chance to do it correctly from day one in `chama`'s theme rather than carrying that gap forward.

## 4. Domain model review — what a real chama platform needs

A "chama" (Kenyan savings/investment group, often run as table banking or merry-go-round) has recurring needs the current prototype doesn't touch at all. Proposed entities (Flyway `V1...` onward, mirroring DondooHomes' one-migration-per-concern history):

**Core**
- `chama` — name, description, type (`MERRY_GO_ROUND` / `TABLE_BANKING` / `INVESTMENT_GROUP`), currency, contribution frequency (weekly/monthly), contribution amount, meeting day, status.
- `member` — links to a Keycloak user, chama membership, role within the chama (chairperson/treasurer/secretary/member), join date, status (active/suspended/exited), national ID, phone (M-Pesa number), next-of-kin.
- `member_role` — many-to-many join table linking one Keycloak user to roles in more than one chama — **required for v1**, not deferrable, since the confirmed multi-tenant SaaS model means a member can belong to several chamas simultaneously (e.g. chairperson in one, plain member in another).
- `loan_disbursement` — loan, B2C conversation ID/originator conversation ID, target phone, amount, result code/description, disbursed-at — the record backing the confirmed M-Pesa B2C payout flow (see §6).

**Money**
- `contribution` — member, chama, period, amount due, amount paid, payment method, status (pending/paid/partial/overdue), paid-at.
- `payment` — polymorphic ledger row backing `contribution`/`loan_repayment`/`penalty`, with provider reference (M-Pesa `CheckoutRequestID` / Flutterwave `tx_ref`), idempotent on provider transaction ID — same shape as DondooHomes' `Payment`/`TenantPayment`.
- `loan` — member, chama, principal, interest rate/method, term, status (requested/approved/disbursed/repaying/closed/defaulted), approved-by, approved-at.
- `loan_repayment` — loan, scheduled date, amount due, amount paid, status.
- `penalty` / `fine` — member, chama, reason (late contribution, missed meeting, loan default), amount, status.
- `payout` — chama, member, round/cycle number, scheduled date, amount, status — the actual merry-go-round rotation ledger (currently entirely absent from the prototype).
- `payout_schedule` — chama, generated rotation order for a cycle (random/seniority/agreed order), current position.

**Governance**
- `meeting` — chama, date, agenda, minutes (rich text or file), attendance list.
- `meeting_attendance` — meeting, member, present/absent/excused.
- `document` — generated PDF statements/receipts (contribution receipt, loan statement, payout receipt) — mirrors DondooHomes' `GeneratedDocument` + `DocumentDeliveryAttempt` pattern (per-channel delivery ledger, email/WhatsApp).
- `activity_log` — same SSE-backed audit trail pattern as DondooHomes (`ActivityLogService` + CDI event + admin dashboard feed).

**Platform**
- `system_error` — same failure-log pattern as DondooHomes (`SystemError`, severity levels, resolved/resolvedAt) — needed from v1 given the confirmed multi-tenant SaaS model, to give `SUPER_ADMIN` a cross-chama oversight/health view.

This is a genuinely different (and much larger) domain than the current 4-table prototype — the migration is as much a product build-out as a framework port.

## 5. Roles & Keycloak realm design

Proposed realm `chama`, roles:

- `SUPER_ADMIN` — platform owner; confirmed in scope for v1 given the multi-tenant SaaS decision — cross-chama oversight (`SystemPerformanceResource`/`SystemErrorResource`/`SystemUserResource`-equivalent views, mirroring DondooHomes' SYSTEM_ADMIN portal), no operational access to any single chama's financial data by default.
- `CHAIRPERSON` — chama-level admin: manage members, approve loans, view all financials for their chama.
- `TREASURER` — record contributions/payments, manage loan disbursement/repayment, generate financial statements (maps to the old Filament "treasurer panel" concept, done properly this time).
- `SECRETARY` — manage meetings, minutes, attendance, member communications.
- `MEMBER` — self-service: view own contributions/loans/payout position, pay via M-Pesa/card, view group statements.

Each chama is a tenant boundary — a `MEMBER` in chama A must not see chama B's data even if hosted on the same instance. Mirrors DondooHomes' `CurrentUserProducer` pattern (resolve the app-side user/role from the JWT `sub`), extended with a chama-scoping check on every resource method (equivalent to DondooHomes' SUBTENANT-can-only-touch-their-own-room pattern, generalized to "member can only touch their own chama").

Password reset: reuse DondooHomes' pattern exactly — custom `password_reset_token` table + token link + Keycloak Admin API call to actually update the password, rather than relying on Keycloak's own reset-password email flow (keeps branded emails and receipts consistent).

## 6. Payments — M-Pesa STK Push + B2C + Flutterwave

STK Push and Flutterwave are already running in DondooHomes (`MpesaService`, `FlutterwaveService`, `MpesaConfig`/`FlutterwaveConfig` via `@ConfigMapping`) — port the same integration, retargeted at chama use-cases. **M-Pesa B2C (confirmed for loan disbursement) is net-new** — DondooHomes has no B2C integration to port, so this is genuine new build, not a port.

- **STK Push triggers**: pay a contribution, repay a loan installment, pay a penalty. Same confirmation-modal gate as DondooHomes before the push fires.
- **M-Pesa B2C payout (new)**: `LoanDisbursementService` calls Daraja's `B2C/paymentrequest` API when a loan is approved, using a dedicated B2C shortcode/initiator (separate credentials from the STK-push shortcode). Records a `loan_disbursement` row immediately with a PENDING status, updates it from Daraja's async result callback (`ResultURL`) — never assume disbursement succeeded just because the initial API call returned 200; that response only confirms the request was *accepted*, not that money moved. Reconcile stuck PENDING disbursements via Daraja's `TransactionStatusQuery` API on a scheduled job, the same defensive pattern DondooHomes uses for STK push status.
- **M-Pesa C2B till reconciliation** (optional but valuable): if the chama has a till number members pay into directly (not just STK push), port `MpesaC2bService`'s auto-reconciliation-by-phone-and-amount pattern, with an admin screen for unmatched transactions — directly analogous to DondooHomes' `MpesaC2bPage`.
- **Flutterwave card payments**: for members without M-Pesa or paying from outside Kenya, and explicitly marketed as the diaspora-contribution channel (§9). Reuse the security-hardened callback (see §7).
- **Idempotency**: every payment keyed by provider transaction reference, matching DondooHomes' `findByMpesaCheckoutId`/`findByTransId` pattern — a webhook retry must never double-credit a contribution or loan repayment, and a duplicate B2C result callback must never double-mark a disbursement complete.
- **Rate limiting**: reuse `RateLimitFilter`'s per-IP fixed-window approach on the contribution/loan-repayment/card-payment endpoints and both webhook paths.

## 7. Security review

### Carried over from DondooHomes (apply from day one, not retrofitted later)

- **Webhook signature verification fails closed**: if `flutterwave.secret-hash` (or M-Pesa's equivalent shared secret, if used) isn't configured, reject with 401 — don't silently accept unverified webhooks.
- **Constant-time hash comparison** (`MessageDigest.isEqual`) for webhook signatures — avoid timing attacks.
- **Never trust client/webhook-supplied amount or status** — always re-resolve the expected amount server-side from the `payment`/`contribution` record and re-verify server-to-server via the provider's verify-by-id API before marking anything paid. This is the exact gap DondooHomes closed for Flutterwave (a client could otherwise pay an arbitrary amount and have it accepted) — a chama app handling members' savings has zero tolerance for this class of bug.
- **Sanitize error responses to end users**: technical/provider error detail (raw Daraja/Flutterwave error bodies) should reach admin/treasurer views for debugging but never a member's browser — same pattern as DondooHomes' `SubTenantPortalResource.payBill()` scrubbing `technicalMessage`.
- **Structured API errors**: one `ApiErrorResponse` shape (errorCode/userMessage/technicalMessage/retryable) via exception mappers, so the frontend never parses ad-hoc error bodies.
- **Rate limiting on money-moving and public endpoints.**
- **Optimistic locking** (`@Version`) on any entity with a "claim once" semantic — e.g. a payout being marked disbursed, a loan being approved — to close double-submit races the same way DondooHomes closed the QR-scan double-checkin race.

### New for this domain (chama-specific risks the DondooHomes model doesn't have)

- **Tenant isolation is the #1 risk**: every resource method must scope queries by the caller's chama membership, not just by role. A `TREASURER` of chama A must get a 403/404 (not chama B's data) if they guess chama B's ID in a URL. Write this as an explicit authorization check in each resource/service method (or a shared interceptor), and cover it with tests — this is exactly the class of bug that's easy to miss when porting single-tenant DondooHomes patterns into a multi-tenant domain.
- **Financial approval workflow integrity**: loan approval, payout disbursement, and penalty waivers should require the appropriate role (`CHAIRPERSON`/`TREASURER`) and be logged to `activity_log` with who/when — chama disputes are usually "who approved this loan," so the audit trail is a product requirement, not just nice-to-have.
- **PII handling**: national ID numbers and phone numbers are sensitive; at minimum, restrict which roles can view raw ID numbers (mask for `MEMBER` viewing other members' profiles), and don't log them in plaintext in `activity_log`/`system_error` context fields.
- **Reconciliation reports must be tamper-evident**: financial statements generated for a chama (contribution history, loan ledger) should be derived from the payment ledger at generation time, not editable after the fact — same "generate once, PDF is the record" pattern as DondooHomes' `GeneratedDocument`.
- **Migration data integrity (confirmed: real data will be transferred)**: the existing Laravel data must be validated and cleaned before import, not dumped straight in — it doesn't have real FKs between `chamas`/`members`/`contributions` (§1), so a straight copy would carry that inconsistency into a schema that now enforces FKs. Concretely: (1) export the current tables, (2) reconstruct the missing relationships by matching on whatever implicit link exists (e.g. name/phone matching between `members` and `contributions` if `members_id` values don't actually correspond), (3) manually review anything that can't be reconstructed with confidence rather than guessing, (4) import via a Flyway migration, then (5) run a separate dummy-data seed migration on top for demo/QA accounts — keep the two migrations distinct so real data is never accidentally wiped by re-running a seed script.
- **Remove debug cruft before go-live**: the Laravel prototype has an unauthenticated `/test-insert-token` route — make sure nothing equivalent survives into the Quarkus rewrite (audit all `@PermitAll` endpoints explicitly before launch, the same discipline DondooHomes applies to its public booking/payment paths).

### M-Pesa B2C-specific security (new — DondooHomes has no B2C integration to model this on)

- **Separate credentials from STK push**: B2C uses its own initiator name + security credential (the initiator password encrypted with Safaricom's public certificate), distinct from the STK-push shortcode credentials. Store both as secrets (see env/secrets hygiene below), never hardcoded.
- **Validate the `ResultURL`/`QueueTimeOutURL` callback payload against a known-pending `loan_disbursement` row** by `ConversationID`/`OriginatorConversationID` before updating status — an unsolicited or replayed callback must not be able to mark an arbitrary disbursement complete.
- **Restrict who can trigger a disbursement**: only `TREASURER`/`CHAIRPERSON` (and only after the maker-checker approval from §9 clears, once that's built) can call the disbursement endpoint — this is real money leaving the chama's control, the single highest-value target for both external attackers and internal fraud.
- **Reconcile, don't just trust, async results**: schedule a `TransactionStatusQuery` sweep for any `loan_disbursement` still PENDING after a timeout window, so a lost/delayed callback doesn't leave a loan silently stuck.

### Recommended one-time gate before production

Run `/code-review ultra` (or the `security-pen-testing`/`senior-secops` skill) against the finished branch before go-live, specifically targeting: tenant-isolation bypass (now the top risk given the confirmed multi-tenant SaaS model), webhook/callback forgery (including the new B2C `ResultURL`), and loan/payout/disbursement approval authorization — these are the failure modes most specific to a multi-tenant group-savings product that moves real money automatically.

## 8. Feature set — full list to build

**Bug-fix-equivalent (things the prototype claimed to do but doesn't work)**
- Working admin panel (chama/member/contribution CRUD) and treasurer panel, correctly scoped by role.
- Working `/dashboard`, `/profile` (view/edit/photo/delete-account).
- Correct model relationships (chama ↔ members ↔ contributions, all FK-backed).

**New — table banking / merry-go-round core**
- Contribution tracking with due dates, partial payments, overdue flagging, and automated reminders (SMS/email/WhatsApp) — reuse DondooHomes' `TenantNotificationService` multi-channel pattern.
- Loan module: request → chairperson/treasurer approval → **M-Pesa B2C automated disbursement** (confirmed — see §6, §7) → repayment schedule → tracking, with configurable interest.
- Payout rotation ("merry-go-round") scheduler: define rotation order, track whose turn it is, mark disbursed, handle skip/reorder when a member exits.
- Penalty/fines engine: configurable rules (late contribution, missed meeting) with an approval/waiver flow.
- Meetings: agenda, minutes, attendance tracking.
- Financial statements/receipts: PDF generation + email/WhatsApp delivery, mirroring DondooHomes' `DocumentGeneratorPage` wizard and `UniversalPdfDocumentService`.
- Dashboards: chama-level KPIs (total contributions, outstanding loans, upcoming payouts) for chairperson/treasurer; personal KPIs (my contributions, my loan balance, my payout position) for members — recharts, matching DondooHomes' visualization conventions.
- Activity log / audit trail (who approved what, when).
- Multi-chama support — **confirmed in scope**: a member can belong to several groups via `member_role` (§4), consistent with the confirmed multi-tenant SaaS model (§5).

**Payments**
- M-Pesa STK Push for contributions, loan repayments, penalties.
- Flutterwave card payments as an alternative rail.
- Optional M-Pesa C2B till reconciliation.

**Notifications**
- Email (Quarkus Mailer) for statements/receipts/credentials.
- SMS (Celcom Africa) for contribution reminders/payout notices — the channel most chama members will actually see promptly.
- WhatsApp as a fallback channel, matching DondooHomes' pattern.

## 9. Standout features — what would set this apart

Everything in §8 makes web-chama *functional*. This section is what would make it *notable* — features that go beyond "digitize the record book" and address things chama members and treasurers actually struggle with, most of them cheap to add because they ride on infrastructure this stack already has (Keycloak, Flutterwave's international reach, the WhatsApp Business API DondooHomes already integrates).

**Trust & governance (the biggest gap in every chama app on the market)**
- **Maker-checker dual approval**: any loan disbursement or payout above a configurable threshold requires sign-off from two distinct signatories (e.g. chairperson *and* treasurer), not one person's click. This is standard fintech practice and directly addresses the #1 reason chamas fail — a single trusted person absconding with funds. Cheap to build (an `approval` join table + a status gate before disbursement fires) and a genuine differentiator versus spreadsheet- or WhatsApp-run groups.
- **In-app voting/resolutions**: digitize the show-of-hands that currently happens verbally in meetings — e.g. "approve James's loan," "expel member X," "change contribution amount." Members vote from their phone, the result and vote tally become part of the permanent record tied to the relevant `meeting`. Turns a common source of he-said-she-said disputes into an auditable decision log.
- **Immutable audit trail members can see**: extend the `activity_log` pattern so members themselves (not just admins) can view a read-only feed of "who approved/changed what" for their own chama — transparency is the actual product members are buying, more than the bookkeeping.

**Reach & accessibility (most chama apps assume a smartphone and good data — many members don't have either)**
- **WhatsApp-native self-service**: since DondooHomes already integrates the Meta WhatsApp Business API, extend it here into a two-way bot — members check their contribution/loan balance, see when their payout turn is, and receive statements, all inside WhatsApp, no app install or login required. For a chama's actual membership (often older, less smartphone-fluent than a typical SaaS user), this is likely to drive far higher engagement than the web/React UI alone.
- **USSD fallback**: a basic USSD menu (`*XXX#`) for members on feature phones to check balance/next payout — genuinely rare in this space and directly relevant to the Kenyan market this is built for.
- **Swahili + English UI**: full bilingual support, not just English — most competing chama tools are English-only despite the user base.

**Financial intelligence (turns the app from a ledger into an advisor)**
- **Member credit score**: an internal score derived from contribution consistency, meeting attendance, and repayment history, surfaced to the chairperson/treasurer when a loan request comes in — replaces "gut feel" lending decisions with a data-backed signal, and gives members a visible incentive to stay current.
- **Cash-flow forecasting**: project the chama's balance forward a few months using the known contribution schedule and outstanding loan repayments, so the treasurer can see "can we afford to disburse this loan without leaving the group short before the next payout" before approving, not after.
- **One-click AGM/auditor export**: chamas periodically need a clean financial statement to apply for a SACCO/bank credit line or present at an annual general meeting. A single "Generate Annual Report" action producing a bank-ready PDF (contributions, loans, payouts, penalties, opening/closing balance) is a small build on top of the existing `GeneratedDocument` pattern but solves a recurring, real pain point.
- **Welfare/emergency fund tracking**: many chamas run a second, separate pot for emergencies (death, hospitalization) alongside the main savings fund. Modeling this as a distinct fund type (rather than conflating it with regular contributions) is something most chama software gets wrong.

**Reducing missed contributions (the #1 operational headache)**
- **Scheduled auto-STK-push**: with explicit member opt-in, automatically fire an M-Pesa STK push on the member's contribution due date instead of waiting for them to remember — closest thing to a standing order Daraja's push API allows, and should measurably cut the late/missed-contribution rate that every chama treasurer complains about.
- **Engagement streaks**: a simple "on-time contribution streak" shown to each member — small gamification touch, cheap to build, genuinely improves payment discipline in practice.

**Diaspora reach**
- Flutterwave already supports international card payments — lean into this explicitly as a feature ("contribute from abroad") rather than a side effect, since diaspora members are common in Kenyan chamas and are usually the hardest to keep current on contributions from a distance.

**Prioritization (confirmed for Phase 7)**: maker-checker dual approval, the WhatsApp self-service bot, member credit scoring, and scheduled auto-STK-push are all in for Phase 7 — the two highest-payoff bundles combined, per your call. This is a bigger Phase 7 than originally proposed; consider splitting it into two sequential sub-phases internally (7a: maker-checker + WhatsApp bot, since B2C disbursement from §6 needs maker-checker gating anyway; 7b: credit score + auto-STK-push) rather than building all four in parallel. USSD, Swahili UI, in-app voting, welfare-fund tracking, and the one-click AGM export move to Phase 8 as later differentiators once the core and Phase 7 are solid.

## 10. Migration strategy

1. **Stand up the new stack in parallel** (new repo or new branch — recommend a fresh Quarkus project scaffolded the same way `dondooHomes` was, not an in-place conversion of the Laravel repo).
2. **Build the domain model + auth + payments first** (§4–§7) before porting any UI — this is where the real product value is; the current UI is not worth preserving as-is.
3. **Data migration (confirmed: real data exists and will be transferred)**: write a one-off script to export existing Laravel/SQLite `chamas`/`members`/`contributions` rows, clean up the relationship gaps noted in §1 (see the data-integrity bullet in §7 for the reconstruction approach), and import into the new Postgres schema via a dedicated Flyway migration. Follow it with a **separate** dummy-data seed migration (more sample chamas/members/contributions/loans for demo and QA) — same convention as DondooHomes' V21/V26 "sample data" migrations, but kept as its own migration file so real transferred data is never at risk from re-running or editing the seed script.
4. **Cutover**: once the new stack has passed a full feature/security pass, point DNS/users at it and decommission the Laravel app. Keep the old DB as a cold backup for a defined retention window rather than deleting it immediately.
5. **Rollback plan**: keep the Laravel app deployable (don't delete infra) until at least one full contribution/payout cycle has run clean on the new stack.

## 11. Milestones (confirmed)

| Phase | Scope | Depends on |
|---|---|---|
| 1 | Quarkus/React/Postgres/Keycloak scaffold + realm + role model, incl. `SUPER_ADMIN` (multi-tenant SaaS confirmed) | — |
| 2 | Core domain (chama, member, contribution) + `member_role` many-to-many + tenant-scoped auth — tenant isolation is the top security bar for this phase (§7) | Phase 1 |
| 3 | M-Pesa STK Push + Flutterwave, with security hardening from §7 | Phase 2 |
| 4 | Loans, payouts, penalties, meetings | Phase 2 |
| 5 | M-Pesa B2C loan disbursement (new build, §6/§7) — gated behind maker-checker approval from Phase 7a, so sequence Phase 7a before enabling live disbursement | Phase 4, Phase 7a |
| 6 | Notifications (email/SMS/WhatsApp), PDF statements/receipts | Phase 3–4 |
| 7 | Dashboards + activity log + admin/treasurer/chairperson UI polish, Keycloak theme (§3) | Phase 2–6 |
| 7a | Standout, confirmed tier 1: maker-checker dual approval, WhatsApp self-service bot (§9) | Phase 4 |
| 7b | Standout, confirmed tier 2: member credit score, scheduled auto-STK-push (§9) | Phase 3–4 |
| 8 | Standout, deferred: USSD, Swahili UI, in-app voting, welfare-fund tracking, one-click AGM export (§9) | Phase 7 |
| 9 | Data migration (real data transfer + dummy-data seed, §10) + security review gate + cutover | All above |

## 12. Decision log

All originally open questions are now resolved (see the Decisions table at the top of this document):

1. ~~Single chama vs. multi-tenant SaaS~~ → **Multi-tenant SaaS**, confirmed 2026-07-22.
2. ~~Same palette as DondooHomes vs. distinct~~ → **Distinct but consistent**, confirmed 2026-07-22.
3. ~~Existing data worth migrating?~~ → **Yes — transfer real data, plus seed additional dummy data**, confirmed 2026-07-22.
4. ~~Loan disbursement: B2C vs. manual~~ → **M-Pesa B2C automated payout**, confirmed 2026-07-22.
5. ~~Multi-chama-per-member in v1?~~ → Resolved by decision 1 (multi-tenant implies this is required, not optional).
6. ~~Which §9 standouts for v1?~~ → **Maker-checker + WhatsApp bot + credit score + auto-STK-push** (Phase 7a/7b), confirmed 2026-07-22.

No open questions remain — this plan is ready to be broken into tickets/epics per phase in §11.
