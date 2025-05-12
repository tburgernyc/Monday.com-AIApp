/**
 * Prometheus Metrics for Monday.com Claude Integration App
 * Provides metrics collection for monitoring performance and usage
 */

const promClient = require('prom-client');
const { Logger } = require('@mondaycom/apps-sdk');

const logger = new Logger('metrics');

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add a default label to all metrics
register.setDefaultLabels({
  app: 'monday-claude-integration'
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// Define custom metrics

// HTTP request duration histogram
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000] // in milliseconds
});

// Claude API request duration histogram
const claudeApiRequestDurationMs = new promClient.Histogram({
  name: 'claude_api_request_duration_ms',
  help: 'Duration of Claude API requests in ms',
  labelNames: ['operation', 'status'],
  buckets: [100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000] // in milliseconds
});

// Monday.com API request duration histogram
const mondayApiRequestDurationMs = new promClient.Histogram({
  name: 'monday_api_request_duration_ms',
  help: 'Duration of Monday.com API requests in ms',
  labelNames: ['operation', 'status'],
  buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000] // in milliseconds
});

// Rate limit counter
const rateLimitCounter = new promClient.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['api']
});

// Error counter
const errorCounter = new promClient.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code']
});

// Cache hit/miss counter
const cacheCounter = new promClient.Counter({
  name: 'cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'result'] // operation: get, set, delete; result: hit, miss
});

// Active users gauge
const activeUsersGauge = new promClient.Gauge({
  name: 'active_users',
  help: 'Number of active users in the last 5 minutes'
});

// Queue size gauge
const queueSizeGauge = new promClient.Gauge({
  name: 'request_queue_size',
  help: 'Current size of the request queue'
});

// Register all metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(claudeApiRequestDurationMs);
register.registerMetric(mondayApiRequestDurationMs);
register.registerMetric(rateLimitCounter);
register.registerMetric(errorCounter);
register.registerMetric(cacheCounter);
register.registerMetric(activeUsersGauge);
register.registerMetric(queueSizeGauge);

/**
 * Middleware to collect HTTP metrics
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function metricsMiddleware(req, res, next) {
  // Skip metrics collection for the metrics endpoint itself
  if (req.path === '/metrics') {
    return next();
  }

  // Start timer
  const start = Date.now();
  
  // Record end time and metrics on response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Get route path (normalize to avoid high cardinality)
    let route = req.route ? req.route.path : req.path;
    
    // Replace route params with placeholders
    if (req.params) {
      Object.keys(req.params).forEach(param => {
        route = route.replace(req.params[param], `:${param}`);
      });
    }
    
    // Record request duration
    httpRequestDurationMicroseconds
      .labels(req.method, route, res.statusCode)
      .observe(duration);
    
    // Record rate limit hits
    if (res.statusCode === 429) {
      rateLimitCounter.labels(req.path.includes('/claude') ? 'claude' : 'monday').inc();
    }
    
    // Record errors
    if (res.statusCode >= 400) {
      errorCounter.labels(
        res.statusCode >= 500 ? 'server' : 'client',
        res.statusCode.toString()
      ).inc();
    }
  });
  
  next();
}

/**
 * Record Claude API request metrics
 * 
 * @param {string} operation - API operation name
 * @param {number} duration - Request duration in ms
 * @param {string} status - Request status (success, error)
 */
function recordClaudeApiMetrics(operation, duration, status = 'success') {
  claudeApiRequestDurationMs.labels(operation, status).observe(duration);
}

/**
 * Record Monday.com API request metrics
 * 
 * @param {string} operation - API operation name
 * @param {number} duration - Request duration in ms
 * @param {string} status - Request status (success, error)
 */
function recordMondayApiMetrics(operation, duration, status = 'success') {
  mondayApiRequestDurationMs.labels(operation, status).observe(duration);
}

/**
 * Record cache operation metrics
 * 
 * @param {string} operation - Cache operation (get, set, delete)
 * @param {string} result - Operation result (hit, miss)
 */
function recordCacheMetrics(operation, result) {
  cacheCounter.labels(operation, result).inc();
}

/**
 * Update active users count
 * 
 * @param {number} count - Number of active users
 */
function updateActiveUsers(count) {
  activeUsersGauge.set(count);
}

/**
 * Update queue size
 * 
 * @param {number} size - Current queue size
 */
function updateQueueSize(size) {
  queueSizeGauge.set(size);
}

/**
 * Get metrics in Prometheus format
 * 
 * @returns {Promise<string>} - Metrics in Prometheus format
 */
async function getMetrics() {
  return register.metrics();
}

module.exports = {
  metricsMiddleware,
  recordClaudeApiMetrics,
  recordMondayApiMetrics,
  recordCacheMetrics,
  updateActiveUsers,
  updateQueueSize,
  getMetrics
};
