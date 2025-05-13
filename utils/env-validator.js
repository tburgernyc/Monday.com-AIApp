/**
 * Environment Variable Validator
 * 
 * This utility provides enhanced validation for environment variables
 * with detailed error messages and format validation.
 */

const { Logger } = require('@mondaycom/apps-sdk');
const logger = new Logger('env-validator');

/**
 * Validates that a variable exists and is not empty
 * 
 * @param {string} name - Environment variable name
 * @param {string} value - Environment variable value
 * @returns {object} - Validation result
 */
function validateExists(name, value) {
  if (!value || value.trim() === '') {
    return {
      valid: false,
      message: `${name} is required but missing or empty`
    };
  }
  return { valid: true };
}

/**
 * Validates that a variable matches a specific format using regex
 * 
 * @param {string} name - Environment variable name
 * @param {string} value - Environment variable value
 * @param {RegExp} regex - Regular expression to match
 * @param {string} formatDescription - Description of the expected format
 * @returns {object} - Validation result
 */
function validateFormat(name, value, regex, formatDescription) {
  if (!regex.test(value)) {
    return {
      valid: false,
      message: `${name} has invalid format. Expected ${formatDescription}`
    };
  }
  return { valid: true };
}

/**
 * Validates that a URL is properly formatted
 * 
 * @param {string} name - Environment variable name
 * @param {string} value - Environment variable value
 * @returns {object} - Validation result
 */
function validateUrl(name, value) {
  try {
    new URL(value);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      message: `${name} is not a valid URL`
    };
  }
}

/**
 * Validates all required environment variables
 * 
 * @returns {object} - Validation results
 */
function validateEnvironment() {
  const errors = [];
  const warnings = [];

  // Define validation rules for each variable
  const validations = [
    {
      name: 'MONDAY_CLIENT_ID',
      required: true,
      validate: (value) => validateExists('MONDAY_CLIENT_ID', value)
    },
    {
      name: 'MONDAY_CLIENT_SECRET',
      required: true,
      validate: (value) => validateExists('MONDAY_CLIENT_SECRET', value)
    },
    {
      name: 'MONDAY_SIGNING_SECRET',
      required: true,
      validate: (value) => validateExists('MONDAY_SIGNING_SECRET', value)
    },
    {
      name: 'OAUTH_REDIRECT_URI',
      required: true,
      validate: (value) => {
        const existsResult = validateExists('OAUTH_REDIRECT_URI', value);
        if (!existsResult.valid) return existsResult;
        return validateUrl('OAUTH_REDIRECT_URI', value);
      }
    },
    {
      name: 'MONDAY_API_TOKEN',
      required: true,
      validate: (value) => {
        const existsResult = validateExists('MONDAY_API_TOKEN', value);
        if (!existsResult.valid) return existsResult;
        
        // Monday.com API tokens are JWT tokens
        const jwtRegex = /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/;
        return validateFormat('MONDAY_API_TOKEN', value, jwtRegex, 'JWT token format');
      }
    },
    {
      name: 'CLAUDE_API_KEY',
      required: true,
      validate: (value) => {
        const existsResult = validateExists('CLAUDE_API_KEY', value);
        if (!existsResult.valid) return existsResult;
        
        // Claude API keys start with "sk-ant-api"
        const claudeKeyRegex = /^sk-ant-api/;
        return validateFormat('CLAUDE_API_KEY', value, claudeKeyRegex, 'Claude API key format (starts with sk-ant-api)');
      }
    },
    {
      name: 'REGION',
      required: true,
      validate: (value) => {
        const existsResult = validateExists('REGION', value);
        if (!existsResult.valid) return existsResult;
        
        // Region should be either US or EU
        if (value !== 'US' && value !== 'EU') {
          return {
            valid: false,
            message: 'REGION must be either "US" or "EU"'
          };
        }
        return { valid: true };
      }
    },
    {
      name: 'PORT',
      required: false,
      validate: (value) => {
        if (!value) return { valid: true }; // Optional
        
        // Port should be a number between 1 and 65535
        const portNumber = parseInt(value, 10);
        if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
          return {
            valid: false,
            message: 'PORT must be a number between 1 and 65535'
          };
        }
        return { valid: true };
      }
    },
    {
      name: 'REDIS_URL',
      required: false,
      validate: (value) => {
        if (!value) return { valid: true }; // Optional
        
        // Redis URL should start with redis:// or rediss://
        const redisUrlRegex = /^rediss?:\/\//;
        if (!redisUrlRegex.test(value)) {
          return {
            valid: false,
            message: 'REDIS_URL must start with redis:// or rediss://'
          };
        }
        return { valid: true };
      }
    },
    {
      name: 'OPENAI_API_KEY',
      required: false,
      validate: (value) => {
        if (!value) return { valid: true }; // Optional
        
        // OpenAI API keys start with "sk-"
        const openaiKeyRegex = /^sk-/;
        return validateFormat('OPENAI_API_KEY', value, openaiKeyRegex, 'OpenAI API key format (starts with sk-)');
      }
    }
  ];

  // Validate each variable
  for (const validation of validations) {
    const { name, required, validate } = validation;
    const value = process.env[name];
    
    if (required && (!value || value.trim() === '')) {
      errors.push(`${name} is required but missing or empty`);
      continue;
    }
    
    if (value) {
      const result = validate(value);
      if (!result.valid) {
        if (required) {
          errors.push(result.message);
        } else {
          warnings.push(result.message);
        }
      }
    }
  }

  // Log validation results
  if (errors.length > 0) {
    logger.error('Environment validation failed', { errors });
  }
  
  if (warnings.length > 0) {
    logger.warn('Environment validation warnings', { warnings });
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    logger.info('Environment validation successful');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  validateEnvironment
};
