import { test, expect } from '../support/test'
import { FIXTURE, queryOne } from '../support/db'
import { api } from '../support/api'
import { expectNotice } from '../support/actions'

/**
 * A chama's own identity, in chama 8, which this file owns.
 *
 * The logo upload is checked at the API rather than through the file picker: what is worth pinning
 * is that the bytes decide the type, not the request, and that only a chairperson can set one.
 */
test.describe('chama profile and logo', () => {
  const chama = FIXTURE.chama.salama

  // A one-pixel PNG, as its own leading bytes.
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )

  test('a chairperson records the details that appear on the chama documents', async ({ asChairperson }) => {
    await asChairperson.goto('/chamas')
    await asChairperson.getByRole('row').filter({ hasText: 'Salama Welfare' }).getByRole('button', { name: 'Edit' }).click()

    await asChairperson.locator('#chama-postal-address').fill('P.O. Box 771-00200, Nairobi')
    await asChairperson.locator('#chama-contact-email').fill('salama@example.com')
    await asChairperson.locator('#chama-registration-number').fill('CBO/2021/771')
    await asChairperson.getByRole('dialog').getByRole('button', { name: 'Save Changes' }).click()
    await expectNotice(asChairperson, /updated/i)

    const saved = await queryOne<{ postal_address: string; contact_email: string; registration_number: string }>(
      'SELECT postal_address, contact_email, registration_number FROM chama WHERE id = $1',
      [chama],
    )
    expect(saved?.postal_address).toBe('P.O. Box 771-00200, Nairobi')
    expect(saved?.contact_email).toBe('salama@example.com')
    expect(saved?.registration_number).toBe('CBO/2021/771')
  })

  test('a chairperson uploads a logo and members can read it', async ({ asChairperson, asMember }) => {
    const upload = await api.put(asChairperson, `/api/chamas/${chama}/logo`, PNG, 'image/png')
    expect(upload.status()).toBe(200)
    expect((await upload.json()).hasLogo).toBe(true)

    const read = await api.get(asMember, `/api/chamas/${chama}/logo`)
    expect(read.status()).toBe(200)
    expect(read.headers()['content-type']).toContain('image/png')
  })

  test('a file that claims to be an image and is not is refused', async ({ asChairperson }) => {
    const response = await api.put(
      asChairperson,
      `/api/chamas/${chama}/logo`,
      Buffer.from('<html><script>alert(1)</script></html>'),
      'image/png',
    )
    // Otherwise it would be served back to every member with an image content type on it.
    expect(response.status()).toBe(400)
  })

  test('a plain member cannot set the chama logo', async ({ asMember }) => {
    const response = await api.put(asMember, `/api/chamas/${chama}/logo`, PNG, 'image/png')
    expect(response.status()).toBe(403)
  })
})
