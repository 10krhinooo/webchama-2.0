import { describe, it, expect, vi, afterEach } from 'vitest'
import { downloadBlob, downloadBase64Pdf } from './download'

describe('download', () => {
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL

  afterEach(() => {
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
    vi.restoreAllMocks()
  })

  it('clicks an anchor that is in the document, then releases the object URL', () => {
    URL.createObjectURL = vi.fn(() => 'blob:mock') as typeof URL.createObjectURL
    const revoke = vi.fn()
    URL.revokeObjectURL = revoke
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      // The anchor must be attached at the moment of the click, not merely created.
      expect(document.body.contains(this)).toBe(true)
      expect(this.download).toBe('receipt.pdf')
    })

    downloadBlob('receipt.pdf', new Blob(['x']))

    expect(click).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:mock')
    // And it does not leave the anchor behind in the page.
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('decodes a base64 PDF into the bytes it stands for', async () => {
    const captured: Blob[] = []
    URL.createObjectURL = vi.fn((blob: Blob) => {
      captured.push(blob)
      return 'blob:mock'
    }) as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadBase64Pdf('statement.pdf', btoa('%PDF-1.4 hello'))

    expect(captured).toHaveLength(1)
    expect(captured[0].type).toBe('application/pdf')
    expect(await captured[0].text()).toBe('%PDF-1.4 hello')
  })
})
