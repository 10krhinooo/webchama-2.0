import { test, expect } from '../support/test'
import { FIXTURE, queryOne } from '../support/db'
import { api } from '../support/api'
import { expectNotice, unique } from '../support/actions'

/**
 * Member administration in chama 3, which this file owns.
 *
 * Inviting really does provision a Keycloak account, so every invited address is unique per run:
 * the database is reset between runs and Keycloak is not, and a reused address fails on an account
 * that already exists rather than on anything the spec is trying to prove.
 */
test.describe('member administration', () => {
  const chama = FIXTURE.chama.tumaini

  test('a chairperson invites a member and the account is provisioned', async ({ asChairperson }) => {
    const email = `${unique('e2e-invite')}@example.com`
    const name = unique('Invited Member')

    await asChairperson.goto(`/chamas/${chama}/members`)
    await asChairperson.getByRole('button', { name: '+ Invite Member' }).click()

    await asChairperson.locator('#member-email').fill(email)
    await asChairperson.locator('#member-full-name').fill(name)
    // Selected by type rather than by id: the phone control is a third-party component and the
    // FormField label above it points at nothing.
    // Typed rather than filled: the control reformats as it goes and only sees the digits when
    // they arrive as keystrokes.
    await asChairperson
      .getByRole('dialog')
      .locator('input[type="tel"]')
      .pressSequentially('711' + Date.now().toString().slice(-6))
    await asChairperson.getByRole('checkbox', { name: /^member$/i }).check()
    await asChairperson.getByRole('button', { name: 'Add Member' }).click()

    // The temporary password is shown once, in its own dialog, and never again.
    await expect(asChairperson.getByRole('heading', { name: /member invited/i })).toBeVisible()
    await asChairperson.getByRole('button', { name: 'Done' }).click()

    await expect(asChairperson.getByRole('cell', { name })).toBeVisible()
  })

  test('a chairperson suspends and reactivates a member', async ({ asChairperson }) => {
    await asChairperson.goto(`/chamas/${chama}/members`)

    const row = asChairperson.getByRole('row').filter({ hasText: 'Brian Treasurer' })
    await row.getByRole('button', { name: 'Suspend' }).click()
    await expectNotice(asChairperson, /is now suspended/i)

    await row.getByRole('button', { name: 'Activate' }).click()
    await expectNotice(asChairperson, /is now active/i)
  })

  test('a member with financial history is exited rather than deleted', async ({ asChairperson }) => {
    await asChairperson.goto(`/chamas/${chama}/members`)

    const row = asChairperson.getByRole('row').filter({ hasText: 'Daniel Member' })
    await row.getByRole('button', { name: 'Remove' }).click()
    await asChairperson.getByRole('dialog').getByRole('button', { name: 'Remove' }).click()

    // Refused on purpose. Deleting someone who has contributed would cascade the contribution
    // away, so the product offers exiting them instead, which keeps the record.
    await expectNotice(asChairperson, /cannot be deleted|EXITED/i)

    const stillThere = await queryOne<{ status: string }>(
      'SELECT status FROM member WHERE id = $1',
      [FIXTURE.member.tumainiWithHistory],
    )
    expect(stillThere?.status).toBe('ACTIVE')

    await row.getByRole('button', { name: 'Mark exited' }).click()
    await expectNotice(asChairperson, /is now exited/i)

    const exited = await queryOne<{ status: string }>('SELECT status FROM member WHERE id = $1', [
      FIXTURE.member.tumainiWithHistory,
    ])
    expect(exited?.status).toBe('EXITED')
  })

  test('a plain member cannot invite anyone', async ({ asMember }) => {
    await asMember.goto(`/chamas/${chama}/members`)
    await expect(asMember.getByTestId('staff-layout')).toBeVisible()
    await expect(asMember.getByRole('button', { name: '+ Invite Member' })).toHaveCount(0)

    // The hidden button is not the control. Provisioning accounts is chairperson-only at the API.
    const response = await api.post(asMember, `/api/chamas/${chama}/members`, {
      email: 'should-never-exist@example.com',
      fullName: 'Should Never Exist',
      phone: '+254799999999',
      roles: ['MEMBER'],
    })
    expect(response.status()).toBe(403)
  })

  test('a treasurer cannot regenerate the join code', async ({ asTreasurer }) => {
    const response = await api.post(asTreasurer, `/api/chamas/${chama}/join-code/regenerate`)
    expect(response.status()).toBe(403)
  })
})
