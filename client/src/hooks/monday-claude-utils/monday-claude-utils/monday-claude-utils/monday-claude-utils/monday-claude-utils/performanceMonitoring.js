/**
 * Performance Monitoring for Monday.com Claude Integration App
 * 
 * This utility provides performance monitoring tools to track application 
 * metrics, response times, and resource usage.
 */

const { Logger } = require('@mondaycom/apps-sdk');
const logger = new Logger('performance-monitoring');

// Simple in-memory metrics store for basic monitoring
const metrics = {
  // API call metrics
  apiCalls: {
    claude: { count: 0, totalTime: 0, errors: 0 },
    monday: { count: 0, totalTime: 0, errors: 0 }
  },
  
  // Request metrics
  requests: {
    total: 0,
    successful: 0,
    failed: 0,
    // Response time buckets in ms
    responseTimes: {
      'under100ms': 0,
      '100to500ms': 0,
      '500msto1s': 0,
      '1sto3s': 0,
      '3sto10s': 0,
      'over10s': 0
    }
  },
  
  // Cache metrics
  cache: {
    hits: 0,
    misses: 0,
    ratio: 0
  },
  
  // Rate limiting metrics
  rateLimiting: {
    limited: 0
  },
  
  // Subscription metrics
  subscriptions: {
    active: 0,
    trials: 0,
    expired: 0
  }
};

/**
 * Reset all metrics to initial values
 */
function resetMetrics() {
  metrics.apiCalls.claude = { count: 0, totalTime: 0, errors: 0 };
  metrics.apiCalls.monday = { count: 0, totalTime: 0, errors: 0 };
  
  metrics.requests.total = 0;
  metrics.requests.successful = 0;
  metrics.requests.failed = 0;
  metrics.requests.responseTimes = {
    'under100ms': 0,
    '100to500ms': 0,
    '500msto1s': 0,
    '1sto3s': 0,
    '3sto10s': 0,
    'over10s': 0
  };
  
  metrics.cache.hits = 0;
  metrics.cache.misses = 0;
  metrics.cache.ratio = 0;
  
  metrics.rateLimiting.limited = 0;
  
  metrics.subscriptions.active = 0;
  metrics.subscriptions.trials = 0;
  metrics.subscriptions.expired = 0;
}

/**
 * Get current metrics
 * @returns {Object} - Copy of current metrics
 */
function getMetrics() {
  // Return a deep copy to prevent modification
  return JSON.parse(JSON.stringify(metrics));
}

/**
 * Time tracking for measuring function execution time
 */
class Timer {
  constructor() {
    this.startTime = process.hrtime.bigint();
  }
  
  /**
   * Get elapsed time in milliseconds
   * @returns {number} - Elapsed time in ms
   */
  getElapsedTime() {
    const endTime = process.hrtime.bigint();
    const elapsedNs = endTime - this.startTime;
    return Number(elapsedNs) / 1000000; // Convert ns to ms
  }
  
  /**
   * Reset the timer
   */
  reset() {
    this.startTime = process.hrtime.bigint();
  }
}

/**
 * Measure API call performance and update metrics
 * @param {string} api - API name ('claude' or 'monday')
 * @param {Function} fn - Function to measure
 * @param {...any} args - Arguments to pass to the function
 * @returns {Promise<any>} - Result of the function call
 */
async function measureApiCall(api, fn, ...args) {
  if (!metrics.apiCalls[api]) {
    throw new Error(`Unknown API: ${api}`);
  }
  
  const timer = new Timer();
  
  try {
    const result = await fn(...args);
    
    // Update metrics
    const elapsed = timer.getElapsedTime();
    metrics.apiCalls[api].count++;
    metrics.apiCalls[api].totalTime += elapsed;
    
    return result;
  } catch (error) {
    // Record error
    metrics.apiCalls[api].errors++;
    throw error;
  }
}

/**
 * Record cache operation metrics
 * @param {boolean} isHit - Whether operation was a cache hit
 */
function recordCacheOperation(isHit) {
  if (isHit) {
    metrics.cache.hits++;
  } else {
    metrics.cache.misses++;
  }
  
  // Update hit ratio
  const total = metrics.cache.hits + metrics.cache.misses;
  metrics.cache.ratio = total > 0 ? metrics.cache.hits / total : 0;
}

/**
 * Record response time metrics
 * @param {number} time - Response time in milliseconds
 * @param {boolean} success - Whether the request was successful
 */
function recordResponseTime(time, success = true) {
  // Update request count
  metrics.requests.total++;
  
  if (success) {
    metrics.requests.successful++;
  } else {
    metrics.requests.failed++;
  }
  
  // Categorize response time
  if (time < 100) {
    metrics.requests.responseTimes.under100ms++;
  } else if (time < 500) {
    metrics.requests.responseTimes['100to500ms']++;
  } else if (time < 1000) {
    metrics.requests.responseTimes['500msto1s']++;
  } else if (time < 3000) {
    metrics.requests.responseTimes['1sto3s']++;
  } else if (time < 10000) {
    metrics.requests.responseTimes['3sto10s']++;
  } else {
    metrics.requests.responseTimes.over10s++;
  }
}

/**
 * Record rate limiting event
 */
function recordRateLimiting() {
  metrics.rateLimiting.limited++;
}

/**
 * Update subscription metrics
 * @param {Object} subscriptionData - Current subscription data
 */
function updateSubscriptionMetrics(subscriptionData) {
  if (!subscriptionData) return;
  
  // Reset subscription counts
  metrics.subscriptions.active = 0;
  metrics.subscriptions.trials = 0;
  metrics.subscriptions.expired = 0;
  
  // Update based on the provided data
  if (subscriptionData.isActive) {
    metrics.subscriptions.active++;
    
    if (subscriptionData.isOnTrial) {
      metrics.subscriptions.trials++;
    }
  } else {
    metrics.subscriptions.expired++;
  }
}

/**
 * Express middleware for performance monitoring
 * @returns {Function} - Express middleware function
 */
function performanceMiddleware() {
  return (req, res, next) => {
    // Create a timer for this request
    const timer = new Timer();
    
    // Store original end method
    const originalEnd = res.end;
    
    // Override end method to capture response time
    res.end = function(...args) {
      const responseTime = timer.getElapsedTime();
      const success = res.statusCode < 400;
      
      // Record metrics
      recordResponseTime(responseTime, success);
      
      // Add timing header if not in production
      if (process.env.NODE_ENV !== 'production') {
        res.setHeader('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      }
      
      // Log performance data
      logger.info('Request completed', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime: `${responseTime.toFixed(2)}ms`
      });
      
      // Call original end method
      return originalEnd.apply(this, args);
    };
    
    next();
  };
}

/**
 * Generate a performance report
 * @returns {Object} - Performance report object
 */
function generatePerformanceReport() {
  const claudeMetrics = metrics.apiCalls.claude;
  const mondayMetrics = metrics.apiCalls.monday;
  
  // Calculate averages
  const claudeAvgTime = claudeMetrics.count > 0 ? claudeMetrics.totalTime / claudeMetrics.count : 0;
  const mondayAvgTime = mondayMetrics.count > 0 ? mondayMetrics.totalTime / mondayMetrics.count : 0;
  
  // Calculate error rates
  const claudeErrorRate = claudeMetrics.count > 0 ? claudeMetrics.errors / claudeMetrics.count : 0;
  const mondayErrorRate = mondayMetrics.count > 0 ? mondayMetrics.errors / mondayMetrics.count : 0;
  
  // Calculate success rate
  const successRate = metrics.requests.total > 0 ? metrics.requests.successful / metrics.requests.total : 0;
  
  return {
    timestamp: new Date().toISOString(),
    apiCalls: {
      claude: {
        count: claudeMetrics.count,
        averageTimeMs: claudeAvgTime.toFixed(2),
        errorRate: (claudeErrorRate * 100).toFixed(2) + '%'
      },
      monday: {
        count: mondayMetrics.count,
        averageTimeMs: mondayAvgTime.toFixed(2),
        errorRate: (mondayErrorRate * 100).toFixed(2) + '%'
      }
    },
    requests: {
      total: metrics.requests.total,
      successful: metrics.requests.successful,
      failed: metrics.requests.failed,
      successRate: (successRate * 100).toFixed(2) + '%',
      responseTimes: metrics.requests.responseTimes
    },
    cache: {
      hits: metrics.cache.hits,
      misses: metrics.cache.misses,
      hitRatio: (metrics.cache.ratio * 100).toFixed(2) + '%'
    },
    rateLimiting: {
      occurrences: metrics.rateLimiting.limited
    },
    subscriptions: {
      active: metrics.subscriptions.active,
      trials: metrics.subscriptions.trials,
      expired: metrics.subscriptions.expired
    }
  };
}

/**
 * Decorator to measure function performance
 * @param {Function} fn - Function to measure
 * @param {string} functionName - Name for logging
 * @returns {Function} - Wrapped function
 */
function measurePerformance(fn, functionName) {
  return async function(...args) {
    const timer = new Timer();
    
    try {
      const result = await fn.apply(this, args);
      const elapsed = timer.getElapsedTime();
      
      logger.info(`Function ${functionName} executed`, {
        timeMs: elapsed.toFixed(2)
      });
      
      return result;
    } catch (error) {
      const elapsed = timer.getElapsedTime();
      
      logger.error(`Function ${functionName} failed`, {
        timeMs: elapsed.toFixed(2),
        error: error.message
      });
      
      throw error;
    }
  };
}

module.exports = {
  Timer,
  getMetrics,
  resetMetrics,
  measureApiCall,
  recordCacheOperation,
  recordResponseTime,
  recordRateLimiting,
  updateSubscriptionMetrics,
  performanceMiddleware,
  generatePerformanceReport,
  measurePerformance
};