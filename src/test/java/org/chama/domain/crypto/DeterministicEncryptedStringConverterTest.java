package org.chama.domain.crypto;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * @QuarkusTest so app.security.pii-encryption-key resolves from the same MicroProfile Config the
 * converter reads from at runtime (a plain unit test would have no config source for it).
 */
@QuarkusTest
class DeterministicEncryptedStringConverterTest {

    private final DeterministicEncryptedStringConverter converter = new DeterministicEncryptedStringConverter();

    @Test
    void encryptsThenDecryptsBackToTheOriginalValue() {
        String plaintext = "254712345678";
        String ciphertext = converter.convertToDatabaseColumn(plaintext);

        assertNotEquals(plaintext, ciphertext);
        assertEquals(plaintext, converter.convertToEntityAttribute(ciphertext));
    }

    @Test
    void sameInputAlwaysProducesTheSameCiphertext() {
        String plaintext = "12345678";
        assertEquals(converter.convertToDatabaseColumn(plaintext), converter.convertToDatabaseColumn(plaintext));
    }

    @Test
    void differentInputsProduceDifferentCiphertext() {
        assertNotEquals(converter.convertToDatabaseColumn("0712345678"), converter.convertToDatabaseColumn("0798765432"));
    }

    @Test
    void nullPassesThroughUnchanged() {
        assertNull(converter.convertToDatabaseColumn(null));
        assertNull(converter.convertToEntityAttribute(null));
    }

    @Test
    void preMigrationPlaintextIsReturnedAsIsRatherThanFailingToDecrypt() {
        // A phone number stored before this converter existed, never encrypted.
        assertEquals("0712345678", converter.convertToEntityAttribute("0712345678"));
    }

    @Test
    void ciphertextIsBase64EncodedAndLongerThanTheInput() {
        String ciphertext = converter.convertToDatabaseColumn("0712345678");
        assertTrue(ciphertext.length() > "0712345678".length());
        assertTrue(java.util.Base64.getDecoder().decode(ciphertext).length >= 12);
    }
}
