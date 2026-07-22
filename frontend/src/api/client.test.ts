import { describe, it, expect } from 'vitest'
import axios from 'axios'
import { extractErrorMessage } from './client'

function makeAxiosError(data: unknown, message = 'Request failed') {
  const error = new Error(message) as Error & {
    isAxiosError: boolean
    response?: { data: unknown }
  }
  error.isAxiosError = true
  error.response = { data }
  return error
}

describe('extractErrorMessage', () => {
  it('returns the message of a plain Error when it is not an axios error', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns a generic fallback for a non-Error, non-axios value', () => {
    expect(extractErrorMessage('just a string')).toBe('Something went wrong. Please try again.')
  })

  it('falls back to err.message when the axios error has no response data', () => {
    const error = new Error('network error') as Error & { isAxiosError: boolean }
    error.isAxiosError = true
    expect(extractErrorMessage(error)).toBe('network error')
  })

  it('prefers userMessage from a structured ApiErrorResponse', () => {
    const error = makeAxiosError({ userMessage: 'Invalid phone number', technicalMessage: 'raw stack' })
    expect(extractErrorMessage(error)).toBe('Invalid phone number')
  })

  it('falls back to message when userMessage is absent', () => {
    const error = makeAxiosError({ message: 'Bad request' })
    expect(extractErrorMessage(error)).toBe('Bad request')
  })

  it('falls back to error field when message is absent', () => {
    const error = makeAxiosError({ error: 'Unauthorized' })
    expect(extractErrorMessage(error)).toBe('Unauthorized')
  })

  it('returns the data directly when it is a plain string', () => {
    const error = makeAxiosError('plain text error body')
    expect(extractErrorMessage(error)).toBe('plain text error body')
  })

  it('returns a generic fallback for an unrecognized data shape', () => {
    const error = makeAxiosError({ somethingElse: true })
    expect(extractErrorMessage(error)).toBe('Something went wrong. Please try again.')
  })

  it('uses axios.isAxiosError to distinguish real axios errors', () => {
    expect(axios.isAxiosError(makeAxiosError({}))).toBe(true)
    expect(axios.isAxiosError(new Error('plain'))).toBe(false)
  })
})
