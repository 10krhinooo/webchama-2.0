import { test, expect } from '../support/test'
import { FIXTURE, queryOne } from '../support/db'
import { api } from '../support/api'
import { chooseOption, expectNotice } from '../support/actions'

/**
 * The penalty lifecycle in chama 5, which this file owns.
 *
 * Every state change is checked in the database as well as on screen, because the table renders
 * the same badge for a penalty the API refused as for one it accepted, if the page never refetched.
 */
test.describe('penalties', () => {
  const chama = FIXTURE.chama.baraka

  async function issue(page: import('@playwright/test').Page, amount: string, reason: RegExp) {
    await page.goto(`/chamas/${chama}/penalties`)
    await page.getByRole('button', { name: 'Issue penalty' }).click()

    await chooseOption(page, 'penalty-member', 'Daniel Member')
    await chooseOption(page, 'penalty-reason', reason)
    await page.locator('#penalty-amount').fill(amount)
    await page.getByRole('dialog').getByRole('button', { name: 'Issue penalty' }).click()

    await expectNotice(page, /penalty issued/i)
  }

  test('a treasurer issues a penalty, approves it, and records payment', async ({ asTreasurer }) => {
    await issue(asTreasurer, '750', /late contribution/i)

    const pending = await queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM penalty WHERE chama_id = $1 AND amount = 750 ORDER BY id DESC LIMIT 1`,
      [chama],
    )
    expect(pending?.status).toBe('PENDING')

    const row = asTreasurer.getByTestId(`penalty-row-${pending!.id}`)
    await row.getByRole('button', { name: 'Approve' }).click()
    await expectNotice(asTreasurer, /approved/i)
    await expect(row.getByText('APPROVED')).toBeVisible()

    // Only an approved penalty is money the member actually owes, which is also the only status
    // the credit score deducts for.
    await row.getByRole('button', { name: 'Record payment' }).click()
    await expectNotice(asTreasurer, /settled/i)

    await expect
      .poll(async () => {
        const settled = await queryOne<{ status: string }>('SELECT status FROM penalty WHERE id = $1', [
          pending!.id,
        ])
        return settled?.status
      })
      .toBe('PAID')
  })

  test('a treasurer waives a penalty and the reason is recorded', async ({ asTreasurer }) => {
    await issue(asTreasurer, '640', /missed meeting/i)

    const pending = await queryOne<{ id: string }>(
      `SELECT id FROM penalty WHERE chama_id = $1 AND amount = 640 ORDER BY id DESC LIMIT 1`,
      [chama],
    )

    const row = asTreasurer.getByTestId(`penalty-row-${pending!.id}`)
    await row.getByRole('button', { name: 'Waive' }).click()
    await asTreasurer.locator('#waiver-reason').fill('Hospitalised on the meeting date')
    await asTreasurer.getByRole('button', { name: 'Waive penalty' }).click()

    await expectNotice(asTreasurer, /waived/i)

    const waived = await queryOne<{ status: string; waiver_reason: string }>(
      'SELECT status, waiver_reason FROM penalty WHERE id = $1',
      [pending!.id],
    )
    expect(waived?.status).toBe('WAIVED')
    // The reason is the point of waiving through the product rather than through the database.
    expect(waived?.waiver_reason).toBe('Hospitalised on the meeting date')
  })

  test('a member sees their own penalties and can act on none of them', async ({ asMember }) => {
    await asMember.goto(`/chamas/${chama}/penalties`)
    await expect(asMember.getByTestId('page-penalties')).toBeVisible()

    await expect(asMember.getByRole('button', { name: 'Issue penalty' })).toHaveCount(0)
    await expect(asMember.getByRole('button', { name: 'Approve' })).toHaveCount(0)
    await expect(asMember.getByRole('button', { name: 'Waive' })).toHaveCount(0)

    // The member view is a different endpoint, not the managers' list with the buttons hidden.
    const forbidden = await api.get(asMember, `/api/chamas/${chama}/penalties`)
    expect(forbidden.status()).toBe(403)
    const own = await api.get(asMember, `/api/chamas/${chama}/penalties/mine`)
    expect(own.status()).toBe(200)
  })

  test('a member cannot issue a penalty against anyone', async ({ asMember }) => {
    const response = await api.post(asMember, `/api/chamas/${chama}/penalties`, {
      memberId: FIXTURE.member.barakaMember,
      reason: 'OTHER',
      amount: 100,
    })
    expect(response.status()).toBe(403)
  })
})
