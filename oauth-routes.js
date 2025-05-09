/**
 * OAuth routes for Monday.com Claude Integration App
 * 
 * Handles authentication flow with Monday.com and status checking
 */

const express = require('express');
const router = express.Router();
const { Logger, Environment, SecureStorage } = require('@mondaycom/apps-sdk');
const axios = require('axios');
const crypto = require('crypto');

const logger = new Logger('oauth-routes');
const env = new Environment();
const secureStorage = new SecureStorage();

// Monday.com OAuth endpoints
const MONDAY_AUTH_URL = 'https://auth.monday.com/oauth2/authorize';
const MONDAY_TOKEN_URL = 'https://auth.monday.com/oauth2/token';

// Get OAuth configuration from environment
const CLIENT_ID = env.get('MONDAY_CLIENT_ID');
const CLIENT_SECRET = env.get('MONDAY_CLIENT_SECRET');
const REDIRECT_URI = env.get('OAUTH_REDIRECT_URI');

// Missing environment variables check
if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  logger.error('Missing required environment variables for OAuth');
}

/**
 * Initiate OAuth flow
 */
router.get('/oauth/auth', (req, res) => {
  try {
    // Generate a state value for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    
    // Store state in secure storage with expiration
    const stateKey = `oauth_state_${state}`;
    secureStorage.set(stateKey, { timestamp: Date.now() }, { expiresIn: 600 }); // 10 minutes
    
    // Build authorization URL
    const authUrl = new URL(MONDAY_AUTH_URL);
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('state', state);
    
    // Redirect to Monday.com authorization page
    res.redirect(authUrl.toString());
  } catch (error) {
    logger.error('Error initiating OAuth flow', { error });
    res.status(500).send('Error initiating authentication.');
  }
});

/**
 * OAuth callback from Monday.com
 */
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    // Validate state to prevent CSRF attacks
    const stateKey = `oauth_state_${state}`;
    const storedState = await secureStorage.get(stateKey);
    
    if (!storedState) {
      logger.warn('Invalid OAuth state parameter', { state });
      return res.status(400).send('Invalid state parameter.');
    }
    
    // Delete the state from storage
    await secureStorage.delete(stateKey);
    
    // Check for auth code
    if (!code) {
      logger.warn('Missing authorization code');
      return res.status(400).send('Authorization code is missing.');
    }
    
    // Exchange code for token
    const tokenResponse = await axios.post(
      MONDAY_TOKEN_URL,
      null,
      {
        params: {
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          redirect_uri: REDIRECT_URI
        }
      }
    );
    
    const { access_token, refresh_token, expires_in, account_id } = tokenResponse.data;
    
    // Store tokens securely
    const accountKey = `oauth_tokens_${account_id}`;
    await secureStorage.set(accountKey, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (expires_in * 1000),
      accountId: account_id
    });
    
    // Log successful authentication
    logger.info('OAuth authentication successful', { accountId: account_id });
    
    // Redirect to success page
    res.redirect(`/oauth/success?account_id=${account_id}`);
  } catch (error) {
    logger.error('Error in OAuth callback', { error });
    res.status(500).send('Authentication failed. Please try again.');
  }
});

/**
 * OAuth success page
 */
router.get('/oauth/success', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Successful</title>
      <style>
        body {
          font-family: 'Roboto', sans-serif;
          text-align: center;
          padding: 50px;
          background-color: #f6f7fb;
        }
        .success-container {
          background-color: white;
          border-radius: 8px;
          padding: 40px;
          max-width: 500px;
          margin: 0 auto;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }
        h1 {
          color: #0073ea;
          margin-bottom: 20px;
        }
        p {
          color: #323338;
          font-size: 16px;
          line-height: 1.5;
          margin-bottom: 30px;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
          color: #00c875;
        }
        .close-button {
          background-color: #0073ea;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 20px;
          font-size: 16px;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="success-container">
        <div class="icon">✓</div>
        <h1>Authentication Successful</h1>
        <p>You have successfully connected Claude AI Assistant with your Monday.com account. You can now close this window and continue using the app.</p>
        <button class="close-button" onclick="window.close()">Close Window</button>
      </div>
    </body>
    </html>
  `);
});

/**
 * Check OAuth status for an account
 */
router.get('/oauth/status/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Verify session token
    const sessionToken = req.headers['x-monday-session-token'];
    if (!sessionToken) {
      return res.status(401).json({ error: 'Missing session token' });
    }
    
    // Get tokens from secure storage
    const accountKey = `oauth_tokens_${accountId}`;
    const tokens = await secureStorage.get(accountKey);
    
    // Check if tokens exist
    if (!tokens) {
      return res.json({
        authenticated: false,
        message: 'Not authenticated with Monday.com'
      });
    }
    
    // Check if tokens are expired
    const isExpired = tokens.expiresAt < Date.now();
    
    if (isExpired && tokens.refreshToken) {
      // Refresh the token
      try {
        const refreshResponse = await axios.post(
          MONDAY_TOKEN_URL,
          null,
          {
            params: {
              client_id: CLIENT_ID,
              client_secret: CLIENT_SECRET,
              refresh_token: tokens.refreshToken,
              grant_type: 'refresh_token'
            }
          }
        );
        
        const { access_token, refresh_token, expires_in } = refreshResponse.data;
        
        // Update tokens in storage
        await secureStorage.set(accountKey, {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: Date.now() + (expires_in * 1000),
          accountId
        });
        
        return res.json({
          authenticated: true,
          message: 'Authentication refreshed successfully'
        });
      } catch (refreshError) {
        logger.error('Failed to refresh token', { error: refreshError, accountId });
        
        // If refresh fails, tokens are invalid
        return res.json({
          authenticated: false,
          message: 'Authentication expired and refresh failed'
        });
      }
    }
    
    // Return authentication status
    return res.json({
      authenticated: !isExpired,
      message: isExpired ? 'Authentication expired' : 'Authenticated with Monday.com'
    });
  } catch (error) {
    logger.error('Error checking OAuth status', { error, accountId: req.params.accountId });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Revoke OAuth tokens for an account
 */
router.post('/oauth/revoke/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Verify session token
    const sessionToken = req.headers['x-monday-session-token'];
    if (!sessionToken) {
      return res.status(401).json({ error: 'Missing session token' });
    }
    
    // Delete tokens from secure storage
    const accountKey = `oauth_tokens_${accountId}`;
    await secureStorage.delete(accountKey);
    
    return res.json({
      success: true,
      message: 'OAuth tokens revoked successfully'
    });
  } catch (error) {
    logger.error('Error revoking OAuth tokens', { error, accountId: req.params.accountId });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;