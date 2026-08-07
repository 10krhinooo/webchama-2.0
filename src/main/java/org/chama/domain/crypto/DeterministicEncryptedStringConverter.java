package org.chama.domain.crypto;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.eclipse.microprofile.config.ConfigProvider;
import org.jboss.logging.Logger;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import java.util.Base64;

/**
 * Field-level encryption for member PII (phone, national ID) and the M-Pesa receipt number
 * (AUDIT_PLAN.md P2-14). Deterministic rather than random-IV AES-GCM: the nonce is derived from
 * HMAC-SHA256(plaintext) under a key split from the same configured secret, so the same plaintext
 * always encrypts to the same ciphertext. That's required here specifically because
 * idx_member_chama_phone/idx_member_chama_national_id are unique-per-chama DB constraints and
 * MemberRepository looks members up by exact phone/national ID; a random IV would make both
 * impossible without decrypting every row to compare. The tradeoff this accepts, same as any
 * deterministic scheme, is that two members sharing the same plaintext value produce identical
 * ciphertext, which is exactly the property the uniqueness constraint needs, but means this must
 * never be used for a column without a legitimate reason to compare values by exact match.
 *
 * <p>Backward-compatible with rows written before this converter existed: {@link
 * #convertToEntityAttribute} falls back to returning the stored value verbatim if it isn't valid
 * base64/ciphertext (i.e. still plaintext from before this migration), so existing data keeps
 * working and is transparently re-encrypted the next time that row is saved, without needing a
 * separate backfill migration or startup job.
 */
@Converter
public class DeterministicEncryptedStringConverter implements AttributeConverter<String, String> {

    private static final Logger LOG = Logger.getLogger(DeterministicEncryptedStringConverter.class);

    private static final String AES_GCM = "AES/GCM/NoPadding";
    private static final String HMAC_SHA256 = "HmacSHA256";
    private static final int GCM_TAG_BITS = 128;
    private static final int NONCE_BYTES = 12;

    private static volatile SecretKeySpec cipherKey;
    private static volatile SecretKeySpec nonceKey;

    @Override
    public String convertToDatabaseColumn(String plaintext) {
        if (plaintext == null) {
            return null;
        }
        try {
            byte[] plainBytes = plaintext.getBytes(StandardCharsets.UTF_8);
            byte[] nonce = deriveNonce(plainBytes);

            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.ENCRYPT_MODE, cipherKey(), new GCMParameterSpec(GCM_TAG_BITS, nonce));
            byte[] ciphertext = cipher.doFinal(plainBytes);

            byte[] combined = new byte[nonce.length + ciphertext.length];
            System.arraycopy(nonce, 0, combined, 0, nonce.length);
            System.arraycopy(ciphertext, 0, combined, nonce.length, ciphertext.length);
            return Base64.getEncoder().encodeToString(combined);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to encrypt field", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String stored) {
        if (stored == null) {
            return null;
        }
        try {
            byte[] combined = Base64.getDecoder().decode(stored);
            if (combined.length < NONCE_BYTES) {
                return legacyPlaintext(stored);
            }
            byte[] nonce = Arrays.copyOfRange(combined, 0, NONCE_BYTES);
            byte[] ciphertext = Arrays.copyOfRange(combined, NONCE_BYTES, combined.length);

            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.DECRYPT_MODE, cipherKey(), new GCMParameterSpec(GCM_TAG_BITS, nonce));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException | GeneralSecurityException e) {
            return legacyPlaintext(stored);
        }
    }

    private static String legacyPlaintext(String stored) {
        LOG.debugf("Value did not decode as an encrypted field, treating as pre-migration plaintext "
            + "(will be re-encrypted on next save)");
        return stored;
    }

    private static byte[] deriveNonce(byte[] plainBytes) throws GeneralSecurityException {
        Mac mac = Mac.getInstance(HMAC_SHA256);
        mac.init(nonceKey());
        return Arrays.copyOf(mac.doFinal(plainBytes), NONCE_BYTES);
    }

    private static SecretKeySpec cipherKey() throws GeneralSecurityException {
        if (cipherKey == null) {
            initKeys();
        }
        return cipherKey;
    }

    private static SecretKeySpec nonceKey() throws GeneralSecurityException {
        if (nonceKey == null) {
            initKeys();
        }
        return nonceKey;
    }

    /**
     * Splits the single configured secret into two independent keys (one for AES-GCM encryption,
     * one for HMAC nonce derivation) via HMAC-SHA256 with a fixed label, rather than reusing the
     * same key material for both primitives.
     */
    private static synchronized void initKeys() throws GeneralSecurityException {
        if (cipherKey != null && nonceKey != null) {
            return;
        }
        String base64Key = ConfigProvider.getConfig().getValue("app.security.pii-encryption-key", String.class);
        byte[] masterKey = Base64.getDecoder().decode(base64Key);
        if (masterKey.length < 32) {
            throw new IllegalStateException("app.security.pii-encryption-key must decode to at least 32 bytes");
        }
        cipherKey = new SecretKeySpec(deriveSubKey(masterKey, "cipher"), "AES");
        nonceKey = new SecretKeySpec(deriveSubKey(masterKey, "nonce"), HMAC_SHA256);
    }

    private static byte[] deriveSubKey(byte[] masterKey, String label) throws GeneralSecurityException {
        Mac mac = Mac.getInstance(HMAC_SHA256);
        mac.init(new SecretKeySpec(masterKey, HMAC_SHA256));
        return mac.doFinal(label.getBytes(StandardCharsets.UTF_8));
    }
}
