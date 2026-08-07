import { describe, it, expect, vi, afterEach } from 'vitest'
import { downloadCsv } from './csv'

describe('downloadCsv', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('quotes and escapes cells containing commas, quotes, or newlines', async () => {
    const capturedText = new Promise<string>((resolve) => {
      URL.createObjectURL = vi.fn((blob: Blob) => {
        blob.text().then(resolve)
        return 'blob:mock'
      }) as typeof URL.createObjectURL
    })
    URL.revokeObjectURL = vi.fn()

    downloadCsv('report.csv', [
      ['Plain', 'Has, comma', 'Has "quote"', 'Has\nnewline'],
      [1, 2, 3, 4],
    ])

    const csv = await capturedText
    expect(csv).toBe('Plain,"Has, comma","Has ""quote""","Has\nnewline"\n1,2,3,4')
  })
})
