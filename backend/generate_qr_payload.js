const crypto = require('crypto');

const FIELD_ENCRYPTION_KEY = '63a7f98d42e1c0b3d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const VERSION = 'v2';

function encrypt(text) {
  const key = Buffer.from(FIELD_ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag().toString('hex');
  
  return `${VERSION}:${iv.toString('hex')}:${tag}:${encrypted}`;
}

const voterId = 'VOT001';
const encryptedText = encrypt(voterId);

console.log('--------------------------------------------------');
console.log('ENCRYPTED QR DATA (VOT001)');
console.log('--------------------------------------------------');
console.log(encryptedText);
console.log('--------------------------------------------------');
