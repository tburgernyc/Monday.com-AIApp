#!/usr/bin/env node

/**
 * Security Key Generator
 * 
 * This script generates secure encryption keys and session secrets for use in the
 * Monday.com Claude Integration App. It outputs the values in a format that can be
 * directly copied into the .env file.
 */

const crypto = require('crypto');

// Generate a secure random encryption key (32 bytes = 256 bits, output as 64 hex chars)
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Generate a secure random session secret (32 bytes = 256 bits, output as 64 hex chars)
function generateSessionSecret() {
  return crypto.randomBytes(32).toString('hex');
}

// Main function
function main() {
  console.log('\n🔐 Monday.com Claude Integration App - Security Key Generator 🔐\n');
  
  const encryptionKey = generateEncryptionKey();
  const sessionSecret = generateSessionSecret();
  
  console.log('Generated security keys:\n');
  console.log(`ENCRYPTION_KEY=${encryptionKey}`);
  console.log(`SESSION_SECRET=${sessionSecret}`);
  
  console.log('\nInstructions:');
  console.log('1. Copy these values to your .env file');
  console.log('2. Keep these values secure and consistent across all instances of your application');
  console.log('3. Do not commit these values to version control');
  console.log('\nThese keys are used for encrypting sensitive data and securing sessions.\n');
}

// Run the script
main();
