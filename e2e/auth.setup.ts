import { test as setup, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { ROLES } from './support/roles'

setup.beforeAll(async () => {
  await mkdir('.auth', { recursive: true })
})

/**
 * Logs each role in once through a real browser and saves the resulting session.
 *
 * What gets saved is the Keycloak session cookie, not a token. keycloak-js keeps its tokens in
 * memory and never persists them, so localStorage is empty here and that is correct; injecting a
 * token by hand would produce a state the app cannot refresh from. Each spec's first navigation
 * therefore performs a fresh check-sso redirect and exchanges the cookie for a new token, which
 * is also why the 60 second access token lifetime does not constrain how long the suite runs.
 *
 * The login has to happen in a real browser rather than through a direct password grant, because
 * the webchama-frontend client has direct access grants disabled.
 */
for (const role of Object.values(ROLES)) {
  setup(`authenticate as ${role.name}`, async ({ page }) => {
    await page.goto('/my-chamas')

    // ProtectedRoute sends an unauthenticated visitor to Keycloak, so the login form is served
    // from the Keycloak origin rather than the app's.
    await page.waitForURL(/\/realms\/chama\/protocol\/openid-connect\/auth/, { timeout: 30_000 })

    await page.getByLabel(/username|email/i).fill(role.username)
    await page.getByLabel(/^password$/i).fill(role.password)
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    // Wait for the app to be authenticated, not merely for the URL to change. The redirect lands
    // before check-sso has settled, so asserting on the URL alone can save a session that is not
    // established yet.
    await page.waitForURL((url) => !url.pathname.startsWith('/realms/'), { timeout: 30_000 })
    await expect(page.getByTestId('staff-layout')).toBeVisible({ timeout: 30_000 })

    await page.context().storageState({ path: role.storageState })
  })
}
