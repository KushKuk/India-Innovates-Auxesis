import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly fieldKey: Buffer;
  private readonly searchKey: Buffer;
  private readonly ivLength = 12;
  private readonly tagLength = 16;
  private readonly version = 'v2';

  constructor(private configService: ConfigService) {
    const fieldKeyHex = this.configService.get<string>('FIELD_ENCRYPTION_KEY');
    const searchKeyHex = this.configService.get<string>('SEARCH_INDEX_KEY');

    if (!fieldKeyHex || !searchKeyHex) {
      throw new Error('Encryption keys (FIELD_ENCRYPTION_KEY, SEARCH_INDEX_KEY) must be defined in .env');
    }

    this.fieldKey = Buffer.from(fieldKeyHex, 'hex');
    this.searchKey = Buffer.from(searchKeyHex, 'hex');

    if (this.fieldKey.length !== 32 || this.searchKey.length !== 32) {
      throw new Error('Encryption keys must be 32 bytes (64 hex characters)');
    }
  }

  /**
   * Encrypts a string using AES-256-GCM with a random IV.
   * Returns a colon-separated string: v2:iv:tag:ciphertext
   */
  encrypt(text: string): string {
    if (!text) return text;
    
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.fieldKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    
    return `${this.version}:${iv.toString('hex')}:${tag}:${encrypted}`;
  }

  /**
   * Decrypts a string formatted as v2:iv:tag:ciphertext
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText || !encryptedText.startsWith(`${this.version}:`)) {
      return encryptedText;
    }

    try {
      const [version, ivHex, tagHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.fieldKey, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error.message);
      return encryptedText; // Return original if decryption fails (e.g. key mismatch or corruption)
    }
  }

  /**
   * Generates a deterministic Blind Index for a field using HMAC-SHA256.
   * Used for exact-match searches on encrypted fields.
   */
  generateBlindIndex(text: string): string {
    if (!text) return '';
    
    // Normalize text for consistent searching (trim and lowercase)
    const normalized = text.trim().toLowerCase();
    
    return crypto
      .createHmac('sha256', this.searchKey)
      .update(normalized)
      .digest('hex');
  }
}
