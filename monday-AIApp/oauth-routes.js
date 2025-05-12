/**
 * OAuth routes for Monday.com Claude Integration App
 * Enhanced with CSRF protection, state parameter validation, secure cookies, and proper error handling
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Logger, Storage } = require('@mondaycom/apps-sdk');
const config = require('./config');
const crypto = require('crypto');
const axios = require('axios');
const cookieParser = require('cookie-parser');

const logger = new Logger('oauth-routes');
const storage = new Storage();

// Constants for OAuth security
const CSRF_COOKIE_NAME = 'monday_claude_csrf_token';
const STATE_STORAGE_PREFIX = 'oauth_state_';
const TOKEN_STORAGE_PREFIX = 'oauth_token_';
const COOKIE_MAX_AGE = 3600000; // 1 hour
const STATE_EXPIRY = 3600; // 1 hour in seconds

// Use cookie parser middleware
router.use(cookieParser());

/**
 * Generate a secure random token for CSRF protection
 *
 * @returns {string} - A secure random token
 */
function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate that a state token exists and hasn't expired
 *
 * @param {string} state - The state parameter from the OAuth callback
 * @returns {Promise<boolean>} - Whether the state is valid
 */
async function validateState(state) {
  if (!state) return false;

  try {
    // Get the stored state data
    const stateData = await storage.get(`${STATE_STORAGE_PREFIX}${state}`);

    if (!stateData) return false;

    // Check if the state has expired
    const now = Math.floor(Date.now() / 1000);
    if (now > stateData.expiresAt) {
      // Clean up expired state
      await storage.delete(`${STATE_STORAGE_PREFIX}${state}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error validating state', { error });
    return false;
  }
}

/**
 * Initiate OAuth flow
 */
router.get('/oauth/authorize', async (req, res) => {
  try {
    // Generate a secure state parameter for CSRF protection
    const state = generateSecureToken();

    // Store the state with an expiration time
    const stateData = {
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + STATE_EXPIRY,
      redirectUri: req.query.redirect_uri || config.OAUTH_REDIRECT_URI
    };

    await storage.set(`${STATE_STORAGE_PREFIX}${state}`, stateData);

    // Set a secure cookie with the CSRF token
    res.cookie(CSRF_COOKIE_NAME, state, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    // Construct the Monday.com OAuth URL
    const mondayOAuthUrl = new URL('https://auth.monday.com/oauth2/authorize');
    mondayOAuthUrl.searchParams.append('client_id', config.MONDAY_CLIENT_ID);
    mondayOAuthUrl.searchParams.append('redirect_uri', config.OAUTH_REDIRECT_URI);
    mondayOAuthUrl.searchParams.append('state', state);
    mondayOAuthUrl.searchParams.append('scope', 'boards:read boards:write');

    // Redirect to Monday.com OAuth page
    logger.info('Initiating OAuth flow', { state: state.substring(0, 8) + '...' });
    res.redirect(mondayOAuthUrl.toString());
  } catch (error) {
    logger.error('Error initiating OAuth flow', { error });
    res.status(500).send('OAuth error: ' + error.message);
  }
});

/**
 * OAuth callback endpoint
 */
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const csrfToken = req.cookies[CSRF_COOKIE_NAME];

    // Validate required parameters
    if (!code) {
      logger.error('OAuth callback missing code parameter');
      return res.status(400).render('oauth-error', {
        error: 'Missing authorization code'
      });
    }

    if (!state) {
      logger.error('OAuth callback missing state parameter');
      return res.status(400).render('oauth-error', {
        error: 'Missing state parameter'
      });
    }

    // Validate CSRF token
    if (!csrfToken || csrfToken !== state) {
      logger.error('OAuth callback CSRF validation failed', {
        cookieToken: csrfToken ? csrfToken.substring(0, 8) + '...' : 'missing',
        stateParam: state.substring(0, 8) + '...'
      });
      return res.status(400).render('oauth-error', {
        error: 'Invalid state parameter'
      });
    }

    // Validate state parameter
    const isValidState = await validateState(state);
    if (!isValidState) {
      logger.error('OAuth callback state validation failed');
      return res.status(400).render('oauth-error', {
        error: 'Invalid or expired state parameter'
      });
    }

    // Get the stored state data
    const stateData = await storage.get(`${STATE_STORAGE_PREFIX}${state}`);
    const redirectUri = stateData.redirectUri;

    // Exchange the code for an access token
    try {
      const tokenResponse = await axios.post('https://auth.monday.com/oauth2/token', {
        client_id: config.MONDAY_CLIENT_ID,
        client_secret: config.MONDAY_CLIENT_SECRET,
        code: code,
        redirect_uri: config.OAUTH_REDIRECT_URI
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const { access_token, refresh_token, expires_in } = tokenResponse.data;

      // Generate a unique token ID
      const tokenId = uuidv4();

      // Store the tokens securely
      await storage.set(`${TOKEN_STORAGE_PREFIX}${tokenId}`, {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: Math.floor(Date.now() / 1000) + expires_in,
        createdAt: Math.floor(Date.now() / 1000)
      });

      // Set a secure cookie with the token ID
      res.cookie('monday_claude_token', tokenId, {
        maxAge: expires_in * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      // Clean up the state
      await storage.delete(`${STATE_STORAGE_PREFIX}${state}`);

      // Clear the CSRF cookie
      res.clearCookie(CSRF_COOKIE_NAME);

      logger.info('OAuth flow completed successfully', { tokenId });

      // Redirect to the success page or the original redirect URI
      res.redirect(redirectUri || '/oauth-success');
    } catch (error) {
      logger.error('Error exchanging code for token', {
        error: error.message,
        response: error.response?.data
      });

      return res.status(500).render('oauth-error', {
        error: 'Failed to exchange authorization code for token'
      });
    }
  } catch (error) {
    logger.error('OAuth callback error', { error });
    res.status(500).render('oauth-error', {
      error: 'An unexpected error occurred'
    });
  }
});

/**
 * OAuth success page
 */
router.get('/oauth-success', (req, res) => {
  // Check if the user has a valid token
  const tokenId = req.cookies['monday_claude_token'];

  res.send(`
    <html>
      <head>
        <title>Authorization Successful</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background-color: #f5f6f8;
            color: #323338;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          }
          .success {
            color: #00ca72;
            font-size: 24px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .success-icon {
            background-color: #00ca72;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-right: 10px;
            font-weight: bold;
          }
          .info {
            margin-bottom: 30px;
            line-height: 1.5;
          }
          .button {
            background-color: #0085ff;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            text-decoration: none;
            display: inline-block;
            font-weight: 500;
            transition: background-color 0.2s;
          }
          .button:hover {
            background-color: #0071d9;
          }
          .security-note {
            margin-top: 30px;
            font-size: 12px;
            color: #676879;
            padding-top: 20px;
            border-top: 1px solid #e6e9ef;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">
            <div class="success-icon">✓</div>
            Authorization Successful
          </div>
          <div class="info">
            You have successfully authorized the Monday.com Claude Integration App.
            Your secure connection has been established, and your access token has been securely stored.
            You can now close this window and return to Monday.com.
          </div>
          <a class="button" href="https://monday.com/boards">Return to Monday.com</a>

          <div class="security-note">
            <strong>Security Note:</strong> Your authorization is stored securely and will be used only for the requested operations.
            ${tokenId ? 'Your session is active and secured with encryption.' : 'No active session was detected.'}
          </div>
        </div>
      </body>
    </html>
  `);
});

/**
 * OAuth error page
 */
router.get('/oauth-error', (req, res) => {
  const errorMessage = req.query.error || 'An unknown error occurred';

  res.status(400).send(`
    <html>
      <head>
        <title>Authorization Error</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background-color: #f5f6f8;
            color: #323338;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          }
          .error {
            color: #e44258;
            font-size: 24px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .error-icon {
            background-color: #e44258;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-right: 10px;
            font-weight: bold;
          }
          .info {
            margin-bottom: 30px;
            line-height: 1.5;
          }
          .error-details {
            background-color: #f5f6f8;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
            text-align: left;
            font-family: monospace;
            word-break: break-all;
          }
          .button {
            background-color: #0085ff;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            text-decoration: none;
            display: inline-block;
            font-weight: 500;
            transition: background-color 0.2s;
          }
          .button:hover {
            background-color: #0071d9;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error">
            <div class="error-icon">✗</div>
            Authorization Error
          </div>
          <div class="info">
            We encountered an error while processing your authorization request.
          </div>

          <div class="error-details">
            ${errorMessage}
          </div>

          <a class="button" href="/oauth/authorize">Try Again</a>
        </div>
      </body>
    </html>
  `);
});

/**
 * Token refresh endpoint
 */
router.post('/oauth/refresh', async (req, res) => {
  try {
    const tokenId = req.cookies['monday_claude_token'];

    if (!tokenId) {
      return res.status(401).json({ error: 'No token found' });
    }

    // Get the stored token data
    const tokenData = await storage.get(`${TOKEN_STORAGE_PREFIX}${tokenId}`);

    if (!tokenData || !tokenData.refreshToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if the token needs refreshing
    const now = Math.floor(Date.now() / 1000);
    const tokenExpiry = tokenData.expiresAt;

    // If token is still valid, return success
    if (now < tokenExpiry - 300) { // 5 minute buffer
      return res.json({
        success: true,
        message: 'Token is still valid',
        expiresIn: tokenExpiry - now
      });
    }

    // Refresh the token
    try {
      const refreshResponse = await axios.post('https://auth.monday.com/oauth2/token', {
        client_id: config.MONDAY_CLIENT_ID,
        client_secret: config.MONDAY_CLIENT_SECRET,
        refresh_token: tokenData.refreshToken,
        grant_type: 'refresh_token'
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const { access_token, refresh_token, expires_in } = refreshResponse.data;

      // Update the stored token data
      const updatedTokenData = {
        accessToken: access_token,
        refreshToken: refresh_token || tokenData.refreshToken, // Use new refresh token if provided
        expiresAt: Math.floor(Date.now() / 1000) + expires_in,
        createdAt: Math.floor(Date.now() / 1000)
      };

      await storage.set(`${TOKEN_STORAGE_PREFIX}${tokenId}`, updatedTokenData);

      // Update the cookie expiration
      res.cookie('monday_claude_token', tokenId, {
        maxAge: expires_in * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      logger.info('Token refreshed successfully', { tokenId });

      return res.json({
        success: true,
        message: 'Token refreshed successfully',
        expiresIn: expires_in
      });
    } catch (error) {
      logger.error('Error refreshing token', {
        error: error.message,
        response: error.response?.data
      });

      return res.status(500).json({
        error: 'Failed to refresh token',
        details: error.message
      });
    }
  } catch (error) {
    logger.error('Token refresh error', { error });
    return res.status(500).json({
      error: 'An unexpected error occurred',
      details: error.message
    });
  }
});

/**
 * Token validation middleware
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function validateToken(req, res, next) {
  try {
    const tokenId = req.cookies['monday_claude_token'];

    if (!tokenId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get the stored token data
    const tokenData = await storage.get(`${TOKEN_STORAGE_PREFIX}${tokenId}`);

    if (!tokenData || !tokenData.accessToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if the token has expired
    const now = Math.floor(Date.now() / 1000);
    if (now >= tokenData.expiresAt) {
      return res.status(401).json({
        error: 'Token expired',
        refreshRequired: true
      });
    }

    // Add the token data to the request object
    req.tokenData = tokenData;
    req.accessToken = tokenData.accessToken;

    next();
  } catch (error) {
    logger.error('Token validation error', { error });
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Protected API endpoint example
 */
router.get('/api/user-info', validateToken, async (req, res) => {
  try {
    // Use the access token to make a request to Monday.com API
    const response = await axios.post('https://api.monday.com/v2', {
      query: `{ me { id name email } }`
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.accessToken
      }
    });

    return res.json(response.data);
  } catch (error) {
    logger.error('Error fetching user info', { error });
    return res.status(500).json({ error: 'Failed to fetch user information' });
  }
});

module.exports = router;
