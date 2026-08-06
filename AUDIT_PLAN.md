# Webchama system audit and fix plan

A combined security, database, integration-reliability, test, and email audit of the platform,
re-verified against `main` at commit `c1b795e` (after PRs #172 and #174 landed governance,
welfare fund, and platform-oversight features). Everything below reflects the current code, not
the state the audit first ran against.

## How to read this

Findings are ranked P0 (fix before shipping) through P3 (advisory). Each carries the current
`file:line` evidence and a fix direction. A note at the end lists what was fixed since the first
pass, so nobody re-investigates something already closed.

## P0: fix before shipping

Every item here either loses chama funds silently, lets someone fabricate a payment, or crashes a
core admin action. None require an unusual attacker; several trigger from ordinary use.

**1. M-Pesa webhooks trust whoever holds the ID, and the app hands that ID to normal users.**
`PaymentCallbackResource.mpesaCallback` and `B2cCallbackResource` are `@PermitAll` with no
signature or shared-secret check on the Daraja side (Flutterwave's path does this correctly, see
"already fixed" below). The IDs needed to forge a callback are handed to normal users by design:
`PaymentDto.providerReference` is returned from `PaymentResource.mine()` (a member's own payment
list) and `LoanDisbursementDto.conversationId` is returned from the disburse endpoint. A member
can trigger their own STK push, read back the `providerReference`, then POST it straight to
`/api/payments/mpesa-callback` with `ResultCode: 0` and mark their own contribution paid with no
money moved. A TREASURER/CHAIRPERSON can do the same for a loan disbursement. Welfare fund
contributions ride the same `Payment` entity and webhook path (`WelfareContribution` is "backed"
by a `Payment` row), so this covers welfare payments too, not just regular contributions.
Files: `PaymentCallbackResource.java:44`, `B2cCallbackResource.java:32-46`,
`PaymentDto.java`, `PaymentResource.java:39-44`, `LoanDisbursementDto.java`.
Fix: stop trusting the callback body as ground truth, re-query Safaricom's transaction-status API
before flipping a payment/disbursement to COMPLETED (the existing reconciliation sweep already
does this for stale cases, extend the pattern to every callback). Stop returning
`providerReference`/`conversationId` in client-facing DTOs unless a consumer genuinely needs it.

**2. A working SUPER_ADMIN password is committed to git.**
`keycloak/realm-chama.json` is tracked, auto-imported by docker-compose, and still contains
`admin`/`SuperAdmin1234!` in plaintext with the SUPER_ADMIN role, `temporary: false`. This is
narrower than it was (see fixes below: `sslRequired` is now `external` and the frontend client can
no longer ROPC its way in), but the password itself is unchanged and still grants full SUPER_ADMIN
access through the ordinary login form. Anyone with repo access has a working credential.
File: `keycloak/realm-chama.json`.
Fix: this file must never be reachable outside an isolated local/dev environment. Add a startup
guard that refuses to boot with this realm import outside a dev profile, generate demo passwords
randomly at setup time instead of hardcoding them, rotate the client secret per environment.

**3. A loan payout can leave Safaricom with no record it ever happened.**
`LoanDisbursementService.initiate()` still calls `b2cClient.requestPayout(...)` before persisting
the `LoanDisbursement` row, both inside one `@Transactional` method, unchanged since the first
pass. If the commit fails after Safaricom already accepted the payout, the whole method rolls back
and the row never exists. The later callback looks up a ConversationID that isn't there, logs
"ignoring," and money has left the chama's account with nothing in the system pointing at it.
File: `LoanDisbursementService.java:49-73`.
Fix: persist the `LoanDisbursement` row (status e.g. `INITIATING`) before calling
`b2cClient.requestPayout`, then update it with the ConversationID after a successful call.

**4. Nothing stops a loan from being disbursed twice.**
Unchanged. The new `ApprovalService` maker-checker gate (see fixes below) only applies to loans at
or above `Chama.approvalThreshold`, and even where it applies, `requireApproved()` only checks
that an `Approval` row cleared, it does not itself claim or lock anything. `loan.status` still
stays `APPROVED` until the async callback lands, sometimes minutes later, and the disburse
endpoint's rate limit still allows 10 requests/minute per IP, not one per loan. A double-click or a
client retry after a slow response fires a second real M-Pesa payout for the same loan.
File: `LoanDisbursementService.java:49-73`.
Fix: atomically claim the loan for disbursement inside the same transaction, e.g. transition
`loan.status` to a new `DISBURSEMENT_PENDING` value before the external call, and add
`UNIQUE (loan_id) WHERE status IN ('PENDING','COMPLETED')` on `loan_disbursement` as a DB-level
backstop.

**5. A contribution payment can be credited twice.**
Unchanged. `Payment` and `Contribution` still have no `@Version` column, unlike `Loan`,
`LoanDisbursement`, `Payout`, `Penalty`, and now `Approval`, which all correctly use optimistic
locking. Two near-simultaneous webhook deliveries for the same payment (Safaricom is documented to
redeliver) can both read `status = PENDING` before either commits, and both credit the balance.
Files: `Payment.java`, `Contribution.java`.
Fix: add `@Version` to both entities.

**6. Deleting a member with any financial history crashes.**
Unchanged, 4-line method: `MemberService.delete()` only removes the member's role rows before
deleting the member itself. Any member who has ever made a contribution, taken a loan, received a
penalty, or appeared in a payout throws an unhandled foreign-key violation.
File: `MemberService.java:191-195`.
Fix: either clean up every dependent table before the delete (mirroring `ChamaService.delete`'s
pattern once fix #7 below closes its own gap), or reconsider whether members with financial
history should ever be hard-deleted (the existing `MemberStatus.EXITED` soft-delete path is the
safer default).

## P1: high, should fix before shipping

**7. Deleting a chama that ever disbursed a loan also crashes.**
Unchanged. `ChamaService.delete()` cascades ten child tables in order but still never deletes
`loan_disbursement`, which has a NOT NULL foreign key to `loan` with no cascade.
File: `ChamaService.java:190-210`.
Fix: add a `loanDisbursementRepository.delete("loan.chama.id", id)` call before the loan delete.

**8. No uniqueness on phone or national ID within a chama.**
Unchanged. Only `(chama_id, keycloak_user_id)` and `(member_id, role)` are unique. Loan
disbursement targets `member.phone` directly, so two members with the same phone number is a real
duplicate-identity and misdirected-payout risk.
File: `V3__create_member_and_member_role_tables.sql`.
Fix: `UNIQUE (chama_id, phone)` and a partial `UNIQUE (chama_id, national_id) WHERE national_id IS
NOT NULL`.

**9. Maker-checker has a self-approval gap.**
New finding, found while re-verifying the fix below: `ApprovalService.approve()` correctly
prevents the same person from providing both signatures (`firstApprover.id.equals(signer.id)`
throws), but nothing stops the person who *requested* the approval (the maker, via
`ApprovalService.request()`) from then also being the *first* checker. A single TREASURER can
request a disbursement and immediately supply the first sign-off themselves, leaving only one
other person's agreement standing between them and a large payout, rather than the two
independent reviewers "dual sign-off" implies.
File: `ApprovalService.java:106-131` (`approve()`), `77-101` (`request()`).
Fix: reject `approve()` when `signerMemberId` equals the approval's `requestedBy`, not just when
it equals the first approver.

**10. No path from a green build to a running production instance.**
Unchanged. CI (`.github/workflows/ci.yml`) tests and builds both apps but there is still no
Dockerfile for the app itself and no deploy stage.

**11. An invite email failure leaves a member with zero recovery path.**
Unchanged. `keycloak/realm-chama.json` still has `resetPasswordAllowed: true` with no
`smtpServer` configured, so Keycloak's native forgot-password flow can't deliver anything. No
resend-invite or admin password-reset REST endpoint exists.

**12. Two open CVEs on frontend dependencies, confirmed with a fresh audit.**
`react-router` still carries GHSA-qwww-vcr4-c8h2 (RSC Mode CSRF Bypass, high), version
`^7.18.1` falls in the affected `7.12.0-8.2.0` range. Also newly found this pass: `postcss`
carries GHSA-fxqj-rqcc-2cmp (moderate, arbitrary `.map` file read), fixable with a plain
`npm audit fix`, no breaking change required. The react-router fix is a breaking-change bump
(`npm audit fix --force`), likely low real-world exploitability here since this is a Vite SPA
rather than RSC mode, but it's unresolved and shouldn't be assumed safe without confirming.

## P2: medium

**13. Backend holds master-realm Keycloak admin credentials.**
Unchanged. `KeycloakAdminService` still authenticates to the Admin API via `grant_type=password`
with `keycloak.admin.username`/`password`, a master-realm admin pair, rather than a service
account scoped to just the `chama` realm.

**14. Member PII stored in plaintext.**
Unchanged. `Member.nationalId` is a plain `@Column`, no field-level encryption, same for `phone`
and `Payment.mpesaReceiptNumber` elsewhere in the schema.

**15. No CHECK constraints on any money column.** Every amount column across the schema still
allows negative values at the DB layer; `@Positive` on create DTOs is the only defense.

**16. The polymorphic payment ledger is still half-built.** `payment_purpose` still carries
`LOAN_REPAYMENT`/`PENALTY` enum values with no code path that ever creates a `Payment` row for
either; loan repayments and penalty settlements still get no idempotency key or provider-reference
audit trail the way contributions and welfare payments do.

**17. Reducing-balance loan installments still computed in floating point.**
`LoanService`'s amortization formula still converts principal/rate to `double` for the `Math.pow`
calculation before converting back to `BigDecimal`. The final installment absorbs the rounding
remainder so totals reconcile, but individual installments are inexact along the way.

**18. No retries or circuit breaker on any outbound integration call.** No
`quarkus-smallrye-fault-tolerance` dependency exists. A slow or degraded Safaricom/Flutterwave/
Keycloak response can occupy a worker thread for the full timeout on every request, with no
fast-fail path during a known outage.

**19. Stuck contribution payments have no reconciliation sweep.** Loan disbursements get one,
contributions don't; `MpesaService.queryStkStatus` exists but is only called from a test.

**20. Scheduled jobs can overlap and corrupt a batch.** Neither `@Scheduled` job sets
`concurrentExecution = SKIP`; the Keycloak sync's worst-case runtime can exceed its own interval.

## P3: low

- `payment.member_id` and `payment.status` have no index, the highest-growth ledger table in the
  app, latent until finding #19's reconciliation sweep ships.
- No app-level or DB guard against a second PENDING payment on the same contribution from a
  double-tap.
- Two entities (`Chama`, `Member`) use a Java field initializer for their creation timestamp
  instead of `@CreationTimestamp`, inconsistent with every other entity.
- A few nullable FK columns (loan approver, penalty decider, meeting attendee) have no index.
- No plain-text part on the invite email, HTML-only send.
- No React error boundary, an unhandled render error produces a blank white screen.
- No error-monitoring/APM tool in either frontend or backend.
- No OG meta tags on the public marketing homepage.
- Frontend coverage sits just under the 90 percent gate (89.2/89.6 percent on functions/branches),
  clustered in the marketing homepage's scroll-animation branches and a handful of staff pages.

## Already fixed since the first pass

Confirmed directly against current code, no further action needed:

- **Maker-checker on loan disbursement** now exists via `ApprovalService`/`Chama.approvalThreshold`
  (see P1 #9 above for the one gap that remains in it).
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

## Suggestions

Not defects, opportunities worth scheduling once the fix list above is clear.

- Loan status emails: approved, disbursed, or disbursement failed.
- Contribution/welfare payment receipt on success.
- Payout scheduled/disbursed notifications.
- Penalty issued/waived notifications.
- Meeting scheduled/minutes published notifications.

## Scope and method

Covered: STRIDE threat modeling with DREAD scoring across every trust boundary, a repo-wide secret
scan verified by hand, all Flyway migrations plus every entity and repository touching money, live
test runs (139 backend / 235 frontend, both green) rather than static review only, external
integration reliability for Daraja/Flutterwave/Keycloak/Gmail SMTP, and a full re-verification
pass against `main` after PRs #172/#174 landed governance, welfare-fund, and platform-oversight
features, confirming which prior findings are fixed versus still open, plus fresh coverage of the
new `ApprovalService`, `WelfareContributionService`, and Keycloak realm/theme changes.

Not independently re-verified in this pass: every P2/P3 item below the fold (carried forward from
the first audit on the assumption the governance/welfare-focused PRs didn't touch that code, but
not re-checked line by line), DNS-level SPF/DKIM/DMARC for any production sending domain,
penetration testing against a running instance, accessibility audit, load testing.
