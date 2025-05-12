/**
 * Cache Middleware for Monday.com Claude Integration App
 * Provides request caching using Redis when available
 */

const { Logger } = require('@mondaycom/apps-sdk');
const redisCache = require('../monday-claude-utils/redis-cache');
const crypto = require('crypto');

const logger = new Logger('cache-middleware');

/**
 * Generate a cache key from request parameters
 * 
 * @param {Object} req - Express request object
 * @param {string} prefix - Key prefix for the cache
 * @returns {string} - Cache key
 */
function generateCacheKey(req, prefix = '') {
  // Create a hash of the request parameters
  const hash = crypto.createHash('md5');
  
  // Add method and path
  hash.update(`${req.method}:${req.originalUrl}`);
  
  // Add query parameters if present
  if (Object.keys(req.query).length > 0) {
    hash.update(JSON.stringify(req.query));
  }
  
  // Add body parameters for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    hash.update(JSON.stringify(req.body));
  }
  
  // Add user ID if available (for user-specific caching)
  if (req.user && req.user.userId) {
    hash.update(req.user.userId);
  }
  
  // Generate the key with prefix
  return `${prefix}:${hash.digest('hex')}`;
}

/**
 * Cache middleware for GET requests
 * 
 * @param {Object} options - Cache options
 * @param {string} options.prefix - Key prefix for the cache
 * @param {number} options.ttl - Time to live in seconds
 * @param {Function} options.shouldCache - Function to determine if request should be cached
 * @returns {Function} - Express middleware function
 */
function cacheMiddleware(options = {}) {
  const {
    prefix = 'api',
    ttl = 300,
    shouldCache = () => true
  } = options;
  
  return async (req, res, next) => {
    // Only cache GET requests by default
    if (req.method !== 'GET' || !shouldCache(req)) {
      return next();
    }
    
    // Generate cache key
    const cacheKey = generateCacheKey(req, prefix);
    
    try {
      // Try to get from cache
      const cachedData = await redisCache.getFromCache(cacheKey);
      
      if (cachedData) {
        logger.info('Cache hit', { cacheKey, path: req.originalUrl });
        
        // Add cache header
        res.setHeader('X-Cache', 'HIT');
        
        // Return cached response
        return res.status(cachedData.status).json(cachedData.data);
      }
      
      // Cache miss - continue to handler
      logger.info('Cache miss', { cacheKey, path: req.originalUrl });
      res.setHeader('X-Cache', 'MISS');
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache the response
      res.json = function(data) {
        // Store in cache if successful response
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisCache.setInCache(cacheKey, {
            status: res.statusCode,
            data: data
          }, ttl).catch(error => {
            logger.error('Error caching response', { error, cacheKey });
          });
        }
        
        // Call original json method
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error('Cache middleware error', { error, path: req.originalUrl });
      next();
    }
  };
}

/**
 * Invalidate cache entries with a specific prefix
 * 
 * @param {string} prefix - Key prefix to invalidate
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function invalidateCache(prefix) {
  try {
    const result = await redisCache.clearCacheByPrefix(prefix);
    logger.info(`Cache invalidation ${result ? 'successful' : 'failed'}`, { prefix });
    return result;
  } catch (error) {
    logger.error('Error invalidating cache', { error, prefix });
    return false;
  }
}

module.exports = {
  cacheMiddleware,
  invalidateCache,
  generateCacheKey
};
