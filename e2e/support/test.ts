import { test as base, expect, type Page } from '@playwright/test'
import { ROLES, type RoleName } from './roles'

type RoleFixtures = {
  [K in RoleName as `as${Capitalize<K>}`]: Page
}

/**
 * Opens a page already signed in as the given role.
 *
 * The warm-up navigation matters. The saved session is a Keycloak cookie rather than a token, so
 * the first navigation performs a check-sso redirect to exchange it. Handing a spec a page before
 * that settles means its first assertion races the redirect.
 */
async function signedInPage(
  browser: import('@playwright/test').Browser,
  role: RoleName,
  use: (page: Page) => Promise<void>,
) {
  const context = await browser.newContext({ storageState: ROLES[role].storageState })
  const page = await context.newPage()
  await page.goto('/my-chamas')
  await expect(page.getByTestId('staff-layout')).toBeVisible()
  await use(page)
  await context.close()
}

export const test = base.extend<RoleFixtures>({
  asChairperson: async ({ browser }, use) => {
    await signedInPage(browser, 'chairperson', use)
  },
  asTreasurer: async ({ browser }, use) => {
    await signedInPage(browser, 'treasurer', use)
  },
  asSecretary: async ({ browser }, use) => {
    await signedInPage(browser, 'secretary', use)
  },
  asMember: async ({ browser }, use) => {
    await signedInPage(browser, 'member', use)
  },
  asSuperadmin: async ({ browser }, use) => {
    await signedInPage(browser, 'superadmin', use)
  },
})

export { expect }
