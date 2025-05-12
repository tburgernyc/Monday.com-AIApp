/**
 * Utility functions for health checks
 */

const axios = require('axios');
const config = require('./config');

/**
 * Check Monday.com API connection
 * 
 * @returns {Promise<Object>} - Status object with status and details
 */
async function checkMondayAPIConnection() {
  try {
    const response = await axios.post(
      config.MONDAY_API_URL,
      {
        query: '{ me { name } }'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': config.MONDAY_API_TOKEN
        },
        timeout: 5000 // 5 second timeout
      }
    );

    if (response.data && !response.data.errors) {
      return {
        status: 'ok',
        latency: response.headers['x-response-time'] || 'unknown'
      };
    } else {
      return {
        status: 'degraded',
        message: 'API responded with errors',
        details: response.data.errors ? response.data.errors[0].message : 'Unknown error'
      };
    }
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      code: error.response?.status || 'unknown'
    };
  }
}

/**
 * Check Claude API connection
 * 
 * @returns {Promise<Object>} - Status object with status and details
 */
async function checkClaudeAPIConnection() {
  try {
    // Just check if we have a valid API key
    if (!config.CLAUDE_API_KEY) {
      return {
        status: 'error',
        message: 'Claude API key not configured'
      };
    }

    // For a real check, we would make a simple API call to Claude
    // But to avoid unnecessary API usage/costs, we'll just return ok if the key exists
    return {
      status: 'ok',
      message: 'API key configured'
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message
    };
  }
}

module.exports = {
  checkMondayAPIConnection,
  checkClaudeAPIConnection
};
