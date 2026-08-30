import { test, expect } from '../support/test'
import { FIXTURE, queryOne } from '../support/db'
import { api } from '../support/api'
import { chooseOption, expectNotice } from '../support/actions'

/**
 * Dual sign-off on a loan above the chama's approval threshold, in chama 4.
 *
 * Chama 4 has three members holding a signing role, which is the minimum this can be tested with:
 * only a chairperson or a treasurer may sign, and the member who raised the request may not sign
 * it themselves. Carol holds TREASURER here and SECRETARY in chama 1, which is the same point the
 * isolation spec makes from the other side, that a chama role is read from member_role for the
 * chama in the path and never from the token.
 */
test.describe('loan disbursement above the approval threshold', () => {
  const chama = FIXTURE.chama.nuru
  const principal = '61000'

  test('a large loan cannot be paid out until two different people have signed', async ({
    asChairperson,
    asTreasurer,
    asSecretary,
  }) => {
    await asChairperson.goto(`/chamas/${chama}/loans`)
    await asChairperson.getByRole('button', { name: '+ Request Loan' }).click()
    await chooseOption(asChairperson, 'loan-member', 'Daniel Member')
    await asChairperson.locator('#loan-principal').fill(principal)
    await asChairperson.locator('#loan-rate').fill('14')
    await asChairperson.locator('#loan-term').fill('12')
    await asChairperson.getByRole('dialog').getByRole('button', { name: 'Request Loan' }).click()
    await expectNotice(asChairperson, /loan requested/i)

    const loan = await queryOne<{ id: string }>(
      'SELECT id FROM loan WHERE chama_id = $1 AND principal = $2 ORDER BY id DESC LIMIT 1',
      [chama, principal],
    )

    const row = asChairperson.getByRole('row').filter({ hasText: '61,000' })
    await row.getByRole('button', { name: 'Approve' }).click()
    await expectNotice(asChairperson, /approved/i)

    // Approving the loan is not permission to move the money.
    await row.getByRole('button', { name: 'Disburse' }).click()
    await expect(asChairperson.getByRole('dialog')).toContainText(/above this chama's approval threshold/i)
    await asChairperson.getByRole('dialog').getByRole('button', { name: 'Disburse' }).click()
    await expectNotice(asChairperson, /sign-off|approval is required/i)

    expect(
      (await queryOne<{ status: string }>('SELECT status FROM loan WHERE id = $1', [loan!.id]))
        ?.status,
    ).toBe('APPROVED')

    // The treasurer raises the request, which makes them the maker.
    await asTreasurer.goto(`/chamas/${chama}/approvals`)
    await asTreasurer.getByRole('button', { name: '+ Request Approval' }).click()
    await chooseOption(asTreasurer, 'approval-target-id', /Daniel Member.*61,000/)
    await chooseOption(asTreasurer, 'approval-member', 'Daniel Member')
    await asTreasurer.locator('#approval-amount').fill(principal)
    await asTreasurer.locator('#approval-reason').fill('School fees, agreed at the last meeting')
    await asTreasurer.getByRole('dialog').getByRole('button', { name: 'Request Approval' }).click()
    await expectNotice(asTreasurer, /approval request opened/i)

    const approvalRow = asTreasurer.getByRole('row').filter({ hasText: '61,000' })

    // The maker cannot supply a signature on their own request. Otherwise one treasurer could
    // raise a payout and immediately provide half of the sign-off it is meant to require.
    await approvalRow.getByRole('button', { name: 'Sign off' }).click()
    await expectNotice(asTreasurer, /cannot also sign/i)

    await asChairperson.goto(`/chamas/${chama}/approvals`)
    await asChairperson.getByRole('row').filter({ hasText: '61,000' }).getByRole('button', { name: 'Sign off' }).click()
    await expectNotice(asChairperson, /first sign-off recorded/i)

    // One signature is not enough, and the same person cannot supply the second. The page says so
    // by disabling the control, and the API enforces it independently of what the page renders.
    const signAgain = asChairperson
      .getByRole('row')
      .filter({ hasText: '61,000' })
      .getByRole('button', { name: 'Sign off' })
    await expect(signAgain).toBeDisabled()
    await expect(signAgain).toHaveAttribute('title', /different signatory/i)

    const pending = await queryOne<{ id: string }>(
      `SELECT id FROM approval
        WHERE chama_id = $1 AND target_type = 'LOAN_DISBURSEMENT' AND target_id = $2
        ORDER BY id DESC LIMIT 1`,
      [chama, loan!.id],
    )
    const secondBySamePerson = await api.put(
      asChairperson,
      `/api/chamas/${chama}/approvals/${pending!.id}/approve`,
    )
    expect(secondBySamePerson.status()).toBe(400)

    await asSecretary.goto(`/chamas/${chama}/approvals`)
    await asSecretary.getByRole('row').filter({ hasText: '61,000' }).getByRole('button', { name: 'Sign off' }).click()
    await expectNotice(asSecretary, /dual sign-off cleared/i)

    const approval = await queryOne<{ status: string; first_approver_id: string; second_approver_id: string }>(
      `SELECT status, first_approver_id, second_approver_id
         FROM approval
        WHERE chama_id = $1 AND target_type = 'LOAN_DISBURSEMENT' AND target_id = $2
        ORDER BY id DESC LIMIT 1`,
      [chama, loan!.id],
    )
    expect(approval?.status).toBe('APPROVED')
    expect(approval?.first_approver_id).not.toBe(approval?.second_approver_id)

    await asChairperson.goto(`/chamas/${chama}/loans`)
    const cleared = asChairperson.getByRole('row').filter({ hasText: '61,000' })
    await cleared.getByRole('button', { name: 'Disburse' }).click()
    await asChairperson.getByRole('dialog').getByRole('button', { name: 'Disburse' }).click()
    await expectNotice(asChairperson, /sent|disbursed/i)

    expect(
      (await queryOne<{ status: string }>('SELECT status FROM loan WHERE id = $1', [loan!.id]))
        ?.status,
    ).toBe('DISBURSEMENT_PENDING')
  })
})
