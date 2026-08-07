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
docker build -t webchama-frontend --build-arg VITE_KEYCLOAK_URL=https://auth.example.com frontend/
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

The datasource URL/credentials and mailer's committed Gmail credentials are not yet profile-gated
the same way; override `quarkus.datasource.jdbc.url`/`.username`/`.password` and `quarkus.mailer.*`
the same way if deploying anywhere the defaults in `application.properties` shouldn't apply.

## Frontend runtime configuration

`frontend/Dockerfile`'s nginx layer reads `BACKEND_URL` (default `http://backend:8080`) at
**container start**, via nginx's built-in `envsubst`-on-templates entrypoint hook
(`frontend/nginx.conf.template`), and proxies `/api/*` there. This is a deploy-time value, unlike
`VITE_KEYCLOAK_URL`, so it does not require rebuilding the image to change.

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
