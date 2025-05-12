/**
 * Request Queue Utility for Monday.com Claude Integration App
 * Implements a queue system for handling high volumes of requests gracefully
 */

const { Logger } = require('@mondaycom/apps-sdk');
const AsyncQueue = require('async/queue');

const logger = new Logger('request-queue');

// Default queue configuration
const DEFAULT_CONCURRENCY = 1; // Process one request at a time by default
const DEFAULT_COOLDOWN = 200; // 200ms cooldown between requests
const MAX_QUEUE_SIZE = 100; // Maximum queue size before rejecting new requests

// Create a queue that processes requests with controlled concurrency
const claudeQueue = AsyncQueue(async (task, callback) => {
  try {
    logger.info('Processing queued request', {
      taskId: task.id,
      queueLength: claudeQueue.length(),
      queueRunning: claudeQueue.running()
    });

    // Execute the task (API call)
    const result = await task.execute();
    task.resolve(result);
  } catch (error) {
    logger.error('Error processing queued request', {
      taskId: task.id,
      error: error.message
    });
    task.reject(error);
  } finally {
    // Signal task completion after a small delay to prevent bombarding the API
    setTimeout(() => callback(), task.cooldown || DEFAULT_COOLDOWN);
  }
}, DEFAULT_CONCURRENCY);

// Add event handlers for queue
claudeQueue.error((err, task) => {
  logger.error('Queue error', { error: err, taskId: task?.id });
});

claudeQueue.drain(() => {
  logger.info('All requests have been processed');
});

/**
 * Enqueue a request to be processed
 * 
 * @param {Function} apiCallFn - Function that makes the API call
 * @param {Object} options - Queue options
 * @param {string} options.id - Optional ID for the task
 * @param {number} options.cooldown - Cooldown time in ms after task completion
 * @param {number} options.priority - Priority of the task (lower is higher priority)
 * @param {number} options.timeout - Timeout for the task in ms
 * @returns {Promise<any>} - Result of the API call
 */
function enqueueRequest(apiCallFn, options = {}) {
  return new Promise((resolve, reject) => {
    // Check if queue is too full
    if (claudeQueue.length() >= MAX_QUEUE_SIZE) {
      const error = new Error('Request queue is full. Please try again later.');
      error.type = 'QUEUE_FULL';
      error.status = 429;
      return reject(error);
    }

    const taskId = options.id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    const task = {
      id: taskId,
      execute: apiCallFn,
      resolve,
      reject,
      cooldown: options.cooldown || DEFAULT_COOLDOWN,
      priority: options.priority || 0,
      timeout: options.timeout || 0
    };
    
    // Add timeout handling if specified
    if (task.timeout > 0) {
      task.timeoutId = setTimeout(() => {
        // Create timeout error
        const timeoutError = new Error(`Request timed out after ${task.timeout}ms`);
        timeoutError.type = 'TIMEOUT';
        timeoutError.status = 408;
        
        // Reject the promise
        task.reject(timeoutError);
        
        // Remove the task from the queue if it hasn't started yet
        claudeQueue.remove(item => item.id === task.id);
      }, task.timeout);
    }
    
    // Add to queue with priority (if specified)
    if (options.priority !== undefined) {
      claudeQueue.push(task, options.priority);
    } else {
      claudeQueue.push(task);
    }
    
    logger.info(`Request added to queue`, {
      taskId,
      queueLength: claudeQueue.length(),
      queueRunning: claudeQueue.running()
    });
  });
}

/**
 * Get current queue statistics
 * 
 * @returns {Object} - Queue statistics
 */
function getQueueStats() {
  return {
    length: claudeQueue.length(),
    running: claudeQueue.running(),
    concurrency: claudeQueue.concurrency,
    started: claudeQueue.started,
    paused: claudeQueue.paused
  };
}

/**
 * Pause the queue (will finish current task but not start new ones)
 */
function pauseQueue() {
  claudeQueue.pause();
  logger.info('Queue paused');
}

/**
 * Resume the queue
 */
function resumeQueue() {
  claudeQueue.resume();
  logger.info('Queue resumed');
}

module.exports = {
  enqueueRequest,
  getQueueStats,
  pauseQueue,
  resumeQueue
};
