# Deployment

Audit finding P1-10: CI tests and builds the app but there was no path from a green build to a
running instance. This documents that path. It does not stand up any specific cloud account or
CI/CD pipeline (no cloud credentials exist for this repo to target); it's the runbook for whoever
does.

## Images

- `Dockerfile` (repo root): backend, self-contained multi-stage build. `docker build .` works from
  a fresh checkout with no separate `mvnw package` step.
- `frontend/Dockerfile`: static SPA build served through nginx, which also reverse-proxies `/api`
  to the backend (`frontend/src/api/client.ts` always calls a same-origin relative `/api` path).

```bash
docker build -t webchama-backend .
docker build -t webchama-frontend \
  --build-arg VITE_KEYCLOAK_URL=https://auth.example.com \
  --build-arg VITE_SENTRY_DSN=https://key@o0.ingest.sentry.io/0 \
  --build-arg VITE_SENTRY_ENVIRONMENT=production \
  --build-arg VITE_SENTRY_RELEASE=2026.09.1 \
  frontend/
```

`VITE_KEYCLOAK_URL` is baked into the frontend bundle at build time (Vite convention), it must be
the public URL browsers will reach Keycloak at, not an internal service name.

## Required infrastructure

- PostgreSQL 16. Flyway migrations run automatically on backend startup
  (`quarkus.flyway.migrate-at-start=true`).
- Keycloak 24, realm `chama`. In production this means running your own realm import through
  Keycloak's normal admin flow, **not** `keycloak/realm-chama.json` (see that file's own dev-only
  guard in `keycloak/dev-realm-entrypoint.sh`, it contains credentials committed to git).
  `resetPasswordAllowed: true` is carried over into whatever realm you provision from it, but
  Keycloak's own native "forgot password" flow needs a `smtpServer` configured on the realm to
  actually deliver anything (audit finding P1-11); either configure one, or rely on
  `POST /api/chamas/{chamaId}/members/{id}/resend-invite` (chairperson-only) as the recovery path
  instead, which goes through this app's own mailer and needs no Keycloak SMTP config.

## Backend runtime environment variables

All read only under the `%prod` profile (`quarkus.profile=prod`, the default when
`quarkus.package.jar.type` is run outside `quarkus:dev`/`@QuarkusTest`); see
`src/main/resources/application.properties` for the full mapping.

| Variable | Purpose |
|---|---|
| `KEYCLOAK_URL` | Base URL of the Keycloak server (OIDC + Admin API) |
| `KEYCLOAK_CLIENT_SECRET` | Secret for the `webchama-backend` confidential client |
| `KEYCLOAK_ADMIN_CLIENT_ID` / `KEYCLOAK_ADMIN_CLIENT_SECRET` | The `webchama-backend` client's own service-account credentials, scoped to the chama realm's `manage-users`/`manage-events`/`view-events` roles, `KeycloakAdminService` uses these to provision members on invite (not a master-realm admin account) |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` | Daraja app credentials, STK push |
| `MPESA_SHORTCODE` / `MPESA_TILL_NUMBER` / `MPESA_PASSKEY` | Daraja STK push config |
| `MPESA_CALLBACK_URL` | Publicly reachable URL for `/api/payments/mpesa-callback` |
| `MPESA_B2C_CONSUMER_KEY` / `MPESA_B2C_CONSUMER_SECRET` | Daraja B2C app credentials, loan disbursement |
| `MPESA_B2C_SHORTCODE` / `MPESA_B2C_INITIATOR_NAME` / `MPESA_B2C_SECURITY_CREDENTIAL` | Daraja B2C payout config |
| `MPESA_B2C_RESULT_URL` / `MPESA_B2C_QUEUE_TIMEOUT_URL` | Publicly reachable URLs for the B2C callback endpoints |
| `FLUTTERWAVE_SECRET_KEY` / `FLUTTERWAVE_SECRET_HASH` | Flutterwave app credentials and webhook verification |
| `FLUTTERWAVE_CALLBACK_URL` / `FLUTTERWAVE_REDIRECT_URL` | Publicly reachable webhook and post-checkout redirect URLs |
| `SENTRY_DSN` | Error reporting destination. Optional: with it unset nothing is initialised and faults stay in the logs |
| `SENTRY_ENVIRONMENT` | Label separating one deployment's errors from another's, defaults to `production` |
| `SENTRY_RELEASE` | Version string, so a fault can be tied to the deploy that introduced it. Set it to the same value as the frontend's `VITE_SENTRY_RELEASE` |

The datasource URL/credentials and mailer's committed Gmail credentials are not yet profile-gated
the same way; override `quarkus.datasource.jdbc.url`/`.username`/`.password` and `quarkus.mailer.*`
the same way if deploying anywhere the defaults in `application.properties` shouldn't apply.

## Frontend runtime configuration

`frontend/Dockerfile`'s nginx layer reads `BACKEND_URL` (default `http://backend:8080`) at
**container start**, via nginx's built-in `envsubst`-on-templates entrypoint hook
(`frontend/nginx.conf.template`), and proxies `/api/*` there. This is a deploy-time value, unlike
`VITE_KEYCLOAK_URL`, so it does not require rebuilding the image to change.

The template carries a dedicated `location` block for server-sent event streams, matched ahead of
the general `/api/` block, which turns `proxy_buffering` off. Without it nginx holds each event in
its buffer waiting for a response that never completes, and the live activity feed silently degrades
to its 10-second polling fallback. Any reverse proxy placed in front of this one needs the same
treatment for `/api/**/stream` paths.

## Minimal example

```bash
docker network create webchama

docker run -d --name postgres --network webchama \
  -e POSTGRES_DB=chama -e POSTGRES_USER=chama -e POSTGRES_PASSWORD=chama \
  postgres:16-alpine

# Run your own Keycloak with a realm import appropriate for the target environment, not
# keycloak/realm-chama.json.

docker run -d --name backend --network webchama -p 8080:8080 \
  -e KEYCLOAK_URL=https://auth.example.com \
  -e KEYCLOAK_CLIENT_SECRET=... \
  -e KEYCLOAK_ADMIN_CLIENT_ID=webchama-backend -e KEYCLOAK_ADMIN_CLIENT_SECRET=... \
  -e MPESA_CONSUMER_KEY=... -e MPESA_CONSUMER_SECRET=... \
  -e MPESA_SHORTCODE=... -e MPESA_TILL_NUMBER=... -e MPESA_PASSKEY=... \
  -e MPESA_CALLBACK_URL=https://api.example.com/api/payments/mpesa-callback \
  -e MPESA_B2C_CONSUMER_KEY=... -e MPESA_B2C_CONSUMER_SECRET=... \
  -e MPESA_B2C_SHORTCODE=... -e MPESA_B2C_INITIATOR_NAME=... -e MPESA_B2C_SECURITY_CREDENTIAL=... \
  -e MPESA_B2C_RESULT_URL=https://api.example.com/api/payments/b2c-callback \
  -e MPESA_B2C_QUEUE_TIMEOUT_URL=https://api.example.com/api/payments/b2c-timeout \
  -e FLUTTERWAVE_SECRET_KEY=... -e FLUTTERWAVE_SECRET_HASH=... \
  -e FLUTTERWAVE_CALLBACK_URL=https://api.example.com/api/payments/card/callback \
  -e FLUTTERWAVE_REDIRECT_URL=https://app.example.com/contribution-payment-result \
  webchama-backend

docker run -d --name frontend --network webchama -p 80:80 \
  -e BACKEND_URL=http://backend:8080 \
  webchama-frontend
```

This is a single-host sketch to prove the images work end to end, not a production topology (no
TLS termination, no restart/health-check policy, no secrets manager). Adapt it to whatever
platform actually hosts this.

## Error monitoring

Faults are reported to Sentry when a DSN is configured, and nowhere when it is not. Nothing needs
disabling for dev or CI: the backend logs one line saying reporting is off, and the frontend
initialises nothing.

Set it up once:

1. Create a project in Sentry (or a self-hosted instance, the DSN format is the same) and take its
   DSN. Two projects, one per platform, is easier to read than one shared between them.
2. Give the backend `SENTRY_DSN`, `SENTRY_ENVIRONMENT` and `SENTRY_RELEASE` as environment
   variables.
3. Give the frontend image the matching `VITE_SENTRY_*` values as build args. These are baked into
   the bundle at build time, per Vite's convention, so changing them means rebuilding the image.

### What is deliberately not sent

This is the part worth reading before pointing it at a real project. The schema encrypts member
phone numbers and national ids, and the M-Pesa and Flutterwave paths carry phone numbers and
payment references, so an error reporter left on its defaults would quietly send a third party
exactly the fields the database is careful to protect.

Both sides are therefore deny-by-default, in `SentryConfiguration` and `lib/errorReporting.ts`:

- No request bodies, headers, cookies or query strings. URLs keep their path and lose everything
  after the `?`, which matters most on the card-payment return, where the query is the transaction
  reference.
- The only identity attached to an event is the Keycloak subject UUID. No name, phone, email or
  national id. It is enough to see that one member hit the same fault eleven times, and not enough
  to say who they are.
- Tags, extras and breadcrumb fields whose names suggest member data are dropped on the way out,
  as a backstop for anything a future change starts attaching.

Both scrubbers have their own tests. They assert the absence of things rather than the presence of
them, because a leak here does not break a build or appear in a log: it looks exactly like working
error monitoring.

### Known gap: frontend stack traces are minified

The browser bundle is minified and its source maps are not uploaded, so a frontend error arrives
with frames like `t.default` rather than a file and line. The backend is unaffected.

Closing it needs a `SENTRY_AUTH_TOKEN` in CI and the `@sentry/vite-plugin` build step, which pulls
in `@sentry/cli` and its native binary through a postinstall script that this repository's npm
policy currently blocks. That is a deliberate follow-up rather than an oversight; the React
component stack is still attached to every boundary report in the meantime, which usually names
the component that threw.
