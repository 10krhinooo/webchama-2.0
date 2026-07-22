import axios from 'axios'

export const client = axios.create({
  baseURL: '/api',
})

export function extractErrorMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : 'Something went wrong. Please try again.'
  }
  const data = err.response?.data
  if (!data) return err.message

  // Structured ApiErrorResponse (BadRequestExceptionMapper / NotFoundExceptionMapper etc.)
  if (typeof data.userMessage === 'string') return data.userMessage
  if (typeof data.message === 'string') return data.message
  if (typeof data.error === 'string') return data.error
  if (typeof data === 'string') return data
  return 'Something went wrong. Please try again.'
}
