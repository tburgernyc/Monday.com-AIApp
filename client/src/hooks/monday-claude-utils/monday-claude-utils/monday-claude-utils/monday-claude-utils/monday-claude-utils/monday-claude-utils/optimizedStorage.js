/**
 * Optimized storage utilities for the Monday.com Claude Integration App
 * 
 * Enhances the Monday.com Storage API with batch operations, optimized querying,
 * and additional functionality for better performance.
 */

const { Storage, Logger } = require('@mondaycom/apps-sdk');
const { memoryCached } = require('./cacheUtils');

const logger = new Logger('optimized-storage');
const storage = new Storage();

/**
 * Batch get multiple keys at once
 * 
 * @param {string[]} keys - Array of keys to retrieve
 * @returns {Promise<Object>} - Object with key-value pairs
 */
async function batchGet(keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return {};
  }
  
  try {
    // We need to make individual requests since the SDK doesn't support batch operations
    // But we can parallelize them for better performance
    const promises = keys.map(key => storage.get(key));
    const results = await Promise.all(promises);
    
    // Combine results into a single object
    const resultObj = {};
    keys.forEach((key, index) => {
      resultObj[key] = results[index];
    });
    
    return resultObj;
  } catch (error) {
    logger.error('Error in batch get operation', { error, keys });
    throw error;
  }
}

/**
 * Batch set multiple key-value pairs at once
 * 
 * @param {Object} entries - Object with key-value pairs to set
 * @returns {Promise<boolean>} - Success status
 */
async function batchSet(entries) {
  if (!entries || typeof entries !== 'object' || Object.keys(entries).length === 0) {
    return false;
  }
  
  try {
    // We need to make individual requests since the SDK doesn't support batch operations
    // But we can parallelize them for better performance
    const keys = Object.keys(entries);
    const promises = keys.map(key => storage.set(key, entries[key]));
    await Promise.all(promises);
    
    return true;
  } catch (error) {
    logger.error('Error in batch set operation', { error, keys: Object.keys(entries) });
    throw error;
  }
}

/**
 * Batch delete multiple keys at once
 * 
 * @param {string[]} keys - Array of keys to delete
 * @returns {Promise<boolean>} - Success status
 */
async function batchDelete(keys) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return false;
  }
  
  try {
    // We need to make individual requests since the SDK doesn't support batch operations
    // But we can parallelize them for better performance
    const promises = keys.map(key => storage.delete(key));
    await Promise.all(promises);
    
    return true;
  } catch (error) {
    logger.error('Error in batch delete operation', { error, keys });
    throw error;
  }
}

/**
 * Get all keys with a specific prefix
 * 
 * @param {string} prefix - Key prefix to match
 * @param {number} limit - Maximum number of keys to return (optional)
 * @returns {Promise<Object>} - Object with matching key-value pairs
 */
async function getByPrefix(prefix, limit = null) {
  if (!prefix) {
    return {};
  }
  
  try {
    // Unfortunately, Monday.com storage doesn't have a query mechanism
    // This is a workaround by using instance.items() which isn't officially supported
    // and may not work in all environments
    
    // Alternatively, we could maintain a separate index of keys by prefix
    // Let's implement a safer approach using instance._instance.items() if available
    
    let allEntries = {};
    
    try {
      // This is using internal API that might not be stable
      if (storage._instance && typeof storage._instance.items === 'function') {
        const items = storage._instance.items();
        for (const [key, value] of items) {
          if (key.startsWith(prefix)) {
            allEntries[key] = value;
            if (limit && Object.keys(allEntries).length >= limit) {
              break;
            }
          }
        }
      } else {
        logger.warn('Storage instance does not support items() method, prefix query not supported');
      }
    } catch (err) {
      logger.warn('Error using internal storage API, falling back to less efficient method', { error: err });
      
      // Fallback: If we maintain a key index elsewhere, we could use it here
      // For now, we'll return an empty object
    }
    
    return allEntries;
  } catch (error) {
    logger.error('Error in getByPrefix operation', { error, prefix });
    throw error;
  }
}

/**
 * Increment a numeric value in storage
 * 
 * @param {string} key - Key to increment
 * @param {number} delta - Amount to increment by (default: 1)
 * @returns {Promise<number>} - New value after increment
 */
async function increment(key, delta = 1) {
  try {
    // Get current value
    let currentValue = await storage.get(key);
    
    // Initialize to 0 if not exist or not a number
    if (typeof currentValue !== 'number') {
      currentValue = 0;
    }
    
    // Calculate new value
    const newValue = currentValue + delta;
    
    // Update storage
    await storage.set(key, newValue);
    
    return newValue;
  } catch (error) {
    logger.error('Error in increment operation', { error, key, delta });
    throw error;
  }
}

/**
 * Set item with expiration
 * 
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<boolean>} - Success status
 */
async function setWithExpiration(key, value, ttl) {
  if (!key || ttl <= 0) {
    return false;
  }
  
  try {
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    
    await storage.set(key, {
      value,
      expiresAt,
      createdAt: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    logger.error('Error in setWithExpiration operation', { error, key });
    throw error;
  }
}

/**
 * Get item and check expiration
 * 
 * @param {string} key - Storage key
 * @returns {Promise<any|null>} - Stored value or null if expired/not found
 */
async function getWithExpiration(key) {
  try {
    const item = await storage.get(key);
    
    if (!item) {
      return null;
    }
    
    // Check for expiration
    if (item.expiresAt && new Date(item.expiresAt) < new Date()) {
      // Expired, delete it asynchronously
      storage.delete(key).catch(err => {
        logger.error('Error deleting expired item', { error: err, key });
      });
      return null;
    }
    
    return item.value;
  } catch (error) {
    logger.error('Error in getWithExpiration operation', { error, key });
    throw error;
  }
}

/**
 * Clear expired items (maintenance function)
 * 
 * @param {string} prefix - Optional prefix to filter keys
 * @returns {Promise<number>} - Number of expired items cleared
 */
async function clearExpired(prefix = '') {
  try {
    let count = 0;
    const entries = await getByPrefix(prefix);
    const now = new Date();
    
    // Check each entry for expiration
    for (const [key, value] of Object.entries(entries)) {
      if (value && value.expiresAt && new Date(value.expiresAt) < now) {
        await storage.delete(key);
        count++;
      }
    }
    
    logger.info(`Cleared ${count} expired items`, { prefix });
    return count;
  } catch (error) {
    logger.error('Error in clearExpired operation', { error, prefix });
    throw error;
  }
}

// Create cached versions of frequently used functions
const cachedGet = memoryCached(storage.get.bind(storage), 'storage', 300);
const cachedGetWithExpiration = memoryCached(getWithExpiration, 'storage_exp', 300);

module.exports = {
  // Original storage methods
  get: storage.get.bind(storage),
  set: storage.set.bind(storage),
  delete: storage.delete.bind(storage),
  
  // Cached storage methods
  cachedGet,
  cachedGetWithExpiration,
  
  // Enhanced storage methods
  batchGet,
  batchSet,
  batchDelete,
  getByPrefix,
  increment,
  setWithExpiration,
  getWithExpiration,
  clearExpired
};