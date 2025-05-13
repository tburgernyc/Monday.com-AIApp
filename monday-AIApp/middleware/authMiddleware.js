/**
 * Authentication middleware for Monday.com Claude Integration App
 * Provides consistent authentication and permission checking
 */

const { Logger } = require('@mondaycom/apps-sdk');
const jwt = require('jsonwebtoken');
const config = require('../config');
const sessionManager = require('../utils/session-manager');

const logger = new Logger('auth-middleware');

/**
 * Verify Monday.com session token
 *
 * @param {string} token - Session token to verify
 * @returns {Promise<Object|null>} - Decoded token payload or null if invalid
 */
async function verifySessionToken(token) {
  try {
    if (!token) return null;

    // First try to validate as an internal session token
    const session = await sessionManager.getSession(token);
    if (session) {
      return {
        userId: session.userId,
        accountId: session.accountId,
        permissions: session.permissions,
        sessionId: session.id,
        newToken: session.newToken
      };
    }

    // If not an internal session, try as a Monday.com session token
    try {
      // Monday.com session tokens are signed JWTs
      // We can verify them using the client secret
      const decoded = jwt.verify(token, config.MONDAY_CLIENT_SECRET, {
        algorithms: ['HS256']
      });

      return decoded;
    } catch (jwtError) {
      logger.warn('Invalid Monday.com session token', { error: jwtError.message });
      return null;
    }
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
async function requireAuthentication(req, res, next) {
  try {
    // Check for session token in headers or cookies
    const sessionToken =
      req.headers['x-monday-session-token'] ||
      req.headers['authorization']?.replace('Bearer ', '') ||
      req.cookies?.sessionToken;

    if (!sessionToken) {
      return res.status(401).json({
        error: {
          type: 'authentication_error',
          message: 'Missing session token',
          userAction: 'Please log in to access this resource'
        }
      });
    }

    const tokenPayload = await verifySessionToken(sessionToken);

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

    // If token was rotated, set the new token in the response
    if (tokenPayload.newToken) {
      // Set as a secure cookie
      res.cookie('sessionToken', tokenPayload.newToken,
        sessionManager.getSecureCookieOptions(req.secure || req.headers['x-forwarded-proto'] === 'https')
      );

      // Also set in header for API clients
      res.setHeader('X-New-Session-Token', tokenPayload.newToken);
    }

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
