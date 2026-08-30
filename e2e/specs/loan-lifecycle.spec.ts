import { test, expect } from '../support/test'
import { FIXTURE, queryOne } from '../support/db'
import { BACKEND_URL } from '../support/env'
import { api } from '../support/api'
import { chooseOption, expectNotice } from '../support/actions'

/**
 * A loan from request to money leaving the chama, in chama 4, which this file owns.
 *
 * The payout leg is a real M-Pesa B2C call to the WireMock stub, so DarajaB2cClient runs for
 * real and only Safaricom is fake. The result callback is not stubbed, because in production
 * Safaricom pushes it: the spec plays that part, which is what exercises the state machine that
 * holds a disbursement in flight until the provider confirms.
 */
test.describe('loan lifecycle', () => {
  const chama = FIXTURE.chama.nuru

  async function requestLoan(page: import('@playwright/test').Page, principal: string) {
    await page.goto(`/chamas/${chama}/loans`)
    await page.getByRole('button', { name: '+ Request Loan' }).click()
    await chooseOption(page, 'loan-member', 'Daniel Member')
    await page.locator('#loan-principal').fill(principal)
    await page.locator('#loan-rate').fill('12')
    await page.locator('#loan-term').fill('6')
    await page.getByRole('dialog').getByRole('button', { name: 'Request Loan' }).click()
    await expectNotice(page, /loan requested/i)

    const loan = await queryOne<{ id: string; status: string }>(
      'SELECT id, status FROM loan WHERE chama_id = $1 AND principal = $2 ORDER BY id DESC LIMIT 1',
      [chama, principal],
    )
    expect(loan?.status).toBe('REQUESTED')
    return loan!.id
  }

  test('a chairperson approves a loan and disburses it by M-Pesa', async ({ asChairperson }) => {
    const loanId = await requestLoan(asChairperson, '20000')

    const row = asChairperson.getByRole('row').filter({ hasText: '20,000' })
    await row.getByRole('button', { name: 'Approve' }).click()
    await expectNotice(asChairperson, /approved/i)

    await row.getByRole('button', { name: 'Disburse' }).click()
    // Below this chama's threshold of 50,000, so it goes straight out with no second signature.
    await asChairperson.getByRole('dialog').getByRole('button', { name: 'Disburse' }).click()
    await expectNotice(asChairperson, /sent|disbursed/i)

    // The loan is claimed and the disbursement committed before Safaricom is called, so a crash
    // in between cannot lose the record and a double click cannot fire two payouts.
    const disbursement = await queryOne<{ conversation_id: string; status: string }>(
      'SELECT conversation_id, status FROM loan_disbursement WHERE loan_id = $1 ORDER BY id DESC LIMIT 1',
      [loanId],
    )
    expect(disbursement?.status).toBe('PENDING')
    expect(disbursement?.conversation_id).toMatch(/^AG_E2E_/)

    const callback = await asChairperson.request.post(`${BACKEND_URL}/api/payments/b2c-callback`, {
      data: {
        Result: {
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          OriginatorConversationID: 'OC_E2E_LIFECYCLE',
          ConversationID: disbursement!.conversation_id,
          TransactionID: 'E2EB2C001',
          ResultParameters: {
            ResultParameter: [
              { Key: 'TransactionAmount', Value: 20000 },
              { Key: 'TransactionReceipt', Value: 'E2EB2C001' },
            ],
          },
        },
      },
    })
    expect(callback.ok()).toBeTruthy()

    await expect
      .poll(
        async () =>
          (await queryOne<{ status: string }>('SELECT status FROM loan WHERE id = $1', [loanId]))
            ?.status,
        { message: 'the provider result should settle the loan', timeout: 15_000 },
      )
      .toBe('DISBURSED')
  })

  test('a chairperson rejects a loan', async ({ asChairperson }) => {
    const loanId = await requestLoan(asChairperson, '31000')

    const row = asChairperson.getByRole('row').filter({ hasText: '31,000' })
    await row.getByRole('button', { name: 'Reject' }).click()
    await expectNotice(asChairperson, /rejected/i)

    const rejected = await queryOne<{ status: string }>('SELECT status FROM loan WHERE id = $1', [
      loanId,
    ])
    expect(rejected?.status).toBe('REJECTED')
  })

  test('a plain member can request a loan but not approve one', async ({ asMember }) => {
    await asMember.goto(`/chamas/${chama}/loans`)
    await expect(asMember.getByRole('heading', { name: 'My Loans' })).toBeVisible()

    // No member picker for a plain member: they can only borrow on their own behalf.
    await asMember.getByRole('button', { name: '+ Request Loan' }).click()
    await expect(asMember.locator('#loan-member')).toHaveCount(0)
    await asMember.locator('#loan-principal').fill('4200')
    await asMember.locator('#loan-rate').fill('10')
    await asMember.locator('#loan-term').fill('3')
    await asMember.getByRole('dialog').getByRole('button', { name: 'Request Loan' }).click()
    await expectNotice(asMember, /loan requested/i)

    const own = await queryOne<{ id: string }>(
      'SELECT id FROM loan WHERE chama_id = $1 AND principal = 4200 ORDER BY id DESC LIMIT 1',
      [chama],
    )
    const response = await api.put(asMember, `/api/chamas/${chama}/loans/${own!.id}/approve`)
    expect(response.status()).toBe(403)
  })
})
