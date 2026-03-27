/**
 * QR Identity Utility Functions
 * Handles Base64 encoding/decoding for TYPE|ID format
 */

/**
 * Encodes a type and id into a Base64 string
 * @param type AADHAR | PAN | VOTER
 * @param id The identification number or UUID
 * @returns Base64 string
 */
export function encodeQr(type: string, id: string): string {
  const raw = `${type.toUpperCase()}|${id}`;
  return Buffer.from(raw).toString('base64');
}

/**
 * Decodes a Base64 QR string into type and id
 * @param base64 Base64 encoded string
 * @returns Decoded object
 */
export function decodeQr(base64: string): { type: string; id: string } {
  try {
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    const [type, id] = decoded.split('|');
    
    if (!type || !id) {
      throw new Error('Invalid QR format. Expected TYPE|ID');
    }
    
    return { type: type.toUpperCase(), id };
  } catch (error) {
    throw new Error('Invalid Base64 or corrupted QR data');
  }
}
