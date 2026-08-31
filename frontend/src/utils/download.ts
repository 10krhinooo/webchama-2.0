/**
 * Saves a file the browser already holds in memory.
 *
 * `utils/csv.ts` builds its own content, so it owns its own Blob; this is for bytes that arrived
 * from the API. The anchor has to be in the document when it is clicked, and the object URL is
 * released afterwards so the bytes are not pinned for the life of the tab.
 */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Saves a PDF the API returned as base64.
 *
 * Documents come back base64-encoded inside JSON rather than as a binary response, so they can be
 * previewed in an iframe without a second request. Saving one therefore means decoding it here.
 */
export function downloadBase64Pdf(filename: string, base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  downloadBlob(filename, new Blob([bytes], { type: 'application/pdf' }))
}
