/**
 * Secure Logging Utility
 * 
 * This utility extends the Monday.com Logger with additional security features
 * such as redacting sensitive information and structured logging.
 */

const { Logger } = require('@mondaycom/apps-sdk');
const { maskSensitiveData } = require('./encryption');

// Fields that should be redacted in logs
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'auth',
  'authorization',
  'api_key',
  'apiKey',
  'api-key',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'session',
  'cookie',
  'jwt',
  'credentials',
  'x-monday-session-token',
  'x-monday-api-token',
  'claude_api_key',
  'claudeApiKey',
  'openai_api_key',
  'openaiApiKey'
];

// Regular expressions for detecting sensitive data
const SENSITIVE_PATTERNS = [
  // API Keys
  /\b(sk|pk)_(test|live)_[0-9a-zA-Z]{24,}\b/g,
  // JWT Tokens
  /eyJ[a-zA-Z0-9_-]{5,}\.eyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}/g,
  // Monday.com API Tokens
  /eyJhbGciOiJIUzI1NiJ9\.[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}/g,
  // Claude API Keys
  /sk-ant-api[0-9a-zA-Z-]{10,}/g,
  // OpenAI API Keys
  /sk-[0-9a-zA-Z]{48}/g
];

/**
 * Redact sensitive information from an object
 * 
 * @param {Object} obj - Object to redact
 * @param {Array<string>} sensitiveFields - Fields to redact
 * @returns {Object} - Redacted object
 */
function redactSensitiveInfo(obj, sensitiveFields = SENSITIVE_FIELDS) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveInfo(item, sensitiveFields));
  }
  
  // Create a copy of the object to avoid modifying the original
  const redacted = { ...obj };
  
  // Redact sensitive fields
  for (const key in redacted) {
    // Check if the key is sensitive
    const isSensitive = sensitiveFields.some(field => 
      key.toLowerCase().includes(field.toLowerCase())
    );
    
    if (isSensitive && typeof redacted[key] === 'string') {
      redacted[key] = maskSensitiveData(redacted[key]);
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      // Recursively redact nested objects
      redacted[key] = redactSensitiveInfo(redacted[key], sensitiveFields);
    } else if (typeof redacted[key] === 'string') {
      // Check for sensitive patterns in string values
      let value = redacted[key];
      
      for (const pattern of SENSITIVE_PATTERNS) {
        value = value.replace(pattern, match => maskSensitiveData(match));
      }
      
      redacted[key] = value;
    }
  }
  
  return redacted;
}

/**
 * Create a secure logger instance
 * 
 * @param {string} name - Logger name
 * @returns {Object} - Secure logger instance
 */
function createSecureLogger(name) {
  const baseLogger = new Logger(name);
  
  // Create a wrapper that redacts sensitive information
  const secureLogger = {
    info: (message, data) => {
      baseLogger.info(message, data ? redactSensitiveInfo(data) : undefined);
    },
    
    warn: (message, data) => {
      baseLogger.warn(message, data ? redactSensitiveInfo(data) : undefined);
    },
    
    error: (message, data) => {
      baseLogger.error(message, data ? redactSensitiveInfo(data) : undefined);
    },
    
    debug: (message, data) => {
      baseLogger.debug(message, data ? redactSensitiveInfo(data) : undefined);
    },
    
    // Add structured logging methods
    
    /**
     * Log an API request
     * 
     * @param {Object} req - Express request object
     * @param {Object} options - Additional options
     */
    logRequest: (req, options = {}) => {
      const { level = 'info', includeHeaders = false, includeBody = false } = options;
      
      const logData = {
        requestId: req.id,
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userId: req.user?.userId
      };
      
      if (includeHeaders) {
        logData.headers = req.headers;
      }
      
      if (includeBody && req.body) {
        logData.body = req.body;
      }
      
      secureLogger[level](`API Request: ${req.method} ${req.path}`, logData);
    },
    
    /**
     * Log an API response
     * 
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Object} options - Additional options
     */
    logResponse: (req, res, responseBody, options = {}) => {
      const { level = 'info', includeBody = false } = options;
      
      const logData = {
        requestId: req.id,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime: Date.now() - req.startTime,
        userId: req.user?.userId
      };
      
      if (includeBody && responseBody) {
        logData.body = responseBody;
      }
      
      secureLogger[level](
        `API Response: ${req.method} ${req.path} ${res.statusCode}`, 
        logData
      );
    },
    
    /**
     * Log an error with stack trace and request details
     * 
     * @param {Error} error - Error object
     * @param {Object} req - Express request object
     */
    logError: (error, req) => {
      const logData = {
        requestId: req?.id,
        method: req?.method,
        path: req?.path,
        userId: req?.user?.userId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      };
      
      secureLogger.error(`Error: ${error.message}`, logData);
    }
  };
  
  return secureLogger;
}

module.exports = {
  createSecureLogger,
  redactSensitiveInfo
};
