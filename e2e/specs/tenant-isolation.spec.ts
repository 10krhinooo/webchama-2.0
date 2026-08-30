import { test, expect } from '../support/test'
import { FIXTURE } from '../support/db'
import { BACKEND_URL } from '../support/env'
import { api } from '../support/api'

/**
 * The load-bearing invariant of the whole product: a chama role is resolved per request from the
 * member_role table for the chama in the path, never from the token. These specs assert it
 * through the browser and directly against the API, because a UI that merely hides a link is not
 * isolation.
 */
test.describe('tenant isolation', () => {
  test('a member of one chama cannot read another chama through the API', async ({ asMember }) => {
    const response = await api.get(asMember, `/api/chamas/${FIXTURE.chama.kilele}/members`)
    expect(response.status()).toBe(403)
  })

  test('a member of one chama cannot read another chama contributions', async ({ asMember }) => {
    const response = await api.get(asMember, `/api/chamas/${FIXTURE.chama.kilele}/contributions/mine`)
    expect(response.status()).toBe(403)
  })

  test('a treasurer cannot act on a chama they are not a member of', async ({ asTreasurer }) => {
    const response = await api.get(asTreasurer, `/api/chamas/${FIXTURE.chama.kilele}/loans`)
    expect(response.status()).toBe(403)
  })

  test('a platform admin has no access to an individual chama', async ({ asSuperadmin }) => {
    // SUPER_ADMIN is a realm role and is deliberately given no tenant bypass. Platform oversight
    // goes through the separate aggregated overview endpoint instead.
    const chamaScoped = await api.get(asSuperadmin, `/api/chamas/${FIXTURE.chama.umoja}/members`)
    expect(chamaScoped.status()).toBe(403)

    const platformScoped = await api.get(asSuperadmin, `/api/admin/overview`)
    expect(platformScoped.status()).toBe(200)
  })

  test('a member cannot reach the platform overview', async ({ asMember }) => {
    const response = await api.get(asMember, `/api/admin/overview`)
    expect(response.status()).toBe(403)
  })

  test('an unauthenticated request is rejected', async ({ request }) => {
    const response = await request.get(`${BACKEND_URL}/api/chamas/${FIXTURE.chama.umoja}/members`)
    expect(response.status()).toBe(401)
  })

  test('the admin routes are not reachable in the browser by a plain member', async ({ asMember }) => {
    await asMember.goto('/admin/overview')
    // ProtectedRoute gates on the realm role, so a member never renders the admin page.
    await expect(asMember.getByRole('heading', { name: /platform overview/i })).toHaveCount(0)
  })
})
