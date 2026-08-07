# Webchama system audit and fix plan

A combined security, database, integration-reliability, test, and email audit of the platform,
first run against `main` at commit `c1b795e` (after PRs #172 and #174 landed governance, welfare
fund, and platform-oversight features), and re-verified against the `feature/audit-plan-remediation`
branch after commits `3eef4bc`/`c93e9aa`/`c9041c1`/`0b41d05`/`4d87871` closed most of the P0/P1 list,
then again after a further remediation pass closed every P2 item and most of P3.
Everything below reflects the current code, not the state the audit first ran against.

## How to read this

Findings are ranked P0 (fix before shipping) through P3 (advisory). Each carries the current
`file:line` evidence and a fix direction. A note at the end lists what was fixed since the first
pass, so nobody re-investigates something already closed. All P0, P1 (bar one CVE with no
available fix), and P2 items are now closed; a small tail of P3 remains open.

## P0: fix before shipping

All four P0 items are now fixed, see "Already fixed since the first pass" below for the detail
on each. None remain open.

## P1: high, should fix before shipping

All original P1 items are now fixed except #12 (frontend CVE), which remains open below with no
available fix. See "Already fixed since the first pass" for #7, #8, #9, #10, and #11.

**12. One open CVE on a frontend dependency, no fix currently published.**
`react-router` still carries GHSA-qwww-vcr4-c8h2 (RSC Mode CSRF Bypass, high), and there is no
version that fixes it yet: the affected range is `>=7.12.0 <8.3.0`, but react-router's actual npm
registry only goes up to `7.18.2` (confirmed via `npm view react-router-dom versions`), no `8.x`
has been published. `7.18.2`, the latest published version, was already installed and is kept
(re-confirmed after this pass tried and reverted a downgrade to `7.11.0`, npm's own suggested
"fix", below). The `postcss` CVE (GHSA-fxqj-rqcc-2cmp) that was open alongside it is fixed,
`postcss` resolves to `8.5.26` throughout the tree, above the patched `8.4.31` floor.

Do not "fix" this by downgrading react-router: `npm audit fix --force` suggests `7.11.0`, but that
version sits inside a dozen other high-severity advisories that `7.18.2` already has patched
(unauthenticated DoS via inefficient route matching GHSA-chx6-hx7r-mcp5, RCE via vendored
turbo-stream deserialization GHSA-49rj-9fvp-4h2h, several open-redirect/XSS advisories). `7.18.2`
is the most-patched version currently available; the one open CVE is accepted as residual risk,
likely low real-world exploitability since this is a classic `BrowserRouter`/`Routes`/`Route` Vite
SPA (confirmed via a repo-wide grep, no `useLoaderData`/`useActionData`/`createBrowserRouter`
usage), not RSC mode. Re-check `npm view react-router-dom versions` periodically for an `8.x`
release that actually fixes this.

## P2: medium

All P2 items are now fixed, see "Already fixed since the first pass" below for the detail on each.
None remain open.

## P3: low

- No error-monitoring/APM tool in either frontend or backend. Not attempted in this pass, picking
  and wiring up a provider (Sentry or similar) is a bigger infrastructure decision than the rest of
  this list.

## Already fixed since the first pass

Confirmed directly against current code, no further action needed:

- **Maker-checker on loan disbursement** now exists via `ApprovalService`/`Chama.approvalThreshold`.
- **SUPER_ADMIN no longer bypasses tenant checks anywhere.** `TenantAccessService` has zero
  SUPER_ADMIN special-casing; platform-level oversight moved to a separate, deliberately
  aggregated `PlatformOverviewResource`/`PlatformStatsService`.
- **ROPC disabled on the public frontend Keycloak client.** `directAccessGrantsEnabled: false`
  confirmed in `keycloak/realm-chama.json`.
- **A branded, custom Keycloak login theme now exists** (`keycloak/themes/chama/login/login.ftl`),
  replacing the bare `parent=keycloak` stub.
- **`app.security.alert-emails` is now wired up.** `SecurityAlertEmailService` reads the config
  and sends real alerts on suspicious Keycloak events (brute-force lockouts).
- **HTML injection in the invite email is fixed.** `MemberInvitationEmailService` now escapes
  `fullName` and `email` through a shared `HtmlEmailSupport.escapeHtml()` utility before
  interpolation, and the utility's doc comment states escaping is required for every value that
  didn't originate in the codebase, worth applying the same discipline to any new email template.
- **Partially fixed: `sslRequired`** moved from `none` to `external` (SSL required for
  non-internal-network traffic), an improvement but not the same as requiring it unconditionally.
- **(P0-1) M-Pesa callback forgery.** `PaymentService.handleMpesaCallback` now treats the webhook
  body only as a "check now" trigger and re-queries Daraja's STK Query endpoint
  (`MpesaService.queryStkStatus`, the same source the reconciliation sweep uses) before marking a
  payment paid, and `PaymentDto`/`LoanDisbursementDto` no longer expose `providerReference`/
  `conversationId` to any client. `B2cCallbackResource`/`LoanDisbursementService.applyResultCallback`
  still trust the B2C ResultURL body's own `resultCode` directly rather than re-querying, unlike
  the STK path; residual risk is much lower now that `conversationId` is never handed to a client,
  but is not re-verified server-to-server the way STK and Flutterwave now are, worth closing the
  same way if B2C ever gets a signature/shared-secret scheme from Safaricom.
- **(P0-2) Committed SUPER_ADMIN password.** `keycloak/dev-realm-entrypoint.sh` refuses to import
  `realm-chama.json` at all unless `CHAMA_DEV_REALM_IMPORT=true` is set explicitly, and generates a
  random SUPER_ADMIN password on every start (printed to the Keycloak container's own logs, never
  persisted to the image or git) instead of using the committed placeholder.
- **(P0-3) Loan payout with no record it happened.** `LoanDisbursementService.initiate()` now
  commits an `INITIATING` `loan_disbursement` row in its own transaction before calling
  `b2cClient.requestPayout`, so a crash after Safaricom accepts the payout still leaves a row
  behind for the reconciliation sweep to find.
- **(P0-4) Double loan disbursement.** `LoanDisbursementService.claim()` atomically transitions the
  loan off `APPROVED` to a new `DISBURSEMENT_PENDING` status inside the same transaction that
  commits the `INITIATING` row, optimistic-locked so a double-click or client retry fails on commit
  rather than firing two real payouts.
- **(P0-5) Double-credited contribution payment.** `Payment` and `Contribution` both now carry
  `@Version`.
- **(P0-6) Deleting a member with financial history crashes.** `MemberService.delete()` now checks
  contribution/loan/payment/penalty history first and rejects the delete with a message pointing
  at the `MemberStatus.EXITED` soft-delete path instead of throwing an unhandled FK violation.
- **(P1-7) Deleting a chama with a loan disbursement crashes.** `ChamaService.delete()` now deletes
  `loan_disbursement` rows (`loan.chama.id = ?1`) before deleting `loan`.
- **(P1-8) No phone/national-ID uniqueness within a chama.** `idx_member_chama_phone` (unique) and
  a partial `idx_member_chama_national_id` (unique where not null) now exist.
- **(P1-9) Maker-checker self-approval gap.** A maker can no longer supply the first sign-off on
  their own request; `ApprovalService` now rejects that in addition to the existing "same person
  twice" check.
- **(P1-10) No path from a green build to a running instance.** A root `Dockerfile` (backend) and
  `frontend/Dockerfile` (nginx-served SPA) now exist, CI builds both from a fresh checkout, and
  `DEPLOYMENT.md` documents the runbook end to end (required infra, env vars, a minimal
  docker-run example).
- **(P1-11) Invite email failure, zero recovery path.** Chairpersons can now trigger
  `POST /api/chamas/{chamaId}/members/{id}/resend-invite` from the members page, which reissues a
  temporary password and re-sends the credential email through this app's own mailer, independent
  of whether Keycloak's realm has SMTP configured for its native forgot-password flow.
- **(P1-12, partial) postcss CVE.** GHSA-fxqj-rqcc-2cmp is resolved, `postcss` sits at `8.5.26`
  throughout `frontend/`, above the patched floor. The `react-router` CVE in the same finding is
  still open with no available fix, see P1 #12 above.
- **(P2-13) Master-realm Keycloak admin credentials.** `KeycloakAdminService` now authenticates via
  `grant_type=client_credentials` against the `chama` realm's own token endpoint, as the
  `webchama-backend` confidential client's service account (`serviceAccountsEnabled: true`,
  granted only `manage-users`/`manage-events`/`view-events` on that realm's `realm-management`
  client), never a master-realm admin/password grant. A compromised token can now only affect the
  `chama` realm.
- **(P2-14) Member PII stored in plaintext.** `Member.phone`/`nationalId` and
  `Payment.mpesaReceiptNumber` are now encrypted at rest via
  `DeterministicEncryptedStringConverter` (AES-GCM, nonce derived from HMAC-SHA256(plaintext) so
  encryption stays deterministic), keeping `idx_member_chama_phone`/`idx_member_chama_national_id`
  functional since the same plaintext always produces the same ciphertext. Falls back to returning
  a stored value verbatim if it isn't valid ciphertext, so pre-existing plaintext rows keep working
  and are transparently re-encrypted on next save, no separate backfill migration needed.
- **(P2-15) No CHECK constraints on any money column.** Every money/rate column across the schema
  (contribution, loan, loan_repayment, approval, payout, penalty, welfare_contribution,
  welfare_withdrawal, welfare_fund, chama, generated_document, payment, loan_disbursement) now has
  a `CHECK (... >= 0)` constraint.
- **(P2-16) The polymorphic payment ledger was half-built.** `Payment` now has `loanRepayment`/
  `penalty` FK columns; `LoanService.recordRepayment` and a new `PenaltyService.settle` (backing a
  new `PUT /api/chamas/{chamaId}/penalties/{id}/settle` endpoint, with a new `PenaltyStatus.PAID`)
  both create a real `Payment` row (purpose `LOAN_REPAYMENT`/`PENALTY`) with a provider-reference
  audit trail, the same as contribution and welfare payments. `PaymentService.markSuccess` also
  gained matching branches, ready for either purpose to go through an online channel later.
- **(P2-17) Reducing-balance loan installments computed in floating point.**
  `LoanService.reducingBalanceInstallment` now stays entirely in `BigDecimal` (`(1+r)^n` via
  `BigDecimal.pow(int)`, an exact integer power), matching the discipline `flatInstallment` already
  used, no more `double`/`Math.pow` round-trip.
- **(P2-18) No retries or circuit breaker on any outbound integration call.**
  `quarkus-smallrye-fault-tolerance` is now a dependency; `MpesaService`, `FlutterwaveService`,
  `DarajaB2cClient`, and `KeycloakAdminService` all carry `@Timeout`/`@CircuitBreaker` so a
  degraded provider fails fast instead of occupying a worker thread for the full manual timeout.
  `@Retry` is added only to idempotent reads/re-triggers (`queryStkStatus`,
  `queryTransactionStatus`, `findUserByEmail`, `getUserEmail`, `resetPassword`,
  `ensureEventsEnabled`, `fetchLoginEvents`, `fetchAdminEvents`), never to a non-idempotent write
  (`stkPush`, `requestPayout`, `initializePayment`, `createUser`) where a retry after an ambiguous
  failure could double-fire a real payment/payout or duplicate an account. `getUserEmail`,
  `createUser`, and `resetPassword` also mark their circuit breaker with `skipOn =
  RuntimeException.class`, since a plain "no such user" 404 for one stale/deleted account is a
  business condition, not an infrastructure failure, and must not trip the breaker for every other
  member's unrelated lookup.
- **(P2-19) Scheduled jobs could overlap.** All five `@Scheduled` methods
  (`PaymentService.reconcileStalePendingMpesaPayments`,
  `LoanDisbursementService.reconcileStalePending`, `ContributionAutoPushService.fireDueAutoPushes`,
  `KeycloakSecurityEventSyncService.sync`, `RateLimitFilter.cleanup`) now set
  `concurrentExecution = Scheduled.ConcurrentExecution.SKIP`.
- **(P3) Missing indexes.** `idx_payment_member_id`/`idx_payment_status`, plus indexes on
  `loan.approved_by_member_id`, `penalty.decided_by_member_id`, `approval`'s
  requester/first-approver/second-approver columns, and `meeting_attendance.member_id`, all added.
- **(P3) No guard against a second PENDING payment on the same contribution.**
  `initiateCardPayment` now has the same app-level check `initiateMpesaPayment` already had, and
  both are backed by a DB-level partial unique index
  (`idx_payment_one_pending_per_contribution`, `WHERE status = 'PENDING'`) closing the race a
  plain read-then-write check can't, with a friendly `BadRequestException` on conflict.
- **`Chama.createdAt`** now uses `@CreationTimestamp` instead of a Java field initializer, matching
  every other entity's audit-timestamp convention. `Member.joinDate` deliberately was not changed
  the same way: unlike `Chama.createdAt` it's a business field `PayoutService` sorts members by for
  seniority-based payout rotation, and test fixtures legitimately backdate it, which
  `@CreationTimestamp` would silently overwrite.
- **(P3) No plain-text part on the invite email.** `MemberInvitationEmailService` now sends both a
  `text/plain` and the existing HTML part via `Mail.withText(...).setHtml(...)`.
- **(P3) No React error boundary.** `ErrorBoundary` now wraps `<App />` in `main.tsx`, showing a
  recoverable message instead of an unhandled blank white screen.
- **(P3) No OG meta tags on the public marketing homepage.** `frontend/index.html` now has
  `og:type`/`og:title`/`og:description`, a `meta name="description"`, and Twitter card tags.
  `og:image`/`og:url` were deliberately left out: there's no real social-preview graphic asset to
  point `og:image` at yet, and `og:url` would need a real production domain baked into a static,
  single-`index.html` Vite SPA.
- **(P3) Frontend coverage gap.** Now clears the 90 percent gate on all four metrics (was 89.2/89.6
  percent on functions/branches): added tests for `ErrorBoundary`'s reload action and
  `HomePage`'s role-grid `IntersectionObserver` callback, the two most function-coverage-starved
  spots, plus normal coverage from the new backend-adjacent frontend types
  (`Payment.loanRepaymentId`/`penaltyId`) and the encryption/payment-ledger work above.
- **All five "Suggestions" from the first pass are implemented.** Loan status
  (`LoanStatusEmailService`: approved, disbursed, disbursement failed), contribution/welfare
  payment receipts (`PaymentReceiptEmailService`), payout status (`PayoutStatusEmailService`),
  penalty status (`PenaltyStatusEmailService`), and meeting notifications
  (`MeetingNotificationEmailService`) all now exist, alongside an `ApprovalNotificationEmailService`
  and `AutoPushFailedEmailService` that weren't originally suggested but close the same gap for
  dual sign-off requests and failed auto-STK-push attempts.

## Scope and method

Covered: STRIDE threat modeling with DREAD scoring across every trust boundary, a repo-wide secret
scan verified by hand, all Flyway migrations plus every entity and repository touching money, live
test runs (332 backend / 426 frontend, both green, `./mvnw verify` and `npm run test:coverage`
both passing their 90 percent gates) rather than static review only, external integration
reliability for Daraja/Flutterwave/Keycloak/Gmail SMTP, a re-verification pass against `main` after
PRs #172/#174 landed governance, welfare-fund, and platform-oversight features, a second
re-verification pass against `feature/audit-plan-remediation` after the P0/P1 remediation commits
landed, and a third pass closing every remaining P2 item and most of P3, reading every changed file
directly rather than trusting commit messages, and confirming the Keycloak service-account switch
and the react-router version decision against the real running Keycloak container and the real npm
registry rather than assuming either from the advisory text alone.

Not independently re-verified in this pass: DNS-level SPF/DKIM/DMARC for any production sending
domain, penetration testing against a running instance, accessibility audit, load testing.
