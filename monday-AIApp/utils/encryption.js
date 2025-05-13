/**
 * Secure Data Encryption Utility
 * 
 * This utility provides methods for securely encrypting and decrypting
 * sensitive data using industry-standard algorithms.
 */

const crypto = require('crypto');
const { Logger } = require('@mondaycom/apps-sdk');

const logger = new Logger('encryption-utils');

// Get encryption key from environment or generate a secure one
// In production, this should be set in environment variables and consistent across instances
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 
  crypto.scryptSync(process.env.SESSION_SECRET || 'monday-claude-integration', 'salt', 32);

// Encryption algorithm and options
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16 bytes
const AUTH_TAG_LENGTH = 16;
const ENCODING = 'hex';

/**
 * Encrypt data using AES-256-GCM
 * 
 * @param {string|object} data - Data to encrypt
 * @returns {string} - Encrypted data in format: iv:authTag:encryptedData
 */
function encrypt(data) {
  try {
    // Convert objects to JSON strings
    const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
    
    // Generate a random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    // Encrypt the data
    let encrypted = cipher.update(dataString, 'utf8', ENCODING);
    encrypted += cipher.final(ENCODING);
    
    // Get the authentication tag
    const authTag = cipher.getAuthTag();
    
    // Return the IV, auth tag, and encrypted data as a single string
    return `${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted}`;
  } catch (error) {
    logger.error('Encryption error', { error });
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-256-GCM
 * 
 * @param {string} encryptedData - Data to decrypt in format: iv:authTag:encryptedData
 * @param {boolean} parseJson - Whether to parse the decrypted data as JSON
 * @returns {string|object} - Decrypted data
 */
function decrypt(encryptedData, parseJson = false) {
  try {
    // Split the encrypted data into its components
    const parts = encryptedData.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], ENCODING);
    const authTag = Buffer.from(parts[1], ENCODING);
    const encryptedText = parts[2];
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedText, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');
    
    // Parse as JSON if requested
    if (parseJson) {
      try {
        return JSON.parse(decrypted);
      } catch (jsonError) {
        logger.warn('Failed to parse decrypted data as JSON', { error: jsonError.message });
        return decrypted;
      }
    }
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption error', { error });
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Generate a secure random token
 * 
 * @param {number} length - Length of the token in bytes
 * @returns {string} - Random token in hex format
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a string using SHA-256
 * 
 * @param {string} data - Data to hash
 * @returns {string} - Hashed data in hex format
 */
function hashString(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Create a HMAC signature
 * 
 * @param {string} data - Data to sign
 * @param {string} key - Key to use for signing
 * @returns {string} - HMAC signature in hex format
 */
function createHmacSignature(data, key = ENCRYPTION_KEY) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Verify a HMAC signature
 * 
 * @param {string} data - Data that was signed
 * @param {string} signature - Signature to verify
 * @param {string} key - Key used for signing
 * @returns {boolean} - Whether the signature is valid
 */
function verifyHmacSignature(data, signature, key = ENCRYPTION_KEY) {
  const expectedSignature = createHmacSignature(data, key);
  
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Mask sensitive data for logging
 * 
 * @param {string} data - Sensitive data to mask
 * @param {number} visibleChars - Number of characters to show at start and end
 * @returns {string} - Masked data
 */
function maskSensitiveData(data, visibleChars = 4) {
  if (!data || data.length <= visibleChars * 2) {
    return '***';
  }
  
  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  
  return `${start}...${end}`;
}

module.exports = {
  encrypt,
  decrypt,
  generateSecureToken,
  hashString,
  createHmacSignature,
  verifyHmacSignature,
  maskSensitiveData
};
