/**
 * Monetization and webhook routes for Monday.com Claude Integration App
 * 
 * These routes handle webhook callbacks from Monday.com for subscription events
 * and provide API endpoints for checking subscription status.
 */

const express = require('express');
const router = express.Router();
const { Logger } = require('@mondaycom/apps-sdk');
const monetizationHandler = require('./monday-claude-utils/monetizationHandler');

const logger = new Logger('monetization-routes');

/**
 * Webhook endpoint for Monday.com subscription events
 * 
 * This endpoint receives subscription lifecycle events like:
 * - app_subscription_created
 * - app_subscription_renewed
 * - app_subscription_changed
 * - app_subscription_canceled
 * - app_installed
 * - app_uninstalled
 */
router.post('/webhooks/subscription', async (req, res) => {
  try {
    // Validate the webhook signature
    const isValid = monetizationHandler.validateWebhookSignature(req);
    
    if (!isValid) {
      logger.warn('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Handle Monday.com challenge request for webhook verification
    if (req.body.challenge) {
      logger.info('Responding to webhook challenge');
      return res.json({ challenge: req.body.challenge });
    }
    
    // Process the subscription event
    const event = req.body.event;
    
    if (!event) {
      logger.warn('Missing event in webhook payload');
      return res.status(400).json({ error: 'Missing event in payload' });
    }
    
    logger.info('Received subscription webhook event', { 
      type: event.type,
      accountId: event.accountId
    });
    
    // Process the event asynchronously
    await monetizationHandler.processSubscriptionEvent(event);
    
    // Respond to Monday.com with success
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing webhook event', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * API endpoint to check subscription status
 * 
 * This endpoint is used by the frontend to verify subscription status
 * and available features for the current account.
 */
router.get('/subscription/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const sessionToken = req.headers['x-monday-session-token'];
    
    if (!sessionToken) {
      logger.warn('Missing session token');
      return res.status(401).json({ error: 'Missing session token' });
    }
    
    // Verify the session token
    const tokenPayload = monetizationHandler.verifySessionToken(sessionToken);
    
    if (!tokenPayload) {
      logger.warn('Invalid session token');
      return res.status(401).json({ error: 'Invalid session token' });
    }
    
    // Check if the token is for the same account
    if (tokenPayload.accountId !== accountId) {
      logger.warn('Token account mismatch', { 
        tokenAccount: tokenPayload.accountId, 
        requestedAccount: accountId 
      });
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Get the subscription details
    const subscription = await monetizationHandler.getSubscription(accountId);
    
    // Get the plan configuration
    const planConfig = monetizationHandler.SUBSCRIPTION_PLANS[subscription.planId] || 
                         monetizationHandler.SUBSCRIPTION_PLANS.free_trial;
    
    // Return subscription details and available features
    return res.json({
      subscription: {
        planId: subscription.planId,
        isActive: subscription.isActive,
        isOnTrial: subscription.isOnTrial
      },
      features: planConfig.featureFlags,
      limits: {
        maxRequests: planConfig.maxRequests,
        maxBoardsAccess: planConfig.maxBoardsAccess,
        usageCount: subscription.usageCount || 0
      }
    });
  } catch (error) {
    logger.error('Error getting subscription status', { 
      error, 
      accountId: req.params.accountId 
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * API endpoint to increment usage count
 * 
 * This endpoint is called when a user makes a request that counts towards
 * their usage limit.
 */
router.post('/subscription/:accountId/increment', async (req, res) => {
  try {
    const { accountId } = req.params;
    const sessionToken = req.headers['x-monday-session-token'];
    
    if (!sessionToken) {
      logger.warn('Missing session token');
      return res.status(401).json({ error: 'Missing session token' });
    }
    
    // Verify the session token
    const tokenPayload = monetizationHandler.verifySessionToken(sessionToken);
    
    if (!tokenPayload) {
      logger.warn('Invalid session token');
      return res.status(401).json({ error: 'Invalid session token' });
    }
    
    // Check if the token is for the same account
    if (tokenPayload.accountId !== accountId) {
      logger.warn('Token account mismatch', { 
        tokenAccount: tokenPayload.accountId, 
        requestedAccount: accountId 
      });
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Check if the account is within its request limit
    const isWithinLimit = await monetizationHandler.isWithinRequestLimit(accountId);
    
    if (!isWithinLimit) {
      return res.status(402).json({ 
        error: 'Request limit exceeded',
        message: 'You have reached your plan\'s request limit. Please upgrade your plan to continue using the app.'
      });
    }
    
    // Increment the usage count
    await monetizationHandler.incrementUsage(accountId);
    
    // Return success
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error incrementing usage count', { 
      error, 
      accountId: req.params.accountId 
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * API endpoint to check if a feature is available for an account
 * 
 * This endpoint is used by the frontend to check if specific features
 * are available based on the subscription plan.
 */
router.get('/subscription/:accountId/feature/:feature', async (req, res) => {
  try {
    const { accountId, feature } = req.params;
    const sessionToken = req.headers['x-monday-session-token'];
    
    if (!sessionToken) {
      logger.warn('Missing session token');
      return res.status(401).json({ error: 'Missing session token' });
    }
    
    // Verify the session token
    const tokenPayload = monetizationHandler.verifySessionToken(sessionToken);
    
    if (!tokenPayload) {
      logger.warn('Invalid session token');
      return res.status(401).json({ error: 'Invalid session token' });
    }
    
    // Check if the token is for the same account
    if (tokenPayload.accountId !== accountId) {
      logger.warn('Token account mismatch', { 
        tokenAccount: tokenPayload.accountId, 
        requestedAccount: accountId 
      });
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Check if the feature is available
    const hasFeature = await monetizationHandler.hasFeature(accountId, feature);
    
    // Return feature availability
    return res.json({ 
      accountId,
      feature,
      available: hasFeature
    });
  } catch (error) {
    logger.error('Error checking feature availability', { 
      error, 
      accountId: req.params.accountId,
      feature: req.params.feature
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;