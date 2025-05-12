/**
 * Authentication middleware for Monday.com Claude Integration App
 * Provides consistent authentication and permission checking
 */

const { Logger } = require('@mondaycom/apps-sdk');
const jwt = require('jsonwebtoken');
const config = require('../config');

const logger = new Logger('auth-middleware');

/**
 * Verify Monday.com session token
 * 
 * @param {string} token - Session token to verify
 * @returns {Object|null} - Decoded token payload or null if invalid
 */
function verifySessionToken(token) {
  try {
    if (!token) return null;
    
    // Monday.com session tokens are signed JWTs
    // We can verify them using the client secret
    const decoded = jwt.verify(token, config.MONDAY_CLIENT_SECRET, {
      algorithms: ['HS256']
    });
    
    return decoded;
  } catch (error) {
    logger.error('Error verifying session token', { error });
    return null;
  }
}

/**
 * Middleware to require authentication
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requireAuthentication(req, res, next) {
  try {
    const sessionToken = req.headers['x-monday-session-token'];
    
    if (!sessionToken) {
      return res.status(401).json({ 
        error: {
          type: 'authentication_error',
          message: 'Missing session token',
          userAction: 'Please log in to access this resource'
        }
      });
    }
    
    const tokenPayload = verifySessionToken(sessionToken);
    
    if (!tokenPayload) {
      return res.status(401).json({ 
        error: {
          type: 'authentication_error',
          message: 'Invalid session token',
          userAction: 'Please log out and log back in to refresh your session'
        }
      });
    }
    
    // Add the token payload to the request for use in route handlers
    req.user = tokenPayload;
    
    next();
  } catch (error) {
    logger.error('Authentication error', { error });
    return res.status(401).json({ 
      error: {
        type: 'authentication_error',
        message: 'Authentication failed',
        userAction: 'Please try logging in again'
      }
    });
  }
}

/**
 * Middleware to require specific permissions
 * 
 * @param {string|string[]} permission - Required permission(s)
 * @returns {Function} - Express middleware function
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: {
          type: 'authentication_error',
          message: 'Not authenticated',
          userAction: 'Please log in to access this resource'
        }
      });
    }
    
    // Convert single permission to array for consistent handling
    const requiredPermissions = Array.isArray(permission) ? permission : [permission];
    
    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every(perm => {
      return req.user.permissions && req.user.permissions.includes(perm);
    });
    
    if (!hasAllPermissions) {
      return res.status(403).json({ 
        error: {
          type: 'permission_error',
          message: 'Insufficient permissions',
          userAction: 'Please contact your administrator to request access',
          requiredPermissions
        }
      });
    }
    
    next();
  };
}

module.exports = {
  verifySessionToken,
  requireAuthentication,
  requirePermission
};
