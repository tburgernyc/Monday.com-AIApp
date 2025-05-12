/**
 * Centralized configuration module for Monday.com Claude Integration App
 * Loads environment variables from .env file and exports them
 */

// Load environment variables from .env file
require('dotenv').config();

// Region-specific API endpoints
const REGION = process.env.REGION || 'US';
const regionConfig = {
  'US': {
    MONDAY_API_URL: 'https://api.monday.com/v2',
    CLAUDE_API_URL: 'https://api.anthropic.com/v1/messages',
    LOG_LEVEL: 'info'
  },
  'EU': {
    MONDAY_API_URL: 'https://api.eu1.monday.com/v2',
    CLAUDE_API_URL: 'https://api.anthropic.com/v1/messages',
    LOG_LEVEL: 'info'
  }
}[REGION];

// Export all configuration variables
module.exports = {
  // Monday.com OAuth credentials
  MONDAY_CLIENT_ID: process.env.MONDAY_CLIENT_ID,
  MONDAY_CLIENT_SECRET: process.env.MONDAY_CLIENT_SECRET,
  OAUTH_REDIRECT_URI: process.env.OAUTH_REDIRECT_URI,
  
  // Monday.com API token
  MONDAY_API_TOKEN: process.env.MONDAY_API_TOKEN,
  
  // Claude AI API configuration
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
  CLAUDE_API_URL: regionConfig.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages',
  CLAUDE_API_VERSION: process.env.CLAUDE_API_VERSION || '2023-06-01',
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20240307',
  
  // OpenAI API configuration
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
  // Server configuration
  PORT: process.env.PORT || 3001, // Changed from 3000 to 3001 to avoid conflicts
  
  // Region configuration
  REGION: REGION,
  MONDAY_API_URL: regionConfig.MONDAY_API_URL,
  LOG_LEVEL: regionConfig.LOG_LEVEL || 'info',
  
  // Helper function to check if all required variables are set
  validateConfig: function() {
    const requiredVars = [
      'MONDAY_CLIENT_ID', 
      'MONDAY_CLIENT_SECRET', 
      'MONDAY_API_TOKEN',
      'CLAUDE_API_KEY'
    ];
    
    const missing = requiredVars.filter(varName => !this[varName]);
    
    if (missing.length > 0) {
      console.error(`Missing required environment variables: ${missing.join(', ')}`);
      return false;
    }
    
    return true;
  }
};
