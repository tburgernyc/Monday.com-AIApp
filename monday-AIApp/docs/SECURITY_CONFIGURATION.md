# Security Configuration Guide

This guide provides detailed instructions for configuring the security features of the Monday.com Claude Integration App.

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Session Management](#session-management)
3. [Data Encryption](#data-encryption)
4. [Secure Headers](#secure-headers)
5. [Secure Logging](#secure-logging)
6. [Best Practices](#best-practices)

## Environment Variables

The application requires several security-related environment variables to function properly.

### Required Security Variables

```
# Security configuration for encryption and session management
ENCRYPTION_KEY=your_secure_encryption_key
SESSION_SECRET=your_secure_session_secret
```

These variables should be set with secure random values. You can generate them using:

```bash
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex')); console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'));"
```

### Security Variable Descriptions

- **ENCRYPTION_KEY**: Used for encrypting sensitive data stored in the database or cache
- **SESSION_SECRET**: Used for signing session tokens and cookies

## Session Management

The application uses a secure session management system with the following features:

- Token rotation to limit the impact of token theft
- Redis-based session storage for distributed environments
- Secure cookie handling with proper flags
- Session expiration and automatic cleanup

### Configuration Options

You can configure the session management behavior by modifying the following environment variables:

```
# Optional session configuration
SESSION_EXPIRY=86400  # Session expiration time in seconds (default: 24 hours)
```

## Data Encryption

The application includes a robust encryption utility for protecting sensitive data:

- AES-256-GCM encryption for sensitive data
- HMAC signature creation and verification
- Secure token generation
- Automatic masking of sensitive data in logs

### Usage in Code

The encryption utility can be used in your custom code as follows:

```javascript
const { encrypt, decrypt } = require('./utils/encryption');

// Encrypt sensitive data
const encryptedData = encrypt({ userId: 123, apiKey: 'secret' });

// Decrypt data
const decryptedData = decrypt(encryptedData, true); // true to parse as JSON
```

## Secure Headers

The application implements comprehensive security headers to protect against common web vulnerabilities:

- Content Security Policy (CSP) to prevent XSS attacks
- X-Frame-Options to prevent clickjacking
- X-Content-Type-Options to prevent MIME type sniffing
- Strict-Transport-Security to enforce HTTPS
- Referrer-Policy to control information in HTTP referer header

### Custom CSP Configuration

If you need to customize the Content Security Policy, you can modify the `securityMiddleware.js` file.

## Secure Logging

The application includes a secure logging utility that automatically redacts sensitive information:

- Automatic redaction of API keys, tokens, and passwords
- Pattern matching to detect and mask sensitive data
- Structured logging for requests and responses
- Detailed error logging with stack traces

### Usage in Code

The secure logger can be used in your custom code as follows:

```javascript
const { createSecureLogger } = require('./utils/secure-logger');

const logger = createSecureLogger('my-component');

// Log information (sensitive data will be automatically redacted)
logger.info('User authenticated', { userId: 123, token: 'secret-token' });
```

## Best Practices

Follow these best practices to maintain the security of your application:

1. **Environment Variables**
   - Use unique values for each environment (development, staging, production)
   - Never share these values between different applications
   - Rotate these values periodically (e.g., every 90 days)
   - Store these values securely in your CI/CD pipeline secrets

2. **Session Management**
   - Keep session expiry times as short as practical
   - Implement proper logout functionality
   - Consider implementing IP-based session validation for sensitive operations

3. **Data Encryption**
   - Only encrypt data that needs to be decrypted later
   - Use hashing for passwords and other data that doesn't need to be decrypted
   - Regularly rotate encryption keys

4. **Secure Headers**
   - Regularly review and update security headers
   - Test your security headers using tools like [Security Headers](https://securityheaders.com/)
   - Consider implementing a Content Security Policy Report-Only mode first

5. **Secure Logging**
   - Regularly review logs for security events
   - Implement log rotation and retention policies
   - Consider using a centralized logging system for better analysis

## Additional Resources

- [OWASP Top Ten](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
- [Content Security Policy Reference](https://content-security-policy.com/)
