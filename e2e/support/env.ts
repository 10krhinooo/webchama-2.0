/** One place for the addresses of the stack in docker-compose.e2e.yml. */
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5174'
export const BACKEND_URL = process.env.E2E_BACKEND_URL ?? 'http://localhost:8081'
export const KEYCLOAK_URL = process.env.E2E_KEYCLOAK_URL ?? 'http://localhost:8181'

/**
 * Both the app and Keycloak must be reached on the same hostname.
 *
 * Cookies are scoped by host rather than by port, which is what lets Keycloak's session cookie be
 * visible to the app's origin and makes silent re-authentication work over plain HTTP. Reaching
 * one on `localhost` and the other on `127.0.0.1` splits the cookie jar and every spec fails at
 * login with no useful message.
 */
export const DATABASE = {
  host: process.env.E2E_DB_HOST ?? 'localhost',
  port: Number(process.env.E2E_DB_PORT ?? 5435),
  database: process.env.E2E_DB_NAME ?? 'chama_e2e',
  user: process.env.E2E_DB_USER ?? 'chama',
  password: process.env.E2E_DB_PASSWORD ?? 'chama',
}
