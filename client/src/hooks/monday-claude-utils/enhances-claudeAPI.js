/**
 * Enhanced Claude API Utility with retry logic and better error handling
 */

const axios = require('axios');
const { Logger, Environment } = require('@mondaycom/apps-sdk');

const logger = new Logger('claude-api-utils');
const env = new Environment();

// Claude API configuration
const CLAUDE_API_URL = env.get('CLAUDE_API_URL') || 'https://api.anthropic.com/v1/messages';
const CLAUDE_API_VERSION = env.get('CLAUDE_API_VERSION') || '2023-06-01';
const CLAUDE_MODEL = env.get('CLAUDE_MODEL') || 'claude-3-5-sonnet-20240307';
const MAX_RETRIES = 3;

/**
 * Send a message to Claude API with retry logic
 * 
 * @param {Object} message - Message object to send to Claude
 * @param {string} message.prompt - User's prompt/question
 * @param {string} message.model - Claude model to use (defaults to CLAUDE_MODEL env var)
 * @param {number} message.maxTokens - Maximum tokens in response (defaults to 1000)
 * @param {Object[]} message.systemPrompt - Optional system prompt
 * @param {Object[]} message.tools - Optional tools for Claude to use
 * @param {Object} message.toolChoice - Optional tool choice object
 * @param {Object[]} message.history - Optional conversation history
 * @param {number} retries - Number of retries attempted (used internally)
 * @returns {Promise<Object>} - Claude's response
 */
async function sendMessage(message, retries = 0) {
  const {
    prompt,
    model = CLAUDE_MODEL,
    maxTokens = 1000,
    systemPrompt = null,
    tools = null,
    toolChoice = null,
    history = []
  } = message;

  const apiKey = env.get('CLAUDE_API_KEY');

  if (!apiKey) {
    throw new Error('Claude API key is required');
  }

  if (!prompt) {
    throw new Error('Prompt is required');
  }

  try {
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

    const response = await axios.post(
      CLAUDE_API_URL,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': CLAUDE_API_VERSION
        }
      }
    );

    logger.info('Received response from Claude API', {
      responseLength: JSON.stringify(response.data).length
    });
    
    return response.data;
  } catch (error) {
    // Handle error based on type and retry if appropriate
    if (retries < MAX_RETRIES) {
      // Check if error is retryable (rate limits or server errors)
      if (error.response && (
          error.response.status === 429 || // Rate limit
          error.response.status >= 500 || // Server error
          error.response.status === 408)) { // Timeout
        
        // Calculate exponential backoff delay
        const delay = Math.pow(2, retries) * 1000 + Math.random() * 1000;
        
        logger.warn(`Claude API error, retrying in ${delay}ms`, {
          status: error.response?.status,
          retryAttempt: retries,
          delay
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the request
        return sendMessage(message, retries + 1);
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
        }, retries + 1);
      }
    }
    
    // Log the error details
    logger.error('Failed to send message to Claude API', { 
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

  // Enhanced system prompt with more detailed guidance
  const systemPrompt = `You are a monday.com assistant that helps users manage their boards, items, and workflows. 
  Your job is to translate natural language requests into specific monday.com GraphQL operations.
  Focus on understanding the user's intent and generating the precise GraphQL query or mutation needed.
  
  Guidelines:
  1. The monday.com GraphQL API uses snake_case for field names and mutations
  2. Always validate inputs before executing operations
  3. Use appropriate variables for dynamic values
  4. Keep queries focused and efficient
  5. Include only necessary fields in the response
  
  Common monday.com entities:
  - Boards: collections of items organized in groups
  - Items: individual tasks or records on a board
  - Subitems: nested items under a parent item
  - Columns: fields on a board (text, status, person, date, etc.)
  - Groups: sections within a board to organize items
  
  If the user request is ambiguous or missing critical information, choose the most reasonable default
  or generate a query that would provide the information needed to complete the request.`;

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
    });

    return claudeResponse;
  } catch (error) {
    logger.error('Error processing monday.com request with Claude', { error });
    
    // Provide better error handling based on error type
    if (error.status === 400) {
      throw new Error(`Invalid request: ${error.data?.error?.message || error.message}`);
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
    const prompt = `I asked: ${userPrompt}

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
    });

    if (claudeResponse.content && claudeResponse.content.length > 0) {
      return claudeResponse.content[0].text;
    } else {
      return "The operation was completed, but I couldn't generate a detailed explanation of the results.";
    }
  } catch (error) {
    logger.error('Error explaining monday.com result with Claude', { error });
    
    // Return a generic explanation if Claude API fails
    return `The operation completed with the following result: ${JSON.stringify(mondayResult.data || {}, null, 2)}`;
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
    
    // Get existing history
    const historyKey = `conversation_history_${userId}`;
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
    
    // Get history from storage
    const historyKey = `conversation_history_${userId}`;
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
  getConversationHistory
};