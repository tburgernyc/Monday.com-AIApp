/**
 * Monetization routes for Monday.com Claude Integration App
 * Enhanced with webhook signature validation, subscription event validation, and usage tracking
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Logger, Storage } = require('@mondaycom/apps-sdk');
const crypto = require('crypto');
const config = require('./config');

const logger = new Logger('monetization-routes');
const storage = new Storage();

// Constants for subscription handling
const SUBSCRIPTION_STORAGE_PREFIX = 'subscription_';
const USAGE_STORAGE_PREFIX = 'usage_';
const WEBHOOK_TIMEOUT = 300; // 5 minutes in seconds

/**
 * Validate Monday.com webhook signature
 *
 * @param {Object} req - Express request object
 * @returns {boolean} - Whether the signature is valid
 */
function validateWebhookSignature(req) {
  try {
    const signature = req.headers['x-monday-signature'];
    const timestamp = req.headers['x-monday-timestamp'];
    const body = JSON.stringify(req.body);

    if (!signature || !timestamp) {
      logger.warn('Missing signature or timestamp header');
      return false;
    }

    // Check if the webhook is too old (prevent replay attacks)
    const now = Math.floor(Date.now() / 1000);
    if (now - parseInt(timestamp, 10) > WEBHOOK_TIMEOUT) {
      logger.warn('Webhook timestamp is too old', {
        timestamp,
        now,
        diff: now - parseInt(timestamp, 10)
      });
      return false;
    }

    // Compute the expected signature
    const secret = config.MONDAY_SIGNING_SECRET;
    if (!secret) {
      logger.error('Missing Monday.com signing secret');
      return false;
    }

    const payload = `${timestamp}:${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // Try timing-safe comparison if lengths match
    if (signature.length === expectedSignature.length) {
      try {
        const isValid = crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        );

        if (!isValid) {
          logger.warn('Invalid webhook signature', {
            expected: expectedSignature.substring(0, 8) + '...',
            received: signature.substring(0, 8) + '...'
          });
        }

        return isValid;
      } catch (err) {
        logger.warn('Error in timing-safe comparison', { error: err.message });
        // Fall through to string comparison
      }
    }

    // Fallback to constant-time string comparison (less secure but handles different lengths)
    let result = 0;
    const sigA = signature.toLowerCase();
    const sigB = expectedSignature.toLowerCase();

    // Constant-time string comparison
    for (let i = 0; i < Math.max(sigA.length, sigB.length); i++) {
      const charA = i < sigA.length ? sigA.charCodeAt(i) : 0;
      const charB = i < sigB.length ? sigB.charCodeAt(i) : 0;
      result |= charA ^ charB;
    }

    const isValid = result === 0;

    if (!isValid) {
      logger.warn('Invalid webhook signature (fallback comparison)', {
        expected: expectedSignature.substring(0, 8) + '...',
        received: signature.substring(0, 8) + '...'
      });
    }

    return isValid;
  } catch (error) {
    logger.error('Error validating webhook signature', { error });
    return false;
  }
}

/**
 * Track API usage for a user
 *
 * @param {string} userId - User ID
 * @param {string} operation - Operation type (e.g., 'query', 'completion')
 * @param {number} tokens - Number of tokens used
 * @returns {Promise<Object>} - Updated usage data
 */
async function trackUsage(userId, operation, tokens = 0) {
  try {
    const usageKey = `${USAGE_STORAGE_PREFIX}${userId}`;

    // Get current usage data or initialize if not exists
    let usageData = await storage.get(usageKey) || {
      requests: {
        total: 0,
        byOperation: {},
        lastReset: Math.floor(Date.now() / 1000)
      },
      tokens: {
        total: 0,
        byOperation: {}
      }
    };

    // Update request count
    usageData.requests.total += 1;
    usageData.requests.byOperation[operation] =
      (usageData.requests.byOperation[operation] || 0) + 1;

    // Update token count if provided
    if (tokens > 0) {
      usageData.tokens.total += tokens;
      usageData.tokens.byOperation[operation] =
        (usageData.tokens.byOperation[operation] || 0) + tokens;
    }

    // Add timestamp for this usage
    usageData.lastUpdated = Math.floor(Date.now() / 1000);

    // Store updated usage data
    await storage.set(usageKey, usageData);

    return usageData;
  } catch (error) {
    logger.error('Error tracking usage', { error, userId, operation, tokens });
    throw error;
  }
}

/**
 * Check if a user has an active subscription
 *
 * @param {string} userId - User ID
 * @param {string} accountId - Account ID
 * @returns {Promise<Object>} - Subscription data or null if no active subscription
 */
async function getSubscription(userId, accountId) {
  try {
    // First check user-specific subscription
    const userSubKey = `${SUBSCRIPTION_STORAGE_PREFIX}user_${userId}`;
    let subscription = await storage.get(userSubKey);

    // If no user subscription, check account subscription
    if (!subscription) {
      const accountSubKey = `${SUBSCRIPTION_STORAGE_PREFIX}account_${accountId}`;
      subscription = await storage.get(accountSubKey);
    }

    // If no subscription found, return null
    if (!subscription) {
      return null;
    }

    // Check if subscription is active
    const now = Math.floor(Date.now() / 1000);
    if (subscription.expiresAt && subscription.expiresAt < now) {
      logger.info('Subscription expired', {
        userId,
        accountId,
        expiresAt: new Date(subscription.expiresAt * 1000).toISOString()
      });
      return null;
    }

    return subscription;
  } catch (error) {
    logger.error('Error getting subscription', { error, userId, accountId });
    throw error;
  }
}

/**
 * Check if a user has exceeded their usage limits
 *
 * @param {string} userId - User ID
 * @param {Object} subscription - Subscription data
 * @returns {Promise<Object>} - Usage status
 */
async function checkUsageLimits(userId, subscription) {
  try {
    const usageKey = `${USAGE_STORAGE_PREFIX}${userId}`;
    const usageData = await storage.get(usageKey) || {
      requests: { total: 0 },
      tokens: { total: 0 }
    };

    // Get limits from subscription
    const requestLimit = subscription?.limits?.requests || 1000; // Default limit
    const tokenLimit = subscription?.limits?.tokens || 100000; // Default limit

    // Check if limits are exceeded
    const requestsExceeded = usageData.requests.total >= requestLimit;
    const tokensExceeded = usageData.tokens.total >= tokenLimit;

    return {
      withinLimits: !requestsExceeded && !tokensExceeded,
      usage: usageData,
      limits: {
        requests: requestLimit,
        tokens: tokenLimit
      },
      exceeded: {
        requests: requestsExceeded,
        tokens: tokensExceeded
      }
    };
  } catch (error) {
    logger.error('Error checking usage limits', { error, userId });
    throw error;
  }
}

/**
 * Get subscription status
 */
router.get('/subscription', async (req, res) => {
  try {
    const userId = req.query.user_id;
    const accountId = req.query.account_id;

    if (!userId || !accountId) {
      return res.status(400).json({
        error: 'Missing required parameters: user_id and account_id'
      });
    }

    // Get subscription data
    const subscription = await getSubscription(userId, accountId);

    if (!subscription) {
      return res.status(404).json({
        error: 'No active subscription found',
        status: 'inactive'
      });
    }

    // Check usage limits
    const usageStatus = await checkUsageLimits(userId, subscription);

    // Return subscription status with usage information
    res.json({
      status: 'active',
      plan: subscription.plan,
      features: subscription.features || [],
      expiresAt: subscription.expiresAt
        ? new Date(subscription.expiresAt * 1000).toISOString()
        : null,
      usage: usageStatus.usage,
      limits: usageStatus.limits,
      withinLimits: usageStatus.withinLimits
    });
  } catch (error) {
    logger.error('Error getting subscription status', { error });
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

/**
 * Get usage statistics
 */
router.get('/usage', async (req, res) => {
  try {
    const userId = req.query.user_id;

    if (!userId) {
      return res.status(400).json({ error: 'Missing required parameter: user_id' });
    }

    // Get usage data
    const usageKey = `${USAGE_STORAGE_PREFIX}${userId}`;
    const usageData = await storage.get(usageKey);

    if (!usageData) {
      return res.json({
        requests: {
          total: 0,
          byOperation: {},
          lastReset: Math.floor(Date.now() / 1000)
        },
        tokens: {
          total: 0,
          byOperation: {}
        }
      });
    }

    // Get subscription for limits
    const accountId = req.query.account_id;
    let limits = {
      requests: 1000, // Default limit
      tokens: 100000 // Default limit
    };

    if (accountId) {
      const subscription = await getSubscription(userId, accountId);
      if (subscription && subscription.limits) {
        limits = subscription.limits;
      }
    }

    // Calculate reset date (monthly reset)
    const lastReset = usageData.requests.lastReset || Math.floor(Date.now() / 1000);
    const resetDate = new Date(lastReset * 1000);
    resetDate.setMonth(resetDate.getMonth() + 1);

    res.json({
      requests: {
        total: usageData.requests.total,
        byOperation: usageData.requests.byOperation || {},
        limit: limits.requests,
        resetDate: resetDate.toISOString()
      },
      tokens: {
        total: usageData.tokens.total,
        byOperation: usageData.tokens.byOperation || {},
        limit: limits.tokens
      },
      lastUpdated: usageData.lastUpdated
        ? new Date(usageData.lastUpdated * 1000).toISOString()
        : null
    });
  } catch (error) {
    logger.error('Error getting usage statistics', { error });
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
});

/**
 * Webhook endpoint for subscription events
 */
router.post('/webhook/subscription', express.json(), async (req, res) => {
  try {
    // Validate webhook signature
    if (!validateWebhookSignature(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;

    // Validate event structure
    if (!event || !event.type || !event.data) {
      logger.error('Invalid webhook event structure', { event });
      return res.status(400).json({ error: 'Invalid event structure' });
    }

    logger.info('Received subscription webhook', {
      type: event.type,
      accountId: event.data.account_id
    });

    // Handle different event types
    switch (event.type) {
      case 'subscription_created':
      case 'subscription_updated':
        await handleSubscriptionCreatedOrUpdated(event.data);
        break;

      case 'subscription_cancelled':
        await handleSubscriptionCancelled(event.data);
        break;

      case 'subscription_expired':
        await handleSubscriptionExpired(event.data);
        break;

      case 'trial_started':
        await handleTrialStarted(event.data);
        break;

      case 'trial_expired':
        await handleTrialExpired(event.data);
        break;

      default:
        logger.warn('Unhandled webhook event type', { type: event.type });
    }

    // Acknowledge receipt of the webhook
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error('Error processing subscription webhook', { error });
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * Handle subscription created or updated event
 *
 * @param {Object} data - Event data
 */
async function handleSubscriptionCreatedOrUpdated(data) {
  try {
    const { account_id, user_id, plan, features, expires_at } = data;

    // Create subscription object
    const subscription = {
      plan,
      features: features || [],
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt: expires_at ? Math.floor(new Date(expires_at).getTime() / 1000) : null,
      limits: getPlanLimits(plan)
    };

    // Store subscription data
    if (user_id) {
      // User-specific subscription
      await storage.set(`${SUBSCRIPTION_STORAGE_PREFIX}user_${user_id}`, subscription);
    }

    if (account_id) {
      // Account-wide subscription
      await storage.set(`${SUBSCRIPTION_STORAGE_PREFIX}account_${account_id}`, subscription);
    }

    logger.info('Subscription created/updated', {
      accountId: account_id,
      userId: user_id,
      plan
    });
  } catch (error) {
    logger.error('Error handling subscription created/updated', { error, data });
    throw error;
  }
}

/**
 * Handle subscription cancelled event
 *
 * @param {Object} data - Event data
 */
async function handleSubscriptionCancelled(data) {
  try {
    const { account_id, user_id } = data;

    // Mark subscription as cancelled but don't delete it yet
    // It will remain active until it expires

    if (user_id) {
      const userSubKey = `${SUBSCRIPTION_STORAGE_PREFIX}user_${user_id}`;
      const subscription = await storage.get(userSubKey);

      if (subscription) {
        subscription.cancelled = true;
        subscription.cancelledAt = Math.floor(Date.now() / 1000);
        await storage.set(userSubKey, subscription);
      }
    }

    if (account_id) {
      const accountSubKey = `${SUBSCRIPTION_STORAGE_PREFIX}account_${account_id}`;
      const subscription = await storage.get(accountSubKey);

      if (subscription) {
        subscription.cancelled = true;
        subscription.cancelledAt = Math.floor(Date.now() / 1000);
        await storage.set(accountSubKey, subscription);
      }
    }

    logger.info('Subscription cancelled', { accountId: account_id, userId: user_id });
  } catch (error) {
    logger.error('Error handling subscription cancelled', { error, data });
    throw error;
  }
}

/**
 * Handle subscription expired event
 *
 * @param {Object} data - Event data
 */
async function handleSubscriptionExpired(data) {
  try {
    const { account_id, user_id } = data;

    // Delete the subscription
    if (user_id) {
      await storage.delete(`${SUBSCRIPTION_STORAGE_PREFIX}user_${user_id}`);
    }

    if (account_id) {
      await storage.delete(`${SUBSCRIPTION_STORAGE_PREFIX}account_${account_id}`);
    }

    logger.info('Subscription expired', { accountId: account_id, userId: user_id });
  } catch (error) {
    logger.error('Error handling subscription expired', { error, data });
    throw error;
  }
}

/**
 * Handle trial started event
 *
 * @param {Object} data - Event data
 */
async function handleTrialStarted(data) {
  try {
    const { account_id, user_id, expires_at } = data;

    // Create trial subscription
    const subscription = {
      plan: 'trial',
      features: ['basic_requests', 'document_processing'],
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt: expires_at ? Math.floor(new Date(expires_at).getTime() / 1000) : null,
      isTrial: true,
      limits: getPlanLimits('trial')
    };

    // Store subscription data
    if (user_id) {
      await storage.set(`${SUBSCRIPTION_STORAGE_PREFIX}user_${user_id}`, subscription);
    }

    if (account_id) {
      await storage.set(`${SUBSCRIPTION_STORAGE_PREFIX}account_${account_id}`, subscription);
    }

    logger.info('Trial started', { accountId: account_id, userId: user_id });
  } catch (error) {
    logger.error('Error handling trial started', { error, data });
    throw error;
  }
}

/**
 * Handle trial expired event
 *
 * @param {Object} data - Event data
 */
async function handleTrialExpired(data) {
  try {
    const { account_id, user_id } = data;

    // Delete the trial subscription
    if (user_id) {
      await storage.delete(`${SUBSCRIPTION_STORAGE_PREFIX}user_${user_id}`);
    }

    if (account_id) {
      await storage.delete(`${SUBSCRIPTION_STORAGE_PREFIX}account_${account_id}`);
    }

    logger.info('Trial expired', { accountId: account_id, userId: user_id });
  } catch (error) {
    logger.error('Error handling trial expired', { error, data });
    throw error;
  }
}

/**
 * Get usage limits for a plan
 *
 * @param {string} plan - Plan name
 * @returns {Object} - Plan limits
 */
function getPlanLimits(plan) {
  switch (plan) {
    case 'basic':
      return {
        requests: 100,
        tokens: 10000
      };
    case 'pro':
      return {
        requests: 1000,
        tokens: 100000
      };
    case 'enterprise':
      return {
        requests: 10000,
        tokens: 1000000
      };
    case 'trial':
      return {
        requests: 50,
        tokens: 5000
      };
    default:
      return {
        requests: 10,
        tokens: 1000
      };
  }
}

/**
 * Track API usage endpoint
 */
router.post('/track-usage', express.json(), async (req, res) => {
  try {
    const { user_id, operation, tokens } = req.body;

    if (!user_id || !operation) {
      return res.status(400).json({
        error: 'Missing required parameters: user_id and operation'
      });
    }

    // Track the usage
    const usageData = await trackUsage(user_id, operation, tokens || 0);

    res.json({
      status: 'ok',
      usage: usageData
    });
  } catch (error) {
    logger.error('Error tracking usage', { error });
    res.status(500).json({ error: 'Failed to track usage' });
  }
});

/**
 * Reset usage for a user (admin only)
 */
router.post('/reset-usage', express.json(), async (req, res) => {
  try {
    const { user_id, admin_key } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'Missing required parameter: user_id' });
    }

    // Validate admin key
    if (admin_key !== config.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Invalid admin key' });
    }

    // Reset usage data
    const usageKey = `${USAGE_STORAGE_PREFIX}${user_id}`;
    await storage.delete(usageKey);

    logger.info('Usage reset for user', { userId: user_id });

    res.json({
      status: 'ok',
      message: 'Usage data reset successfully'
    });
  } catch (error) {
    logger.error('Error resetting usage', { error });
    res.status(500).json({ error: 'Failed to reset usage' });
  }
});

module.exports = {
  router,
  trackUsage, // Export for use in other modules
  getSubscription,
  checkUsageLimits
};
