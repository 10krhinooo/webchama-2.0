import { createCipheriv, createHmac } from 'node:crypto'

/**
 * Mirrors DeterministicEncryptedStringConverter, so the fixture can store member phone and
 * national id the way the application expects to read them back.
 *
 * Those columns are encrypted and their unique indexes are on the ciphertext rather than the
 * plaintext, so a fixture inserting readable values would neither match what the application
 * looks up nor exercise the constraints.
 *
 * The nonce is derived from the plaintext rather than randomly, which is what makes the output
 * deterministic and therefore uniquely indexable:
 *
 *   cipher_key = HMAC-SHA256(master, "cipher")
 *   nonce_key  = HMAC-SHA256(master, "nonce")
 *   nonce      = HMAC-SHA256(nonce_key, plaintext)[:12]
 *   stored     = base64(nonce || AES-GCM(cipher_key, nonce, plaintext) || tag)
 *
 * Computing this when the fixture loads, rather than checking in the resulting ciphertext, means
 * the fixture states the value it actually means and changing the key regenerates nothing.
 */
const NONCE_BYTES = 12
const TAG_BYTES = 16

/** Matches PII_ENCRYPTION_KEY in docker-compose.e2e.yml: 32 zero bytes. */
export const E2E_PII_KEY = process.env.E2E_PII_KEY ?? Buffer.alloc(32).toString('base64')

function subKey(master: Buffer, label: string): Buffer {
  return createHmac('sha256', master).update(label, 'utf8').digest()
}

export function encryptPii(plaintext: string, base64Key: string = E2E_PII_KEY): string {
  const master = Buffer.from(base64Key, 'base64')
  if (master.length < 32) {
    throw new Error('the PII encryption key must decode to at least 32 bytes')
  }

  const plain = Buffer.from(plaintext, 'utf8')
  const nonce = createHmac('sha256', subKey(master, 'nonce'))
    .update(plain)
    .digest()
    .subarray(0, NONCE_BYTES)

  const cipher = createCipheriv('aes-256-gcm', subKey(master, 'cipher'), nonce, {
    authTagLength: TAG_BYTES,
  })
  const body = Buffer.concat([cipher.update(plain), cipher.final()])

  return Buffer.concat([nonce, body, cipher.getAuthTag()]).toString('base64')
}
