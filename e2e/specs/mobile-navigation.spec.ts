import { test, expect } from '../support/test'
import { FIXTURE } from '../support/db'

/**
 * The app shell on a phone.
 *
 * The rest of the suite runs at Desktop Chrome, which is the one viewport where the mobile drawer
 * does not exist, so none of it covered the navigation most of this product's users will actually
 * touch. This file sets its own viewport rather than adding a mobile Playwright project, because
 * the role fixtures build their contexts with `browser.newContext()` and never see a project's
 * device settings: a mobile project would have silently kept running at 1280 wide.
 *
 * Chama 1 is read only per the fixture, and nothing here mutates anything.
 */
test.describe('mobile navigation', () => {
  const chama = FIXTURE.chama.umoja
  const PHONE = { width: 360, height: 800 }

  test('the closed drawer is unreachable, and opens and closes on demand', async ({ asMember }) => {
    await asMember.setViewportSize(PHONE)
    await asMember.goto(`/chamas/${chama}/contributions`)

    const contributionsLink = asMember.getByRole('link', { name: 'Contributions' })

    // The desktop sidebar is still in the document at this width but display:none, which is what
    // takes it out of the accessibility tree and the tab order. The regression this guards is the
    // old drawer, which was moved off screen with a transform and stayed fully focusable, so a
    // phone user tabbed through fourteen invisible destinations before reaching the page.
    await expect(contributionsLink).toBeHidden()

    await asMember.getByRole('button', { name: 'Open menu' }).click()
    await expect(contributionsLink).toBeVisible()

    await asMember.keyboard.press('Escape')
    await expect(contributionsLink).toBeHidden()
  })

  test('the skip link is the first thing the keyboard reaches', async ({ asMember }) => {
    await asMember.setViewportSize(PHONE)
    await asMember.goto(`/chamas/${chama}/contributions`)
    // Settle first. The saved session is a Keycloak cookie, so this navigation performs a
    // check-sso redirect; pressing Tab mid-redirect moves focus on a document that is about to
    // be replaced, and the assertion then races the new page.
    await expect(asMember.getByRole('heading', { level: 1 })).toBeVisible()

    await asMember.keyboard.press('Tab')

    const focused = asMember.locator(':focus')
    await expect(focused).toHaveText(/skip to content/i)
    await expect(focused).toHaveAttribute('href', '#main-content')
  })

  test('the page itself never scrolls sideways, however wide the table is', async ({ asMember }) => {
    await asMember.setViewportSize(PHONE)
    await asMember.goto(`/chamas/${chama}/contributions`)
    await expect(asMember.getByRole('heading', { level: 1 })).toBeVisible()

    // A wide table is allowed to scroll inside its own container. The document is not. Both used
    // to be true at once: <main> carried overflow-x-auto while Table already had its own, so a
    // wide table produced a scrollbar inside a scrollbar and slid the whole shell sideways.
    const overflow = await asMember.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('the breadcrumb names the current page, which the hidden sidebar cannot', async ({ asMember }) => {
    await asMember.setViewportSize(PHONE)
    await asMember.goto(`/chamas/${chama}/contributions`)

    const breadcrumb = asMember.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(breadcrumb.getByText('Contributions')).toBeVisible()
  })
})
