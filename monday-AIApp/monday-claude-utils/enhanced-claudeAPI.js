/**
 * Enhanced Claude API Utility with retry logic, rate limiting, circuit breaker pattern,
 * and improved error handling
 */

const axios = require('axios');
const { Logger } = require('@mondaycom/apps-sdk');
const config = require('../config');
const requestQueue = require('./requestQueue');

const logger = new Logger('claude-api-utils');

// Claude API configuration from centralized config
const CLAUDE_API_URL = config.CLAUDE_API_URL;
const CLAUDE_API_VERSION = config.CLAUDE_API_VERSION;
const CLAUDE_MODEL = config.CLAUDE_MODEL;
const MAX_RETRIES = 3;

// Rate limiting configuration
const MAX_REQUESTS_PER_MINUTE = 10;
const requestTimestamps = [];

// Circuit breaker configuration
const CIRCUIT_BREAKER_THRESHOLD = 3; // Number of consecutive errors to trip the circuit
const CIRCUIT_BREAKER_RESET_TIMEOUT = 60000; // 1 minute timeout before resetting
let circuitBreakerFailures = 0;
let circuitBreakerOpen = false;
let circuitBreakerResetTimeout = null;

// Error classification
const ERROR_TYPES = {
  RATE_LIMIT: 'RATE_LIMIT',
  AUTHENTICATION: 'AUTHENTICATION',
  PERMISSION: 'PERMISSION',
  VALIDATION: 'VALIDATION',
  SERVER: 'SERVER',
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
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
  } else if (status >= 400 && status < 500) {
    return ERROR_TYPES.VALIDATION;
  } else if (status >= 500) {
    return ERROR_TYPES.SERVER;
  }

  return ERROR_TYPES.UNKNOWN;
}

/**
 * Check if the circuit breaker is open
 *
 * @returns {boolean} - Whether the circuit breaker is open
 */
function isCircuitBreakerOpen() {
  return circuitBreakerOpen;
}

/**
 * Trip the circuit breaker
 */
function tripCircuitBreaker() {
  if (!circuitBreakerOpen) {
    logger.warn('Circuit breaker tripped - Claude API calls will fail fast for 1 minute');
    circuitBreakerOpen = true;

    // Reset the circuit breaker after the timeout
    circuitBreakerResetTimeout = setTimeout(() => {
      logger.info('Circuit breaker reset - Claude API calls will be attempted again');
      circuitBreakerOpen = false;
      circuitBreakerFailures = 0;
    }, CIRCUIT_BREAKER_RESET_TIMEOUT);
  }
}

/**
 * Record a successful API call for the circuit breaker
 */
function recordSuccess() {
  circuitBreakerFailures = 0;
}

/**
 * Record a failed API call for the circuit breaker
 *
 * @param {Error} error - The error that occurred
 * @returns {boolean} - Whether the circuit breaker was tripped
 */
function recordFailure(error) {
  const errorType = classifyError(error);

  // Only count server and network errors for the circuit breaker
  if ([ERROR_TYPES.SERVER, ERROR_TYPES.NETWORK].includes(errorType)) {
    circuitBreakerFailures++;

    if (circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      tripCircuitBreaker();
      return true;
    }
  }

  return false;
}

/**
 * Calculate exponential backoff delay with full jitter
 *
 * @param {number} retryAttempt - The current retry attempt (0-based)
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
 * @param {number} maxDelay - Maximum delay in milliseconds (default: 60000)
 * @returns {number} - The delay in milliseconds
 */
function calculateBackoff(retryAttempt, baseDelay = 1000, maxDelay = 60000) {
  // Exponential backoff with full jitter
  // Formula: random_between(0, min(cap, base * 2 ^ attempt))
  const exponentialDelay = Math.min(maxDelay, baseDelay * Math.pow(2, retryAttempt));

  // Add jitter by selecting a random delay between 0 and the calculated delay
  // This helps prevent "thundering herd" problems when multiple clients retry simultaneously
  return Math.floor(Math.random() * exponentialDelay);
}

/**
 * Check if we're within rate limits and wait if necessary
 *
 * @returns {Promise<void>} - Resolves when it's safe to make a request
 */
async function checkRateLimit() {
  const now = Date.now();

  // Remove timestamps older than 1 minute
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - 60000) {
    requestTimestamps.shift();
  }

  // Check if we've hit the rate limit
  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldestTimestamp = requestTimestamps[0];
    const waitTime = 60000 - (now - oldestTimestamp);

    if (waitTime > 0) {
      logger.warn(`Rate limit reached, waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return checkRateLimit(); // Recheck after waiting
    }
  }

  // Record this request
  requestTimestamps.push(now);
}

/**
 * Send a message to Claude API with retry logic, rate limiting, and circuit breaker
 *
 * @param {Object} message - Message object to send to Claude
 * @param {string} message.prompt - User's prompt/question
 * @param {string} message.model - Claude model to use (defaults to CLAUDE_MODEL env var)
 * @param {number} message.maxTokens - Maximum tokens in response (defaults to 1000)
 * @param {Object[]} message.systemPrompt - Optional system prompt
 * @param {Object[]} message.tools - Optional tools for Claude to use
 * @param {Object} message.toolChoice - Optional tool choice object
 * @param {Object[]} message.history - Optional conversation history
 * @param {Object} options - Additional options
 * @param {number} options.timeout - Request timeout in milliseconds (default: 30000)
 * @param {number} retries - Number of retries attempted (used internally)
 * @returns {Promise<Object>} - Claude's response
 */
async function sendMessage(message, options = {}, retries = 0) {
  const {
    prompt,
    model = CLAUDE_MODEL,
    maxTokens = 1000,
    systemPrompt = null,
    tools = null,
    toolChoice = null,
    history = []
  } = message;

  const timeout = options.timeout || 30000; // Default 30 second timeout

  const apiKey = config.CLAUDE_API_KEY;

  if (!apiKey) {
    throw new Error('Claude API key is required');
  }

  if (!prompt) {
    throw new Error('Prompt is required');
  }

  // Check if circuit breaker is open
  if (isCircuitBreakerOpen()) {
    const error = new Error('Claude API circuit breaker is open - too many recent failures');
    error.type = ERROR_TYPES.CIRCUIT_OPEN;
    throw error;
  }

  try {
    // Check rate limits before making the request
    await checkRateLimit();

    logger.info('Sending message to Claude API', {
      model,
      maxTokens,
      retryAttempt: retries,
      hasSystemPrompt: Boolean(systemPrompt),
      hasTools: Boolean(tools),
      hasHistory: history.length > 0
    });

    // Construct messages array with history and new message
    const messages = [...history];

    // Add the new user message
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: prompt
        }
      ]
    });

    // Prepare request body
    const requestBody = {
      model: model,
      max_tokens: maxTokens,
      messages: messages
    };

    // Add system prompt if provided
    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    // Add tool choice if provided
    if (toolChoice) {
      requestBody.tool_choice = toolChoice;
    }

    // Use the request queue to manage API calls
    const response = await requestQueue.enqueueRequest(
      async () => {
        return axios.post(
          CLAUDE_API_URL,
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': CLAUDE_API_VERSION
            },
            timeout: timeout // Set request timeout
          }
        );
      },
      {
        id: `claude-request-${Date.now()}`,
        timeout: timeout + 5000, // Add 5 seconds to the timeout for queue processing
        priority: retries > 0 ? 0 : 1 // Prioritize retry attempts
      }
    );

    // Record successful API call
    recordSuccess();

    logger.info('Received response from Claude API', {
      responseLength: JSON.stringify(response.data).length
    });

    return response.data;
  } catch (error) {
    // Classify the error
    const errorType = classifyError(error);

    // Record failure and check if circuit breaker was tripped
    const circuitTripped = recordFailure(error);

    if (circuitTripped) {
      logger.error('Circuit breaker tripped after multiple failures', {
        errorType,
        failures: circuitBreakerFailures
      });

      const circuitError = new Error('Claude API circuit breaker tripped - too many consecutive failures');
      circuitError.type = ERROR_TYPES.CIRCUIT_OPEN;
      circuitError.originalError = error;
      throw circuitError;
    }

    // Handle error based on type and retry if appropriate
    if (retries < MAX_RETRIES) {
      // Check if error is retryable
      const isRetryable = [
        ERROR_TYPES.RATE_LIMIT,
        ERROR_TYPES.SERVER,
        ERROR_TYPES.NETWORK,
        ERROR_TYPES.TIMEOUT
      ].includes(errorType);

      if (isRetryable) {
        // Calculate exponential backoff delay with jitter
        const delay = calculateBackoff(retries);

        logger.warn('Retryable error from Claude API, will retry', {
          errorType,
          status: error.response?.status,
          retryAttempt: retries,
          delay
        });

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry the request
        return sendMessage(message, options, retries + 1);
      }

      // Handle context window errors specifically
      if (error.response &&
          error.response.status === 400 &&
          error.response.data?.error?.type === 'context_window_exceeded') {

        logger.warn('Context window exceeded, trying with fewer tokens', {
          originalPromptLength: prompt.length
        });

        // Truncate the prompt to fit context window
        const shortenedPrompt = prompt.substring(0, Math.floor(prompt.length * 0.8));

        // If the prompt is already very short, don't retry
        if (shortenedPrompt.length < 100) {
          throw new Error('Prompt too long for context window even after truncation');
        }

        // Retry with shortened prompt
        return sendMessage({
          ...message,
          prompt: shortenedPrompt + "\n\n[Note: Original message was truncated due to length constraints.]"
        }, options, retries + 1);
      }
    }

    // Log the error details
    logger.error('Failed to send message to Claude API', {
      errorType,
      error: {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        code: error.code
      },
      retryAttempt: retries
    });

    // Enhance error with more details
    const enhancedError = new Error(`Claude API Error: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.type = errorType;
    enhancedError.status = error.response?.status;
    enhancedError.data = error.response?.data;

    throw enhancedError;
  }
}

/**
 * Process a natural language request through Claude to generate monday.com API actions
 *
 * @param {string} userPrompt - The user's natural language request
 * @returns {Promise<Object>} - Claude's response with actions to perform
 */
async function processMondayRequest(userPrompt) {
  // Define the monday action tool
  const mondayActionTool = {
    name: "monday_action",
    description: "Execute actions on monday.com",
    input_schema: {
      type: "object",
      properties: {
        operation_type: {
          type: "string",
          enum: ["query", "mutation"]
        },
        graphql_string: {
          type: "string"
        },
        variables: {
          type: "object"
        }
      },
      required: ["operation_type", "graphql_string"]
    }
  };

  // Updated system prompt for workflow automation
  const systemPrompt = `You are an advanced monday.com workflow automation assistant. Your primary goal is to help users create, manage, and optimize their monday.com workflows and automations using natural language.

When processing user requests, follow these guidelines:

WORKFLOW CREATION:
1. Analyze the user's request to identify the workflow components they want to create
2. Determine the appropriate monday.com entities (boards, groups, items, columns) needed
3. Generate the required GraphQL operations to create these entities in the correct sequence
4. When creating complex workflows, break them down into logical, sequential steps
5. Always include the necessary column structures and relationships that support the workflow

AUTOMATION CREATION:
1. Identify trigger events from the user's description (e.g., "when an item status changes")
2. Determine appropriate automation actions (e.g., "notify team members")
3. Create the necessary GraphQL operations to establish these automations
4. Include proper error handling and validation for automation conditions
5. Respect automation limits and quotas based on the user's subscription level

ENTITY RELATIONSHIPS:
1. Always establish correct relationships between monday.com entities
2. Create appropriate board-level connections for cross-board workflows
3. Set up mirror columns or item linking when workflows span multiple boards
4. Ensure automations reference the correct entity IDs and types

OAUTH AND PERMISSIONS:
1. Always respect the OAuth scopes available to the application
2. When a user request requires permissions that might not be granted, explain what permissions are needed
3. Recommend appropriate OAuth scope requests when advanced features are needed
4. Never attempt operations that would exceed granted permissions

RESPONSE FORMAT:
1. First explain the workflow or automation you're creating in simple terms
2. Detail the GraphQL operations needed to implement the request
3. Provide clear instructions on how the user can modify or extend the workflow
4. Include suggestions for best practices and optimization of the workflow

AVAILABLE OAUTH SCOPES:
- boards:read,write,create,delete
- items:read,write,create,delete
- columns:read,write,create
- groups:read,write,create
- account:read
- teams:read
- users:read
- automations:read,write,create,delete

COMMON AUTOMATION TRIGGERS:
- Status Change: When an item's status column changes
- Date Arrived: When a date column reaches a specific date
- Item Created: When a new item is created in a board
- Item Name Change: When an item's name changes
- Updates in Subitem: When a subitem is created or modified

COMMON AUTOMATION ACTIONS:
- Create Item: Create a new item in a specified board
- Create Update: Add an update to an item
- Change Column Value: Change a column's value
- Notify: Send a notification to users
- Send Email: Send an email to specified recipients

Always translate the user's natural language request into precise, efficient GraphQL operations that implement their desired workflow and automation needs.`;

  try {
    // Log the incoming request
    logger.info('Processing monday.com request with Claude', {
      promptLength: userPrompt.length
    });

    // Send the request to Claude
    const claudeResponse = await sendMessage({
      prompt: userPrompt,
      systemPrompt: systemPrompt,
      tools: [mondayActionTool],
      toolChoice: {
        type: "tool",
        name: "monday_action"
      },
      maxTokens: 1500 // Increase token limit for complex responses
    }, {
      timeout: 60000 // 60 second timeout for complex operations
    });

    return claudeResponse;
  } catch (error) {
    logger.error('Error processing monday.com request with Claude', { error });

    // Provide better error handling based on error type
    if (error.status === 400) {
      throw new Error('Invalid request format. Please try rephrasing your request.');
    } else if (error.status === 429) {
      throw new Error('Rate limit exceeded. Please try again in a few moments.');
    } else if (error.status >= 500) {
      throw new Error('Claude service is currently experiencing issues. Please try again later.');
    }

    throw error;
  }
}

/**
 * Generate a user-friendly explanation of a monday.com operation result
 *
 * @param {string} userPrompt - The original user prompt
 * @param {Object} mondayResult - The result of the monday.com operation
 * @returns {Promise<string>} - A user-friendly explanation
 */
async function explainMondayResult(userPrompt, mondayResult) {
  try {
    // Enhanced prompt for better explanations
    const prompt = `I need you to explain the result of a monday.com API operation in simple terms.

Original user request: "${userPrompt}"

The action was executed with the following result:
${JSON.stringify(mondayResult, null, 2)}

Please explain in clear, simple terms:
1. What was done based on my request
2. What the result means
3. Any next steps or additional information I should know

Make the explanation conversational and easy to understand for non-technical users.`;

    // Ask Claude to explain the result
    const claudeResponse = await sendMessage({
      prompt: prompt,
      maxTokens: 800 // Limit token length for concise responses
    }, {
      timeout: 30000 // 30 second timeout for explanations
    });

    if (claudeResponse.content && claudeResponse.content.length > 0) {
      return claudeResponse.content[0].text;
    } else {
      return "The operation was completed, but I couldn't generate a detailed explanation of the results.";
    }
  } catch (error) {
    logger.error('Error explaining monday.com result with Claude', { error });

    // Return a generic explanation if Claude API fails
    return `The operation completed with the following result: ${JSON.stringify(mondayResult.data, null, 2)}`;
  }
}

/**
 * Save conversation history for a user
 *
 * @param {string} userId - User ID
 * @param {string} accountId - Account ID
 * @param {Object} conversation - Conversation data to save
 * @returns {Promise<void>}
 */
async function saveConversationHistory(userId, accountId, conversation) {
  try {
    const { Storage } = require('@mondaycom/apps-sdk');
    const storage = new Storage();

    // Create a unique key for this user's conversation history
    const historyKey = `conversation_history_${userId}`;

    // Get existing history
    let history = await storage.get(historyKey) || [];

    // Add new conversation
    history.unshift({
      ...conversation,
      timestamp: new Date().toISOString()
    });

    // Keep only the last 10 conversations
    if (history.length > 10) {
      history = history.slice(0, 10);
    }

    // Save updated history
    await storage.set(historyKey, history);

    logger.info('Saved conversation history', { userId, conversationId: conversation.id });
  } catch (error) {
    logger.error('Failed to save conversation history', { error, userId });
    // Don't throw error to avoid breaking the main flow
  }
}

/**
 * Get conversation history for a user
 *
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Conversation history
 */
async function getConversationHistory(userId) {
  try {
    const { Storage } = require('@mondaycom/apps-sdk');
    const storage = new Storage();

    // Create a unique key for this user's conversation history
    const historyKey = `conversation_history_${userId}`;

    // Get history from storage
    const history = await storage.get(historyKey) || [];

    return history;
  } catch (error) {
    logger.error('Failed to get conversation history', { error, userId });
    return [];
  }
}

module.exports = {
  sendMessage,
  processMondayRequest,
  explainMondayResult,
  saveConversationHistory,
  getConversationHistory,
  isCircuitBreakerOpen,
  ERROR_TYPES
};
