/**
 * Security Middleware for Monday.com Claude Integration App
 * 
 * This middleware provides enhanced security headers and protections
 * against common web vulnerabilities.
 */

const helmet = require('helmet');
const { Logger } = require('@mondaycom/apps-sdk');

const logger = new Logger('security-middleware');

/**
 * Configure security headers using helmet
 * 
 * @returns {Function} Express middleware
 */
function securityHeaders() {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "*.monday.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "*.monday.com"],
        imgSrc: ["'self'", "data:", "*.monday.com"],
        connectSrc: ["'self'", "*.monday.com", "*.anthropic.com"],
        frameSrc: ["'self'", "*.monday.com"],
        fontSrc: ["'self'", "data:", "*.monday.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: []
      }
    },
    
    // Cross-Origin Resource Policy
    crossOriginResourcePolicy: { policy: 'same-site' },
    
    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: false, // Set to false to allow embedding in monday.com iframe
    
    // Cross-Origin Opener Policy
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    
    // X-DNS-Prefetch-Control
    dnsPrefetchControl: { allow: true },
    
    // Expect-CT
    expectCt: {
      maxAge: 86400,
      enforce: true
    },
    
    // Referrer-Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
    
    // Strict-Transport-Security
    hsts: {
      maxAge: 15552000, // 180 days
      includeSubDomains: true,
      preload: true
    },
    
    // X-Content-Type-Options
    contentTypeOptions: true,
    
    // X-Frame-Options
    frameguard: {
      action: 'sameorigin'
    },
    
    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none'
    },
    
    // X-XSS-Protection
    xssFilter: true
  });
}

/**
 * Middleware to prevent clickjacking attacks
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function preventClickjacking(req, res, next) {
  // Set X-Frame-Options header to prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
}

/**
 * Middleware to add security headers for API responses
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function apiSecurityHeaders(req, res, next) {
  // Prevent browsers from interpreting files as a different MIME type
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent XSS attacks
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Strict CORS policy
  res.setHeader('Access-Control-Allow-Origin', 'https://monday.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  next();
}

/**
 * Middleware to validate and sanitize request parameters
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validateRequestParams(req, res, next) {
  try {
    // Sanitize query parameters
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
          // Basic sanitization - remove script tags
          req.query[key] = req.query[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        }
      });
    }
    
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body);
    }
    
    next();
  } catch (error) {
    logger.error('Error in request parameter validation', { error });
    next(error);
  }
}

/**
 * Recursively sanitize an object
 * 
 * @param {Object} obj - Object to sanitize
 */
function sanitizeObject(obj) {
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'string') {
      // Basic sanitization - remove script tags
      obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  });
}

module.exports = {
  securityHeaders,
  preventClickjacking,
  apiSecurityHeaders,
  validateRequestParams
};
