-- AUDIT_PLAN.md P2-14: member.phone/national_id become AES-GCM ciphertext (base64: a 12-byte
-- nonce + a 16-byte auth tag + the plaintext length, all base64-encoded) once
-- DeterministicEncryptedStringConverter is applied, comfortably wider than the VARCHAR(20) these
-- columns were sized for as plaintext phone/ID strings.
ALTER TABLE member ALTER COLUMN phone TYPE VARCHAR(255);
ALTER TABLE member ALTER COLUMN national_id TYPE VARCHAR(255);
