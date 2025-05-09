/**
 * Monetization handler for Monday.com Claude Integration App
 * 
 * This utility manages subscription plans, usage tracking, and feature access
 * based on subscription levels.
 */

const { Logger, Environment, SecureStorage } = require('@mondaycom/apps-sdk');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const logger = new Logger('monetization-handler');
const env = new Environment();
const secureStorage = new SecureStorage();

// Subscription plan configurations
const SUBSCRIPTION_PLANS = {
  free_trial: {
    maxRequests: 25,
    maxBoardsAccess: 5,
    featureFlags: {
      bulkOperations: false,
      customWorkflows: false,
      advancedAnalytics: false
    }
  },
  basic_plan: {
    maxRequests: 100,
    maxBoardsAccess: 10,
    featureFlags: {
      bulkOperations: false,
      customWorkflows: false,
      advancedAnalytics: false
    }
  },
  pro_plan: {
    maxRequests: 500,
    maxBoardsAccess: -1, // unlimited
    featureFlags: {
      bulkOperations: true,
      customWorkflows: true,
      advancedAnalytics: false
    }
  },
  enterprise_plan: {
    maxRequests: -1, // unlimited
    maxBoardsAccess: -1, // unlimited
    featureFlags: {
      bulkOperations: true,
      customWorkflows: true,
      advancedAnalytics: true
    }
  }
};

/**
 * Validate the webhook signature from Monday.com
 * 
 * @param {Object} req - Express request object
 * @returns {boolean} - Whether the signature is valid
 */
function validateWebhookSignature(req) {
  try {
    // Get the signature from the headers
    const signature = req.headers['x-monday-signature'];
    
    if (!signature) {
      logger.warn('Missing x-monday-signature header');
      return false;
    }
    
    // Get the signing secret from env
    const signingSecret = env.get('MONDAY_SIGNING_SECRET');
    
    if (!signingSecret) {
      logger.error('Missing MONDAY_SIGNING_SECRET environment variable');
      return false;
    }
    
    // Create the expected signature
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', signingSecret)
      .update(payload)
      .digest('hex');
    
    // Compare signatures (use timing-safe compare if available)
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (err) {
      // If lengths don't match, timingSafeEqual will throw
      logger.warn('Invalid signature format', { error: err.message });
      return false;
    }
  } catch (error) {
    logger.error('Error validating webhook signature', { error });
    return false;
  }
}

/**
 * Process a subscription event from Monday.com
 * 
 * @param {Object} event - Subscription event
 * @returns {Promise<void>}
 */
async function processSubscriptionEvent(event) {
  try {
    const { type, accountId, data } = event;
    
    logger.info('Processing subscription event', { type, accountId });
    
    // Get current subscription data or initialize a new one
    let subscription = await getSubscription(accountId);
    
    switch (type) {
      case 'app_subscription_created':
        subscription = {
          planId: data.planId,
          isActive: true,
          isOnTrial: data.isTrial,
          createdAt: new Date().toISOString(),
          expiresAt: data.expirationDate,
          usageCount: 0
        };
        break;
        
      case 'app_subscription_renewed':
        subscription.isActive = true;
        subscription.expiresAt = data.expirationDate;
        break;
        
      case 'app_subscription_changed':
        subscription.planId = data.planId;
        subscription.isActive = true;
        subscription.isOnTrial = data.isTrial;
        subscription.expiresAt = data.expirationDate;
        break;
        
      case 'app_subscription_canceled':
        subscription.isActive = false;
        break;
        
      case 'app_installed':
        // If no subscription exists, create a free trial
        if (!subscription.planId) {
          subscription = {
            planId: 'free_trial',
            isActive: true,
            isOnTrial: true,
            createdAt: new Date().toISOString(),
            // Set expiration to 14 days from now
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            usageCount: 0
          };
        }
        break;
        
      case 'app_uninstalled':
        // Mark subscription as inactive but keep the data
        subscription.isActive = false;
        break;
        
      default:
        logger.warn('Unknown subscription event type', { type });
    }
    
    // Save the updated subscription
    await saveSubscription(accountId, subscription);
    
    return;
  } catch (error) {
    logger.error('Error processing subscription event', { error });
    throw error;
  }
}

/**
 * Get the subscription for an account
 * 
 * @param {string} accountId - Monday.com account ID
 * @returns {Promise<Object>} - Subscription data
 */
async function getSubscription(accountId) {
  try {
    // Get subscription from secure storage
    const storageKey = `subscription_${accountId}`;
    const subscription = await secureStorage.get(storageKey);
    
    // Return the subscription or a default free trial
    return subscription || {
      planId: 'free_trial',
      isActive: true,
      isOnTrial: true,
      createdAt: new Date().toISOString(),
      // Set expiration to 14 days from now
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      usageCount: 0
    };
  } catch (error) {
    logger.error('Error getting subscription', { error, accountId });
    throw error;
  }
}

/**
 * Save a subscription to secure storage
 * 
 * @param {string} accountId - Monday.com account ID
 * @param {Object} subscription - Subscription data
 * @returns {Promise<void>}
 */
async function saveSubscription(accountId, subscription) {
  try {
    const storageKey = `subscription_${accountId}`;
    await secureStorage.set(storageKey, subscription);
  } catch (error) {
    logger.error('Error saving subscription', { error, accountId });
    throw error;
  }
}

/**
 * Verify a session token from Monday.com
 * 
 * @param {string} token - JWT session token
 * @returns {Object|null} - Decoded token payload or null if invalid
 */
function verifySessionToken(token) {
  try {
    // Get the signing secret
    const secret = env.get('MONDAY_SIGNING_SECRET');
    
    if (!secret) {
      logger.error('Missing MONDAY_SIGNING_SECRET environment variable');
      return null;
    }
    
    // Verify the token
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (error) {
    logger.warn('Invalid session token', { error });
    return null;
  }
}

/**
 * Check if an account is within its request limit
 * 
 * @param {string} accountId - Monday.com account ID
 * @returns {Promise<boolean>} - Whether the account is within its limit
 */
async function isWithinRequestLimit(accountId) {
  try {
    // Get the subscription
    const subscription = await getSubscription(accountId);
    
    // Check if subscription is active
    if (!subscription.isActive) {
      return false;
    }
    
    // Check if subscription has expired
    if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) {
      // Update subscription as inactive
      subscription.isActive = false;
      await saveSubscription(accountId, subscription);
      return false;
    }
    
    // Get the plan configuration
    const planConfig = SUBSCRIPTION_PLANS[subscription.planId] || SUBSCRIPTION_PLANS.free_trial;
    
    // Check if within request limit
    // -1 means unlimited requests
    return planConfig.maxRequests === -1 || subscription.usageCount < planConfig.maxRequests;
  } catch (error) {
    logger.error('Error checking request limit', { error, accountId });
    // In case of error, allow the request to proceed
    return true;
  }
}

/**
 * Increment the usage count for an account
 * 
 * @param {string} accountId - Monday.com account ID
 * @returns {Promise<number>} - New usage count
 */
async function incrementUsage(accountId) {
  try {
    // Get the subscription
    const subscription = await getSubscription(accountId);
    
    // Increment the usage count
    subscription.usageCount = (subscription.usageCount || 0) + 1;
    
    // Save the updated subscription
    await saveSubscription(accountId, subscription);
    
    return subscription.usageCount;
  } catch (error) {
    logger.error('Error incrementing usage count', { error, accountId });
    throw error;
  }
}

/**
 * Check if a feature is available for an account
 * 
 * @param {string} accountId - Monday.com account ID
 * @param {string} feature - Feature name
 * @returns {Promise<boolean>} - Whether the feature is available
 */
async function hasFeature(accountId, feature) {
  try {
    // Get the subscription
    const subscription = await getSubscription(accountId);
    
    // Check if subscription is active
    if (!subscription.isActive) {
      return false;
    }
    
    // Get the plan configuration
    const planConfig = SUBSCRIPTION_PLANS[subscription.planId] || SUBSCRIPTION_PLANS.free_trial;
    
    // Check if feature is available
    return planConfig.featureFlags[feature] === true;
  } catch (error) {
    logger.error('Error checking feature availability', { error, accountId, feature });
    // In case of error, deny feature access
    return false;
  }
}

module.exports = {
  SUBSCRIPTION_PLANS,
  validateWebhookSignature,
  processSubscriptionEvent,
  getSubscription,
  saveSubscription,
  verifySessionToken,
  isWithinRequestLimit,
  incrementUsage,
  hasFeature
};