import { BACKEND_URL, BASE_URL, KEYCLOAK_URL } from './env'
import { closePool, resetAndSeed } from './db'

const READY_TIMEOUT_MS = 120_000

async function waitFor(label: string, url: string, accept: (status: number) => boolean = (s) => s < 500) {
  const deadline = Date.now() + READY_TIMEOUT_MS
  let lastError = ''
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (accept(response.status)) return
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error(
    `${label} did not become ready at ${url} within ${READY_TIMEOUT_MS / 1000}s (last: ${lastError}).\n` +
      'Start the stack first:\n' +
      '  docker compose -f docker-compose.e2e.yml up -d --build',
  )
}

/**
 * Asserts the stack is up, then resets the database to the fixture.
 *
 * The stack is managed outside Playwright rather than through `webServer`, which can only start a
 * single process and cannot express the Postgres to Keycloak to backend to nginx dependency
 * chain. Failing here with an explicit instruction is more useful than every spec timing out at
 * its first navigation.
 */
export default async function globalSetup() {
  await waitFor('Backend', `${BACKEND_URL}/api/health`, (status) => status === 200)
  await waitFor('Keycloak', `${KEYCLOAK_URL}/realms/chama/.well-known/openid-configuration`, (s) => s === 200)
  await waitFor('Frontend', BASE_URL, (status) => status === 200)

  await resetAndSeed()
  await closePool()
}
