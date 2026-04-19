const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 1. Manually extract the key from your .env file
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// Use regex to safely pull out the key exactly as it is in your .env
const keyMatch = envContent.match(/FIELD_ENCRYPTION_KEY=([a-f0-9]+)/i);
if (!keyMatch) {
    console.error("❌ ERROR: Could not find FIELD_ENCRYPTION_KEY in .env");
    process.exit(1);
}

const fieldKeyHex = keyMatch[1];
const fieldKey = Buffer.from(fieldKeyHex, 'hex');

// 2. The string we want to encrypt. Default to Pranav Shukla if no argument provided
const args = process.argv.slice(2);
const dataToEncrypt = args.length > 0 ? args[0] : 'VOTER|VOT002';

// 3. Encrypt it exactly the way your backend does (EncryptionService)
const algorithm = 'aes-256-gcm';
const ivLength = 12;
const version = 'v2';

const iv = crypto.randomBytes(ivLength);
const cipher = crypto.createCipheriv(algorithm, fieldKey, iv);

let encrypted = cipher.update(dataToEncrypt, 'utf8', 'hex');
encrypted += cipher.final('hex');

const tag = cipher.getAuthTag().toString('hex');
const finalQRText = `${version}:${iv.toString('hex')}:${tag}:${encrypted}`;

console.log('\n=======================================');
console.log(`🤖 ENCRYPTED QR GENERATOR 🤖`);
console.log('=======================================');
console.log(`[Raw Data]      : ${dataToEncrypt}`);
console.log(`[QR Code Text]  :\n\n${finalQRText}\n`);
console.log('=======================================');
console.log(`You can run this script anytime to generate new ones!`);
console.log(`Example: node generate_qr.js "VOTER|VOT003"`);
