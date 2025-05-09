/**
 * Caching utilities for the Monday.com Claude Integration App
 * 
 * Provides in-memory and persistent caching mechanisms to improve performance
 * for frequently accessed data.
 */

const { Storage, Logger } = require('@mondaycom/apps-sdk');
const NodeCache = require('node-cache');

const logger = new Logger('cache-utils');
const storage = new Storage();

// Create in-memory cache with default TTL of 5 minutes
const memoryCache = new NodeCache({
  stdTTL: 300, // 5 minutes in seconds
  checkperiod: 60, // Check for expired keys every 60 seconds
  maxKeys: 1000 // Maximum number of keys in cache
});

/**
 * Get item from memory cache
 * 
 * @param {string} key - Cache key
 * @returns {any|null} - Cached value or null if not found
 */
function getFromMemoryCache(key) {
  return memoryCache.get(key) || null;
}

/**
 * Set item in memory cache
 * 
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {boolean} - Success status
 */
function setInMemoryCache(key, value, ttl = undefined) {
  return memoryCache.set(key, value, ttl);
}

/**
 * Delete item from memory cache
 * 
 * @param {string} key - Cache key
 * @returns {number} - Number of deleted entries
 */
function deleteFromMemoryCache(key) {
  return memoryCache.del(key);
}

/**
 * Flush all items from memory cache
 * 
 * @returns {void}
 */
function flushMemoryCache() {
  memoryCache.flushAll();
}

/**
 * Get stats for memory cache
 * 
 * @returns {Object} - Cache statistics
 */
function getMemoryCacheStats() {
  return memoryCache.getStats();
}

/**
 * Get item from persistent storage cache
 * 
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Cached value or null if not found/expired
 */
async function getFromStorageCache(key) {
  try {
    const cacheKey = `cache_${key}`;
    const cached = await storage.get(cacheKey);
    
    if (!cached) {
      return null;
    }
    
    // Check if cache entry has expired
    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      // Cache expired, delete it
      await storage.delete(cacheKey);
      return null;
    }
    
    return cached.value;
  } catch (error) {
    logger.error('Error retrieving from storage cache', { error, key });
    return null;
  }
}

/**
 * Set item in persistent storage cache
 * 
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (default: 1 hour)
 * @returns {Promise<boolean>} - Success status
 */
async function setInStorageCache(key, value, ttl = 3600) {
  try {
    const cacheKey = `cache_${key}`;
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    
    await storage.set(cacheKey, {
      value,
      expiresAt,
      createdAt: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    logger.error('Error setting in storage cache', { error, key });
    return false;
  }
}

/**
 * Delete item from persistent storage cache
 * 
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - Success status
 */
async function deleteFromStorageCache(key) {
  try {
    const cacheKey = `cache_${key}`;
    await storage.delete(cacheKey);
    return true;
  } catch (error) {
    logger.error('Error deleting from storage cache', { error, key });
    return false;
  }
}

/**
 * Function decorator to cache results of async functions using memory cache
 * 
 * @param {Function} fn - Function to wrap with caching
 * @param {string} keyPrefix - Prefix for cache keys
 * @param {number} ttl - Time to live in seconds
 * @returns {Function} - Wrapped function with caching
 */
function memoryCached(fn, keyPrefix, ttl = 300) {
  return async function(...args) {
    // Generate cache key from function name, prefix and arguments
    const key = `${keyPrefix}_${fn.name}_${JSON.stringify(args)}`;
    
    // Try to get from cache first
    const cached = getFromMemoryCache(key);
    if (cached !== null) {
      logger.info('Cache hit', { key });
      return cached;
    }
    
    // Cache miss, execute function
    logger.info('Cache miss', { key });
    const result = await fn.apply(this, args);
    
    // Store result in cache
    setInMemoryCache(key, result, ttl);
    
    return result;
  };
}

/**
 * Function decorator to cache results of async functions using persistent storage
 * 
 * @param {Function} fn - Function to wrap with caching
 * @param {string} keyPrefix - Prefix for cache keys
 * @param {number} ttl - Time to live in seconds
 * @returns {Function} - Wrapped function with caching
 */
function storageCached(fn, keyPrefix, ttl = 3600) {
  return async function(...args) {
    // Generate cache key from function name, prefix and arguments
    const key = `${keyPrefix}_${fn.name}_${JSON.stringify(args)}`;
    
    // Try to get from cache first
    const cached = await getFromStorageCache(key);
    if (cached !== null) {
      logger.info('Storage cache hit', { key });
      return cached;
    }
    
    // Cache miss, execute function
    logger.info('Storage cache miss', { key });
    const result = await fn.apply(this, args);
    
    // Store result in cache
    await setInStorageCache(key, result, ttl);
    
    return result;
  };
}

/**
 * Hybrid caching strategy that uses both memory and storage cache
 * 
 * @param {Function} fn - Function to wrap with caching
 * @param {string} keyPrefix - Prefix for cache keys
 * @param {number} memoryTtl - Memory cache TTL in seconds
 * @param {number} storageTtl - Storage cache TTL in seconds
 * @returns {Function} - Wrapped function with hybrid caching
 */
function hybridCached(fn, keyPrefix, memoryTtl = 300, storageTtl = 3600) {
  return async function(...args) {
    // Generate cache key
    const key = `${keyPrefix}_${fn.name}_${JSON.stringify(args)}`;
    
    // Try memory cache first (faster)
    const memCached = getFromMemoryCache(key);
    if (memCached !== null) {
      logger.info('Memory cache hit', { key });
      return memCached;
    }
    
    // Try storage cache next
    const storageCached = await getFromStorageCache(key);
    if (storageCached !== null) {
      // Store in memory cache for faster future access
      setInMemoryCache(key, storageCached, memoryTtl);
      logger.info('Storage cache hit', { key });
      return storageCached;
    }
    
    // Cache miss, execute function
    logger.info('Hybrid cache miss', { key });
    const result = await fn.apply(this, args);
    
    // Store in both caches
    setInMemoryCache(key, result, memoryTtl);
    await setInStorageCache(key, result, storageTtl);
    
    return result;
  };
}

module.exports = {
  // Memory cache methods
  getFromMemoryCache,
  setInMemoryCache,
  deleteFromMemoryCache,
  flushMemoryCache,
  getMemoryCacheStats,
  
  // Storage cache methods
  getFromStorageCache,
  setInStorageCache,
  deleteFromStorageCache,
  
  // Cache decorators
  memoryCached,
  storageCached,
  hybridCached
};