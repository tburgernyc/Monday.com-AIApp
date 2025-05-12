/**
 * Secure Session Management Utility
 * 
 * This utility provides secure session management with Redis support,
 * token rotation, and secure cookie handling.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Logger } = require('@mondaycom/apps-sdk');
const redisCache = require('../monday-claude-utils/redis-cache');

const logger = new Logger('session-manager');

// Session configuration
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_EXPIRY = 24 * 60 * 60; // 24 hours in seconds
const SESSION_PREFIX = 'session:';
const TOKEN_ROTATION_THRESHOLD = 12 * 60 * 60; // 12 hours in seconds

/**
 * Create a new session
 * 
 * @param {Object} userData - User data to store in the session
 * @returns {Promise<Object>} - Session data including token
 */
async function createSession(userData) {
  try {
    // Generate a unique session ID
    const sessionId = crypto.randomBytes(16).toString('hex');
    
    // Create session data
    const sessionData = {
      id: sessionId,
      userId: userData.userId,
      accountId: userData.accountId,
      permissions: userData.permissions || [],
      created: Math.floor(Date.now() / 1000),
      expires: Math.floor(Date.now() / 1000) + SESSION_EXPIRY,
      lastActivity: Math.floor(Date.now() / 1000)
    };
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        sessionId,
        userId: userData.userId,
        accountId: userData.accountId
      }, 
      SESSION_SECRET, 
      { expiresIn: SESSION_EXPIRY }
    );
    
    // Store session in Redis or fallback to memory
    const cacheKey = `${SESSION_PREFIX}${sessionId}`;
    
    if (redisCache.isRedisEnabled()) {
      await redisCache.setInCache(cacheKey, sessionData, SESSION_EXPIRY);
      logger.info('Session stored in Redis', { sessionId });
    } else {
      // In a production environment, you should use Redis or another distributed cache
      // This is just a fallback for development
      global.sessionStore = global.sessionStore || {};
      global.sessionStore[sessionId] = sessionData;
      logger.warn('Redis not available, using memory store for session', { sessionId });
    }
    
    return {
      token,
      sessionId,
      expires: sessionData.expires
    };
  } catch (error) {
    logger.error('Error creating session', { error });
    throw new Error('Failed to create session');
  }
}

/**
 * Validate and get session data
 * 
 * @param {string} token - JWT token
 * @returns {Promise<Object|null>} - Session data or null if invalid
 */
async function getSession(token) {
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, SESSION_SECRET);
    const { sessionId } = decoded;
    
    if (!sessionId) {
      logger.warn('Invalid token format - missing sessionId');
      return null;
    }
    
    // Get session from Redis or fallback to memory
    const cacheKey = `${SESSION_PREFIX}${sessionId}`;
    let sessionData;
    
    if (redisCache.isRedisEnabled()) {
      sessionData = await redisCache.getFromCache(cacheKey);
    } else {
      global.sessionStore = global.sessionStore || {};
      sessionData = global.sessionStore[sessionId];
    }
    
    if (!sessionData) {
      logger.warn('Session not found', { sessionId });
      return null;
    }
    
    // Check if session has expired
    const now = Math.floor(Date.now() / 1000);
    if (sessionData.expires < now) {
      logger.info('Session expired', { sessionId });
      await invalidateSession(sessionId);
      return null;
    }
    
    // Update last activity
    sessionData.lastActivity = now;
    
    // Check if token needs rotation
    let newToken = null;
    if (now - sessionData.created > TOKEN_ROTATION_THRESHOLD) {
      // Generate new token with extended expiry
      newToken = jwt.sign(
        { 
          sessionId,
          userId: sessionData.userId,
          accountId: sessionData.accountId
        }, 
        SESSION_SECRET, 
        { expiresIn: SESSION_EXPIRY }
      );
      
      // Update session expiry
      sessionData.expires = now + SESSION_EXPIRY;
      
      logger.info('Token rotated', { sessionId });
    }
    
    // Update session in store
    if (redisCache.isRedisEnabled()) {
      await redisCache.setInCache(cacheKey, sessionData, SESSION_EXPIRY);
    } else {
      global.sessionStore[sessionId] = sessionData;
    }
    
    return {
      ...sessionData,
      newToken
    };
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      logger.warn('Invalid token', { error: error.message });
      return null;
    }
    
    logger.error('Error validating session', { error });
    throw new Error('Failed to validate session');
  }
}

/**
 * Invalidate a session
 * 
 * @param {string} sessionId - Session ID to invalidate
 * @returns {Promise<boolean>} - Whether the session was invalidated
 */
async function invalidateSession(sessionId) {
  try {
    const cacheKey = `${SESSION_PREFIX}${sessionId}`;
    
    if (redisCache.isRedisEnabled()) {
      await redisCache.removeFromCache(cacheKey);
    } else {
      global.sessionStore = global.sessionStore || {};
      delete global.sessionStore[sessionId];
    }
    
    logger.info('Session invalidated', { sessionId });
    return true;
  } catch (error) {
    logger.error('Error invalidating session', { error, sessionId });
    return false;
  }
}

/**
 * Get secure cookie options
 * 
 * @param {boolean} isSecure - Whether to require HTTPS
 * @returns {Object} - Cookie options
 */
function getSecureCookieOptions(isSecure = true) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    maxAge: SESSION_EXPIRY * 1000, // Convert to milliseconds
    path: '/'
  };
}

module.exports = {
  createSession,
  getSession,
  invalidateSession,
  getSecureCookieOptions
};
