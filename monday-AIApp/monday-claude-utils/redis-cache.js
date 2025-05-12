/**
 * Redis Cache Utility for Monday.com Claude Integration App
 * Implements distributed caching using Redis when available
 */

const redis = require('redis');
const { promisify } = require('util');
const { Logger } = require('@mondaycom/apps-sdk');

const logger = new Logger('redis-cache');

// Redis client and promisified methods
let redisClient;
let getAsync;
let setAsync;
let delAsync;
let keysAsync;

// Default TTL for cache entries (5 minutes)
const DEFAULT_TTL = 300;

// Cache key prefix to avoid collisions
const KEY_PREFIX = 'mondayclaude:';

/**
 * Initialize Redis client if configured
 * 
 * @returns {boolean} - Whether Redis was successfully initialized
 */
function initRedis() {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    logger.info('Redis URL not configured, distributed caching will not be available');
    return false;
  }
  
  try {
    redisClient = redis.createClient({
      url: redisUrl,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis connection refused, retrying...');
          return Math.min(options.attempt * 100, 3000);
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });
    
    redisClient.on('error', (error) => {
      logger.error('Redis error', { error });
    });
    
    redisClient.on('connect', () => {
      logger.info('Connected to Redis successfully');
    });
    
    // Promisify Redis commands
    getAsync = promisify(redisClient.get).bind(redisClient);
    setAsync = promisify(redisClient.set).bind(redisClient);
    delAsync = promisify(redisClient.del).bind(redisClient);
    keysAsync = promisify(redisClient.keys).bind(redisClient);
    
    return true;
  } catch (error) {
    logger.error('Failed to initialize Redis', { error });
    return false;
  }
}

// Initialize Redis when this module is loaded
const redisEnabled = initRedis();

/**
 * Get a value from the cache
 * 
 * @param {string} key - Cache key
 * @returns {Promise<any>} - Cached value or null if not found
 */
async function getFromCache(key) {
  if (!redisEnabled) return null;
  
  try {
    const cacheKey = `${KEY_PREFIX}${key}`;
    const data = await getAsync(cacheKey);
    
    if (!data) return null;
    
    return JSON.parse(data);
  } catch (error) {
    logger.error('Error getting from Redis cache', { error, key });
    return null;
  }
}

/**
 * Set a value in the cache
 * 
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (default: 300)
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function setInCache(key, value, ttl = DEFAULT_TTL) {
  if (!redisEnabled) return false;
  
  try {
    const cacheKey = `${KEY_PREFIX}${key}`;
    await setAsync(cacheKey, JSON.stringify(value), 'EX', ttl);
    return true;
  } catch (error) {
    logger.error('Error setting in Redis cache', { error, key });
    return false;
  }
}

/**
 * Remove a value from the cache
 * 
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function removeFromCache(key) {
  if (!redisEnabled) return false;
  
  try {
    const cacheKey = `${KEY_PREFIX}${key}`;
    await delAsync(cacheKey);
    return true;
  } catch (error) {
    logger.error('Error removing from Redis cache', { error, key });
    return false;
  }
}

/**
 * Clear all cache entries with a specific prefix
 * 
 * @param {string} prefix - Key prefix to clear
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function clearCacheByPrefix(prefix) {
  if (!redisEnabled) return false;
  
  try {
    const pattern = `${KEY_PREFIX}${prefix}*`;
    const keys = await keysAsync(pattern);
    
    if (keys.length === 0) return true;
    
    await delAsync(keys);
    logger.info(`Cleared ${keys.length} cache entries with prefix: ${prefix}`);
    return true;
  } catch (error) {
    logger.error('Error clearing cache by prefix', { error, prefix });
    return false;
  }
}

module.exports = {
  getFromCache,
  setInCache,
  removeFromCache,
  clearCacheByPrefix,
  isRedisEnabled: () => redisEnabled
};
