import * as crypto from 'crypto';

/**
 * AES-GCM-256 encryption utilities for fingerprint template storage.
 * A unique 12-byte IV is generated per record and stored alongside the ciphertext.
 *
 * Key must be 32 bytes (256-bit). Load from FINGERPRINT_ENCRYPTION_KEY env var.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for AES-GCM
const TAG_LENGTH = 16; // 128-bit authentication tag

/**
 * Encrypt a Buffer using AES-GCM-256.
 * Returns: { ciphertext, iv } — both stored in DB.
 */
export function encryptTemplate(
  plaintext: Buffer,
  keyHex: string,
): { ciphertext: Buffer; iv: string } {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Prepend auth tag to ciphertext so we can verify integrity on decrypt
  return {
    ciphertext: Buffer.concat([tag, encrypted]),
    iv: iv.toString('hex'),
  };
}

/**
 * Decrypt a Buffer using AES-GCM-256.
 * Expects ciphertext format: [16-byte auth tag][encrypted data]
 */
export function decryptTemplate(
  ciphertext: Buffer,
  ivHex: string,
  keyHex: string,
): Buffer {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');

  // Split auth tag from ciphertext
  const tag = ciphertext.subarray(0, TAG_LENGTH);
  const data = ciphertext.subarray(TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(data), decipher.final()]);
}
