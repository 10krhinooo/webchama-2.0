import { test, expect } from '../support/test'
import { FIXTURE, queryOne } from '../support/db'
import { api } from '../support/api'
import { expectNotice, unique } from '../support/actions'

/**
 * Meetings and attendance in chama 9, which this file owns.
 *
 * Worth having as its own journey because attendance is the only input to one term of the credit
 * score, and until a meeting exists a resolution cannot be opened at all.
 */
test.describe('meetings', () => {
  const chama = FIXTURE.chama.faraja

  test('a secretary schedules a meeting and records its minutes', async ({ asSecretary }) => {
    const agenda = unique('Quarterly review')

    await asSecretary.goto(`/chamas/${chama}/meetings`)
    await asSecretary.getByRole('button', { name: /schedule meeting/i }).click()
    await asSecretary.locator('#meeting-date').fill('2026-09-12')
    await asSecretary.locator('#meeting-agenda').fill(agenda)
    await asSecretary.getByRole('dialog').getByRole('button', { name: 'Schedule' }).click()
    await expectNotice(asSecretary, /meeting scheduled/i)

    const meeting = await queryOne<{ id: string; meeting_date: string }>(
      'SELECT id, meeting_date FROM meeting WHERE chama_id = $1 ORDER BY id DESC LIMIT 1',
      [chama],
    )
    expect(meeting).toBeTruthy()

    await asSecretary.getByRole('row').filter({ hasText: agenda }).getByRole('button', { name: 'Record minutes' }).click()
    await asSecretary.locator('#meeting-minutes').fill('Agreed to raise the monthly contribution.')
    await asSecretary.getByRole('dialog').getByRole('button', { name: 'Save minutes' }).click()
    await expectNotice(asSecretary, /minutes recorded/i)

    const withMinutes = await queryOne<{ minutes: string }>('SELECT minutes FROM meeting WHERE id = $1', [
      meeting!.id,
    ])
    expect(withMinutes?.minutes).toContain('raise the monthly contribution')
  })

  test('a plain member can read the meetings but not schedule one', async ({ asMember }) => {
    await asMember.goto(`/chamas/${chama}/meetings`)
    await expect(asMember.getByTestId('page-meetings')).toBeVisible()
    await expect(asMember.getByRole('button', { name: /schedule meeting/i })).toHaveCount(0)

    const response = await api.post(asMember, `/api/chamas/${chama}/meetings`, {
      meetingDate: '2026-10-01',
      agenda: 'Should never exist',
    })
    expect(response.status()).toBe(403)
  })
})
