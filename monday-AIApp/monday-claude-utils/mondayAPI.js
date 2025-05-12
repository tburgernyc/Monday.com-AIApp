/**
 * Utility functions for interacting with the Monday.com GraphQL API
 * Enhanced with retry logic, timeouts, and improved error handling
 */

const axios = require('axios');
const { Logger } = require('@mondaycom/apps-sdk');
const config = require('../config');

const logger = new Logger('monday-api-utils');

// Monday.com GraphQL API endpoint from config
const MONDAY_API_URL = config.MONDAY_API_URL || 'https://api.monday.com/v2';

// API request configuration
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const RETRY_STATUS_CODES = [429, 500, 502, 503, 504];

// Error classification
const ERROR_TYPES = {
  RATE_LIMIT: 'RATE_LIMIT',
  AUTHENTICATION: 'AUTHENTICATION',
  PERMISSION: 'PERMISSION',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  SERVER: 'SERVER',
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN'
};

/**
 * Classify the error type based on the error response
 *
 * @param {Error} error - The error object
 * @returns {string} - The error type
 */
function classifyError(error) {
  if (!error) return ERROR_TYPES.UNKNOWN;

  // Check for timeout errors
  if (error.code === 'ECONNABORTED') {
    return ERROR_TYPES.TIMEOUT;
  }

  // Check for network errors
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
    return ERROR_TYPES.NETWORK;
  }

  // If there's no response, it's a network error
  if (!error.response) {
    return ERROR_TYPES.NETWORK;
  }

  // Classify based on status code
  const status = error.response.status;

  if (status === 429) {
    return ERROR_TYPES.RATE_LIMIT;
  } else if (status === 401) {
    return ERROR_TYPES.AUTHENTICATION;
  } else if (status === 403) {
    return ERROR_TYPES.PERMISSION;
  } else if (status === 404) {
    return ERROR_TYPES.NOT_FOUND;
  } else if (status >= 400 && status < 500) {
    // Check for GraphQL validation errors
    if (error.response.data && error.response.data.errors) {
      const errorMessage = error.response.data.errors[0]?.message || '';
      if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
        return ERROR_TYPES.VALIDATION;
      }
    }
    return ERROR_TYPES.VALIDATION;
  } else if (status >= 500) {
    return ERROR_TYPES.SERVER;
  }

  return ERROR_TYPES.UNKNOWN;
}

/**
 * Determine if an error is retryable
 *
 * @param {Error} error - The error object
 * @returns {boolean} - Whether the error is retryable
 */
function isRetryableError(error) {
  const errorType = classifyError(error);

  return [
    ERROR_TYPES.RATE_LIMIT,
    ERROR_TYPES.SERVER,
    ERROR_TYPES.NETWORK,
    ERROR_TYPES.TIMEOUT
  ].includes(errorType);
}

/**
 * Calculate exponential backoff delay
 *
 * @param {number} retryCount - The current retry count
 * @returns {number} - The delay in milliseconds
 */
function getBackoffDelay(retryCount) {
  // Exponential backoff with jitter: 2^retryCount * 100ms + random jitter
  return Math.min(
    Math.pow(2, retryCount) * 100 + Math.random() * 100,
    5000 // Cap at 5 seconds
  );
}

/**
 * Execute a GraphQL query or mutation on the Monday.com API with retry logic
 *
 * @param {string} query - GraphQL query or mutation string
 * @param {Object} variables - Variables for the GraphQL operation
 * @param {string} token - API token (optional, will use env token if not provided)
 * @param {Object} options - Additional options
 * @param {number} options.timeout - Request timeout in milliseconds
 * @param {number} options.retries - Maximum number of retries
 * @returns {Promise<Object>} - API response data
 */
async function executeGraphQL(query, variables = {}, token = null, options = {}) {
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const maxRetries = options.retries || MAX_RETRIES;
  let retryCount = 0;

  // Use provided token or fall back to environment variable
  const apiToken = token || config.MONDAY_API_TOKEN;

  if (!apiToken) {
    throw new Error('Monday.com API token is required');
  }

  const operationType = query.trim().startsWith('mutation') ? 'mutation' : 'query';

  async function attemptRequest() {
    try {
      logger.info('Executing GraphQL operation', {
        operationType,
        hasVariables: Object.keys(variables).length > 0,
        retryCount
      });

      const response = await axios.post(
        MONDAY_API_URL,
        {
          query: query,
          variables: variables
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': apiToken
          },
          timeout: timeout // Set request timeout
        }
      );

      // Check for GraphQL errors
      if (response.data.errors) {
        logger.error('GraphQL operation returned errors', {
          errors: response.data.errors
        });

        const error = new Error(`GraphQL Error: ${response.data.errors[0].message}`);
        error.graphqlErrors = response.data.errors;
        error.type = ERROR_TYPES.VALIDATION;
        throw error;
      }

      logger.info('GraphQL operation completed successfully');
      return response.data;
    } catch (error) {
      // Classify the error
      const errorType = classifyError(error);

      // Check if we should retry
      if (retryCount < maxRetries && isRetryableError(error)) {
        retryCount++;
        const delay = getBackoffDelay(retryCount);

        logger.warn(`Retrying GraphQL operation (${retryCount}/${maxRetries}) after ${delay}ms delay`, {
          errorType,
          operationType,
          retryCount
        });

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry the request
        return attemptRequest();
      }

      // We've exhausted retries or the error is not retryable
      logger.error('Monday.com API request failed', {
        errorType,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        retryCount
      });

      // Enhance error with more details
      const enhancedError = new Error(`Monday.com API Error: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.type = errorType;
      enhancedError.status = error.response?.status;
      enhancedError.data = error.response?.data;
      enhancedError.graphqlErrors = error.graphqlErrors || (error.response?.data?.errors || []);

      throw enhancedError;
    }
  }

  return attemptRequest();
}

/**
 * Get boards accessible to the authenticated user
 *
 * @param {string} token - API token (optional)
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} - List of boards
 */
async function getBoards(token = null, options = {}) {
  const query = `
    query {
      boards {
        id
        name
        description
        state
        board_kind
        created_at
        updated_at
      }
    }
  `;

  const response = await executeGraphQL(query, {}, token, options);
  return response.data.boards;
}

/**
 * Get a specific board by ID
 *
 * @param {string} boardId - Board ID
 * @param {string} token - API token (optional)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Board data
 */
async function getBoardById(boardId, token = null, options = {}) {
  const query = `
    query($boardId: ID!) {
      boards(ids: [$boardId]) {
        id
        name
        description
        state
        board_kind
        columns {
          id
          title
          type
          settings_str
        }
        groups {
          id
          title
          color
          position
        }
        items {
          id
          name
          group {
            id
            title
          }
          column_values {
            id
            text
            value
            type
          }
        }
      }
    }
  `;

  const variables = {
    boardId: boardId
  };

  const response = await executeGraphQL(query, variables, token, options);
  return response.data.boards[0];
}

/**
 * Create a new item in a board
 *
 * @param {string} boardId - Board ID
 * @param {string} groupId - Group ID
 * @param {string} itemName - Item name
 * @param {Object} columnValues - Column values for the new item
 * @param {string} token - API token (optional)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Created item data
 */
async function createItem(boardId, groupId, itemName, columnValues = {}, token = null, options = {}) {
  const mutation = `
    mutation($boardId: ID!, $groupId: String!, $itemName: String!, $columnValues: JSON) {
      create_item(
        board_id: $boardId,
        group_id: $groupId,
        item_name: $itemName,
        column_values: $columnValues
      ) {
        id
        name
        group {
          id
          title
        }
        column_values {
          id
          text
          value
        }
      }
    }
  `;

  const variables = {
    boardId: boardId,
    groupId: groupId,
    itemName: itemName,
    columnValues: JSON.stringify(columnValues)
  };

  const response = await executeGraphQL(mutation, variables, token, options);
  return response.data.create_item;
}

/**
 * Update column values for an item
 *
 * @param {string} itemId - Item ID
 * @param {string} boardId - Board ID (required for the mutation)
 * @param {Object} columnValues - Column values to update
 * @param {string} token - API token (optional)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Updated item data
 */
async function updateItem(itemId, boardId, columnValues, token = null, options = {}) {
  const mutation = `
    mutation($itemId: ID!, $boardId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(
        item_id: $itemId,
        board_id: $boardId,
        column_values: $columnValues
      ) {
        id
        name
        column_values {
          id
          text
          value
        }
      }
    }
  `;

  const variables = {
    itemId: itemId,
    boardId: boardId,
    columnValues: JSON.stringify(columnValues)
  };

  const response = await executeGraphQL(mutation, variables, token, options);
  return response.data.change_multiple_column_values;
}

/**
 * Get user information
 *
 * @param {string} token - API token (optional)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - User data
 */
async function getMe(token = null, options = {}) {
  const query = `
    query {
      me {
        id
        name
        email
        account {
          id
          name
          tier
        }
      }
    }
  `;

  const response = await executeGraphQL(query, {}, token, options);
  return response.data.me;
}

/**
 * Create a notification for a user
 *
 * @param {string} userId - User ID to notify
 * @param {string} targetId - Target item ID
 * @param {string} text - Notification text
 * @param {string} token - API token (optional)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Notification data
 */
async function createNotification(userId, targetId, text, token = null, options = {}) {
  const mutation = `
    mutation($userId: ID!, $targetId: ID!, $text: String!) {
      create_notification(
        user_id: $userId,
        target_id: $targetId,
        text: $text,
        target_type: Item
      ) {
        id
        text
      }
    }
  `;

  const variables = {
    userId: userId,
    targetId: targetId,
    text: text
  };

  const response = await executeGraphQL(mutation, variables, token, options);
  return response.data.create_notification;
}

/**
 * Get items from a board with optional filtering
 *
 * @param {string} boardId - Board ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of items to return
 * @param {string} options.page - Page number for pagination
 * @param {string} token - API token (optional)
 * @returns {Promise<Array>} - List of items
 */
async function getBoardItems(boardId, queryOptions = {}, token = null, options = {}) {
  const { limit = 25, page = 1 } = queryOptions;

  const query = `
    query($boardId: ID!, $limit: Int, $page: Int) {
      boards(ids: [$boardId]) {
        items(limit: $limit, page: $page) {
          id
          name
          created_at
          updated_at
          group {
            id
            title
          }
          column_values {
            id
            text
            value
            type
          }
        }
      }
    }
  `;

  const variables = {
    boardId,
    limit,
    page
  };

  const response = await executeGraphQL(query, variables, token, options);
  return response.data.boards[0]?.items || [];
}

module.exports = {
  executeGraphQL,
  getBoards,
  getBoardById,
  createItem,
  updateItem,
  getMe,
  createNotification,
  getBoardItems,
  ERROR_TYPES
};
