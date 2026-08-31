import { test, expect } from '../support/test'
import { FIXTURE, queryOne } from '../support/db'
import { api } from '../support/api'

/**
 * Self-service documents in chama 11, which this file owns.
 *
 * The gate matters more than the rendering here: a member may receipt their own contribution and
 * nobody else's, and asking twice must not file a second receipt against one payment.
 */
test.describe('self-service documents', () => {
  const chama = FIXTURE.chama.mwanzo
  const ownContribution = 302
  const someoneElsesContribution = 301

  test('a member downloads a receipt for their own contribution', async ({ asMember }) => {
    await asMember.goto(`/chamas/${chama}/contributions`)

    const download = asMember.waitForEvent('download')
    await asMember.getByRole('button', { name: 'Receipt' }).first().click()

    expect((await download).suggestedFilename()).toMatch(/^CR-\d{4}-\d{2}-\d+\.pdf$/)

    const doc = await queryOne<{ document_type: string; member_id: string }>(
      'SELECT document_type, member_id FROM generated_document WHERE contribution_id = $1',
      [ownContribution],
    )
    expect(doc?.document_type).toBe('CONTRIBUTION_RECEIPT')
    expect(String(doc?.member_id)).toBe(String(FIXTURE.member.mwanzoMember))
  })

  test('asking twice does not file a second receipt', async ({ asMember }) => {
    const first = await api.post(
      asMember,
      `/api/chamas/${chama}/contributions/${ownContribution}/documents/receipt`,
    )
    const second = await api.post(
      asMember,
      `/api/chamas/${chama}/contributions/${ownContribution}/documents/receipt`,
    )

    // 200 on the second call, and the same document number, rather than a fresh receipt.
    expect(second.status()).toBe(200)
    expect((await second.json()).documentNumber).toBe((await first.json()).documentNumber)

    const filed = await queryOne<{ count: string }>(
      'SELECT count(*) AS count FROM generated_document WHERE contribution_id = $1',
      [ownContribution],
    )
    expect(Number(filed?.count)).toBe(1)
  })

  test('a member cannot receipt somebody else, and the refusal files nothing', async ({ asMember }) => {
    const response = await api.post(
      asMember,
      `/api/chamas/${chama}/contributions/${someoneElsesContribution}/documents/receipt`,
    )
    expect(response.status()).toBe(403)

    const filed = await queryOne<{ count: string }>(
      'SELECT count(*) AS count FROM generated_document WHERE contribution_id = $1',
      [someoneElsesContribution],
    )
    expect(Number(filed?.count)).toBe(0)
  })

  test('the member document list holds only their own', async ({ asMember }) => {
    await api.post(asMember, `/api/chamas/${chama}/contributions/${ownContribution}/documents/receipt`)

    const mine = await api.get(asMember, `/api/chamas/${chama}/documents/mine`)
    expect(mine.status()).toBe(200)
    const documents = await mine.json()
    expect(documents.length).toBeGreaterThan(0)
    expect(documents.every((d: { memberId: number }) => d.memberId === FIXTURE.member.mwanzoMember)).toBe(true)

    // The managers' list is still treasury-only.
    const all = await api.get(asMember, `/api/chamas/${chama}/documents`)
    expect(all.status()).toBe(403)
  })
})
