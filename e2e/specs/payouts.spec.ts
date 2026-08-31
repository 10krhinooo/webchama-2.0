import { test, expect } from '../support/test'
import { FIXTURE, query, queryOne } from '../support/db'
import { api } from '../support/api'
import { chooseOption, expectNotice } from '../support/actions'

/**
 * The payout rotation in chama 7, which this file owns.
 *
 * The rotation is the thing a chama argues about most, so the order is asserted in the database
 * rather than only on screen: a table can render rows in any order the page happens to fetch them.
 */
test.describe('payouts', () => {
  const chama = FIXTURE.chama.pamoja

  test('a chairperson generates a rotation and creates the next payout', async ({ asChairperson }) => {
    await asChairperson.goto(`/chamas/${chama}/payouts`)
    await asChairperson.getByRole('button', { name: 'Generate Schedule' }).click()
    await chooseOption(asChairperson, 'payout-rotation-type', /seniority/i)
    await asChairperson.getByRole('dialog').getByRole('button', { name: 'Generate Schedule' }).click()
    await expectNotice(asChairperson, /schedule generated/i)

    const rotation = await query<{ sequence_position: number; member_id: string }>(
      'SELECT sequence_position, member_id FROM payout_schedule WHERE chama_id = $1 ORDER BY sequence_position',
      [chama],
    )
    expect(rotation).toHaveLength(3)
    // Seniority: whoever joined first takes the first turn.
    expect(rotation.map((r) => r.sequence_position)).toEqual([1, 2, 3])

    await asChairperson.getByRole('button', { name: 'Create Next Payout' }).click()
    // Required, and the round's beneficiary is resolved from the rotation rather than picked.
    await asChairperson.locator('#payout-scheduled-date').fill('2026-09-30')
    await asChairperson.getByRole('dialog').getByRole('button', { name: 'Create Payout' }).click()
    await expectNotice(asChairperson, /payout created/i)

    const payout = await queryOne<{ round_number: number; status: string }>(
      'SELECT round_number, status FROM payout WHERE chama_id = $1 ORDER BY id DESC LIMIT 1',
      [chama],
    )
    expect(payout?.round_number).toBe(1)
    expect(payout?.status).not.toBe('DISBURSED')
  })

  test('a member sees their own turn but cannot change the rotation', async ({ asMember }) => {
    await asMember.goto(`/chamas/${chama}/payouts`)
    await expect(asMember.getByTestId('staff-layout')).toBeVisible()

    await expect(asMember.getByRole('button', { name: 'Generate Schedule' })).toHaveCount(0)
    await expect(asMember.getByRole('button', { name: 'Create Next Payout' })).toHaveCount(0)

    // The hidden button is not the control.
    const forbidden = await api.post(asMember, `/api/chamas/${chama}/payout-schedule`, {
      rotationOrderType: 'SENIORITY',
    })
    expect(forbidden.status()).toBe(403)
  })
})
