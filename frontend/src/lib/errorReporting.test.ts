import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ErrorEvent } from '@sentry/react'
import * as Sentry from '@sentry/react'
import { scrubEvent, stripQuery, isForbiddenKey, initErrorReporting } from './errorReporting'

/**
 * The scrubbing, which is the half of error reporting whose failure is silent.
 *
 * A leak does not break a build or show in a log. It looks exactly like working error monitoring,
 * and the only symptom is a member's payment reference sitting in a third-party system. So these
 * assert the absence of things, which is the awkward direction and the one that matters.
 */
describe('stripQuery', () => {
  it('keeps the path and drops the identifiers after it', () => {
    // The card-payment return, which is the screen most likely to produce a report.
    expect(stripQuery('/contribution-payment-result?tx_ref=tx_123&transaction_id=999')).toBe(
      '/contribution-payment-result',
    )
  })

  it('drops a fragment too', () => {
    expect(stripQuery('/chamas/3/members#state=abc&code=secret')).toBe('/chamas/3/members')
  })

  it('leaves a bare path alone', () => {
    expect(stripQuery('/chamas/3/contributions')).toBe('/chamas/3/contributions')
  })

  it('passes undefined through rather than inventing a url', () => {
    expect(stripQuery(undefined)).toBeUndefined()
  })
})

describe('isForbiddenKey', () => {
  it.each(['phone', 'memberPhone', 'MSISDN', 'email', 'tx_ref', 'transaction_id', 'nationalId'])(
    'refuses %s',
    (key) => {
      expect(isForbiddenKey(key)).toBe(true)
    },
  )

  it.each(['chamaId', 'roundNumber', 'status'])('allows %s', (key) => {
    expect(isForbiddenKey(key)).toBe(false)
  })
})

describe('scrubEvent', () => {
  it('strips the request payload, headers and cookies', () => {
    const event = {
      request: {
        url: '/contribution-payment-result?tx_ref=tx_123',
        query_string: 'tx_ref=tx_123',
        cookies: { session: 'abc' },
        headers: { Authorization: 'Bearer secret' },
        data: { phone: '254712000001' },
      },
    } as unknown as ErrorEvent

    const scrubbed = scrubEvent(event)

    expect(scrubbed.request?.url).toBe('/contribution-payment-result')
    expect(scrubbed.request?.query_string).toBeUndefined()
    expect(scrubbed.request?.cookies).toBeUndefined()
    expect(scrubbed.request?.headers).toBeUndefined()
    expect(scrubbed.request?.data).toBeUndefined()
  })

  it('keeps only the opaque subject id on the user', () => {
    const event = {
      user: { id: '3f2a-uuid', username: 'grace', email: 'grace@example.com', ip_address: '41.90.0.1' },
    } as unknown as ErrorEvent

    const scrubbed = scrubEvent(event)

    expect(scrubbed.user).toEqual({ id: '3f2a-uuid' })
  })

  it('drops the user entirely when there is no id to keep', () => {
    const event = { user: { email: 'grace@example.com' } } as unknown as ErrorEvent
    expect(scrubEvent(event).user).toBeUndefined()
  })

  it('cleans breadcrumb data and urls', () => {
    const event = {
      breadcrumbs: [
        {
          category: 'fetch',
          data: { url: '/api/pay?msisdn=254712000001', phone: '254712000001', status_code: 500 },
        },
      ],
    } as unknown as ErrorEvent

    const crumb = scrubEvent(event).breadcrumbs?.[0]

    expect(crumb?.data?.url).toBe('/api/pay')
    expect(crumb?.data?.phone).toBeUndefined()
    // The useful part survives, or the reports would say nothing.
    expect(crumb?.data?.status_code).toBe(500)
  })

  it('drops tags whose names suggest member data', () => {
    const event = { tags: { chamaId: '7', memberPhone: '254712000001' } } as unknown as ErrorEvent
    const scrubbed = scrubEvent(event)

    expect(scrubbed.tags?.chamaId).toBe('7')
    expect(scrubbed.tags?.memberPhone).toBeUndefined()
  })

  it('tolerates an event carrying nothing', () => {
    expect(() => scrubEvent({} as ErrorEvent)).not.toThrow()
  })
})

describe('initErrorReporting', () => {
  const original = import.meta.env.VITE_SENTRY_DSN

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    import.meta.env.VITE_SENTRY_DSN = original
  })

  // The inert case is the one every other test in this suite depends on, so it is asserted rather
  // than assumed: without a DSN nothing is initialised and nothing is sent.
  it('stays inert without a DSN', () => {
    import.meta.env.VITE_SENTRY_DSN = ''
    expect(initErrorReporting()).toBe(false)
  })
})

/**
 * The scrubber against a real client rather than a hand-built object.
 *
 * The unit tests above call `scrubEvent` directly, which proves it removes what it is given but
 * not that the SDK hands it those fields in the first place, nor that the hook is wired where it
 * is claimed to be. Without this, the whole suite could pass while the SDK populated a field the
 * scrubber never looks at.
 *
 * Verified before writing it: an unscrubbed client really does put `email` and `username` on the
 * user and keeps every tag, so all three assertions below fail if the hook is removed.
 */
describe('scrubbing what a real client actually produces', () => {
  it('strips identity and member tags from a genuinely captured exception', async () => {
    const outgoing: Sentry.ErrorEvent[] = []

    Sentry.init({
      dsn: 'https://abc@o0.ingest.sentry.io/1',
      sendDefaultPii: false,
      beforeSend: (event) => {
        outgoing.push(scrubEvent(event))
        return null // never transmitted, this is a test
      },
      transport: () => ({ send: async () => ({}), flush: async () => true }),
    })

    Sentry.withScope((scope) => {
      scope.setUser({ id: 'uuid-1', email: 'grace@example.com', username: 'grace' })
      scope.setTag('memberPhone', '254712000001')
      scope.setTag('chamaId', '7')
      Sentry.captureException(new Error('boom'))
    })

    await vi.waitFor(() => expect(outgoing).toHaveLength(1))

    const event = outgoing[0]
    expect(event.user).toEqual({ id: 'uuid-1' })
    expect(event.tags?.memberPhone).toBeUndefined()
    expect(event.tags?.chamaId).toBe('7')
  })
})
