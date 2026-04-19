const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const FIELD_ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY;
const version = 'v2';
const ivLength = 12;

if (!FIELD_ENCRYPTION_KEY) {
  console.error('❌ Error: FIELD_ENCRYPTION_KEY not found in .env file.');
  process.exit(1);
}

const key = Buffer.from(FIELD_ENCRYPTION_KEY, 'hex');

/**
 * Encrypts clinical data into the system's AES-256-GCM format.
 */
function encrypt(text) {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag().toString('hex');
  
  return `${version}:${iv.toString('hex')}:${tag}:${encrypted}`;
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('--- INDIA INNOVATES SECURE QR GENERATOR ---');
  console.log('Usage: node generate_encrypted_qr.js [TYPE] [ID]');
  console.log('Example: node generate_encrypted_qr.js VOTER JDH7280183');
  console.log('Example: node generate_encrypted_qr.js AADHAR 801271369901');
  process.exit(0);
}

const type = args[0].toUpperCase();
const id = args[1];
const payload = `${type}|${id}`;

console.log(`\n🔐 Encrypting Identification...`);
console.log(`📄 Raw Data: ${payload}`);

const encryptedString = encrypt(payload);

console.log(`\n✅ SECURE QR STRING (Copy this into QRCode Monkey):`);
console.log('----------------------------------------------------');
console.log(encryptedString);
console.log('----------------------------------------------------');
console.log(`\n⚠️  Keep this string private. It is encrypted with your system key.\n`);
