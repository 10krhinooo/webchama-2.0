import { test, expect } from '../support/test'
import { FIXTURE } from '../support/db'

test.describe('authentication and role-scoped navigation', () => {
  test('a member lands on their chama list', async ({ asMember }) => {
    await expect(asMember).toHaveURL(/\/my-chamas/)
    await expect(asMember.getByTestId('staff-layout')).toBeVisible()
  })

  test('a platform admin is sent to the platform overview instead of a chama list', async ({
    asSuperadmin,
  }) => {
    await expect(asSuperadmin).toHaveURL(/\/admin\/overview/)
    // Scoped to the sidebar: the breadcrumb carries the same label, and an unscoped lookup is a
    // strict-mode violation rather than a useful assertion.
    await expect(
      asSuperadmin.locator('aside').getByRole('link', { name: /platform overview/i }),
    ).toBeVisible()
  })

  test('the chama navigation appears only once a chama is in the URL', async ({ asChairperson }) => {
    await expect(asChairperson.getByRole('link', { name: /^members$/i })).toHaveCount(0)

    await asChairperson.goto(`/chamas/${FIXTURE.chama.umoja}/dashboard`)
    await expect(asChairperson.getByRole('link', { name: /^members$/i })).toBeVisible()
    await expect(asChairperson.getByRole('link', { name: /^contributions$/i })).toBeVisible()
  })

  test('a chairperson sees the manager-only links', async ({ asChairperson }) => {
    await asChairperson.goto(`/chamas/${FIXTURE.chama.umoja}/dashboard`)
    await expect(asChairperson.getByRole('link', { name: /^approvals$/i })).toBeVisible()
    await expect(asChairperson.getByRole('link', { name: /^documents$/i })).toBeVisible()
  })

  test('a plain member does not see the manager-only links', async ({ asMember }) => {
    await asMember.goto(`/chamas/${FIXTURE.chama.umoja}/dashboard`)
    await expect(asMember.getByTestId('staff-layout')).toBeVisible()
    await expect(asMember.getByRole('link', { name: /^approvals$/i })).toHaveCount(0)
    await expect(asMember.getByRole('link', { name: /^documents$/i })).toHaveCount(0)
  })

  test('the theme choice survives a reload', async ({ asMember }) => {
    const toggle = asMember.getByTestId('theme-toggle')
    await toggle.click()
    await expect(toggle).toHaveAttribute('title', 'Theme: Light')

    await asMember.reload()
    await expect(asMember.getByTestId('staff-layout')).toBeVisible()
    await expect(asMember.getByTestId('theme-toggle')).toHaveAttribute('title', 'Theme: Light')
  })
})
