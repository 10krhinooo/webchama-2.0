# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Webchama, please report it privately rather than
opening a public GitHub issue. Email the repository owner with:

- A description of the vulnerability and its potential impact
- Steps to reproduce (proof-of-concept code or requests, if applicable)
- Any affected versions/commits you've identified

You should receive an acknowledgement within 3 business days. We aim to confirm the issue and
share a remediation timeline within 7 days of that acknowledgement. Please give us a reasonable
window to fix the issue before any public disclosure.

## Scope

In scope: the Quarkus backend (`src/main/java`), the React frontend (`frontend/src`), Flyway
migrations, and the Keycloak realm configuration (`keycloak/`) as shipped in this repository.

Out of scope: vulnerabilities in third-party dependencies with no exploitable path through this
application's code (report those upstream instead), and social engineering / physical security.

## Supported Versions

This project does not yet have tagged releases; security fixes land on `main` and are backported
only as far as an active deployment needs. Once versioned releases begin, this section will list
which lines receive security patches.

## Data Breach Notification

If a security incident results in unauthorized access to member data (contributions, loans,
payments, phone numbers, national IDs), the following applies per GDPR Article 33 and equivalent
obligations:

1. **Detect and contain** — isolate the affected system/credential, preserve logs
   (`activity_log`, `keycloak_security_event`, application logs) as evidence.
2. **Assess** — determine what data and how many data subjects were affected.
3. **Notify** — where a personal data breach is likely to result in a risk to data subjects'
   rights, notify the relevant supervisory authority within 72 hours of becoming aware, and
   notify affected members without undue delay where the breach is likely to result in a high
   risk to them.
4. **Document** — record the breach, its effects, and remediation taken, regardless of whether
   notification was required.
5. **Remediate** — rotate any credentials that may have been exposed
   (`app.security.pii-encryption-key`, `mpesa.*`, `flutterwave.*`, `keycloak.admin.client-secret`,
   OIDC client secrets) and patch the root cause before resuming normal operation.

## Security Measures in Place

- Member phone number, national ID, and M-Pesa receipt number are encrypted at rest
  (`DeterministicEncryptedStringConverter`).
- Payment webhooks are re-verified server-to-server before crediting any payment
  (`PaymentService.handleMpesaCallback`, `handleFlutterwaveWebhook`), never trusting the callback
  body alone; the Flutterwave webhook additionally checks a constant-time signature comparison.
- Per-chama roles are enforced from the `member_role` table on every request
  (`TenantAccessService`), never trusted from the JWT, with a dedicated `TenantIsolationTest`
  suite proving cross-chama access is rejected.
- `RateLimitFilter` rate-limits money-moving endpoints and payment provider webhooks.
- Dependency updates are monitored via Dependabot (see `.github/dependabot.yml`).
