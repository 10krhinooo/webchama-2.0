import { test, expect } from '../support/test'
import { FIXTURE, queryOne } from '../support/db'
import { BACKEND_URL } from '../support/env'

/**
 * The full M-Pesa contribution path, end to end.
 *
 * No real provider is involved: the backend's Daraja base URL points at a WireMock service, so
 * the STK push and the later status query are answered by a stub. The request still leaves the
 * backend over HTTP and returns through MpesaService unmodified, so the client code is genuinely
 * exercised.
 *
 * The callback is not stubbed, because in production Safaricom pushes it. The spec plays that
 * role, which is what exercises the part worth testing: PaymentService treats the callback as a
 * trigger rather than a source of truth and re-queries the provider before crediting anything.
 *
 * Rate limits apply to these paths (ten STK pushes per IP per minute), so this file is
 * deliberately small and must not be parallelised without checking that budget.
 */
test.describe('M-Pesa contribution payment', () => {
  test('a member pays a pending contribution and the callback credits it', async ({ asMember }) => {
    await asMember.goto(`/chamas/${FIXTURE.chama.imani}/contributions`)

    const payLink = asMember.getByRole('button', { name: 'Pay via M-Pesa' }).first()
    await expect(payLink).toBeVisible()
    await payLink.click()

    await expect(asMember.getByRole('heading', { name: /confirm m-pesa payment/i })).toBeVisible()
    await asMember.getByRole('button', { name: /send prompt/i }).click()

    // The UI acknowledges the push; the payment is PENDING until the provider confirms.
    await expect(asMember.getByText(/check your phone/i).first()).toBeVisible()

    // provider_reference is read from the database rather than the API on purpose: PaymentDto
    // never exposes it, precisely so a client cannot forge a callback for someone else's payment.
    const payment = await queryOne<{ id: string; provider_reference: string; status: string }>(
      `SELECT id, provider_reference, status
         FROM payment
        WHERE contribution_id IS NOT NULL AND provider_reference LIKE 'ws_CO_E2E_%'
        ORDER BY id DESC
        LIMIT 1`,
    )
    expect(payment, 'an STK push should have created a pending payment row').toBeTruthy()
    expect(payment!.status).toBe('PENDING')

    // Play the provider. The handler re-queries the stub's STK status endpoint before crediting,
    // so a forged body alone is not enough to move money.
    const callback = await asMember.request.post(`${BACKEND_URL}/api/payments/mpesa-callback`, {
      data: {
        Body: {
          stkCallback: {
            MerchantRequestID: 'e2e-merchant',
            CheckoutRequestID: payment!.provider_reference,
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 5000 },
                { Name: 'MpesaReceiptNumber', Value: 'E2ERCPT001' },
                { Name: 'PhoneNumber', Value: 254700000004 },
              ],
            },
          },
        },
      },
    })
    expect(callback.ok()).toBeTruthy()

    await expect
      .poll(
        async () => {
          const row = await queryOne<{ status: string }>(
            'SELECT status FROM payment WHERE id = $1',
            [payment!.id],
          )
          return row?.status
        },
        { message: 'the callback should have moved the payment to SUCCESS', timeout: 15_000 },
      )
      .toBe('SUCCESS')

    await asMember.reload()
    await expect(asMember.getByTestId('staff-layout')).toBeVisible()
    await expect(asMember.getByText('PAID').first()).toBeVisible()
  })
})
