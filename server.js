// server.js with enhanced security and error handling
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { validationResult, body } = require('express-validator');
const { Storage, Logger, Environment } = require('@mondaycom/apps-sdk');

// Import route handlers
const monetizationRoutes = require('./monetization-routes');
const oauthRoutes = require('./oauth-routes');

// Import utility modules
const claudeAPI = require('./monday-claude-utils/enhanced-claudeAPI');
const mondayAPI = require('./monday-claude-utils/mondayAPI');
const automationUtils = require('./monday-claude-utils/automationUtils');
const scopeValidator = require('./monday-claude-utils/scopeValidator');

const app = express();

// Initialize monday's SDK components
const storage = new Storage();
const logger = new Logger('monday-claude-integration');
const env = new Environment();

// Generate request IDs for tracking
app.use((req, res, next) => {
  req.id = uuidv4();
  next();
});

// Apply compression middleware
app.use(compression({
  // Only compress responses larger than 1KB
  threshold: 1024,
  // Filter based on request headers
  filter: (req, res) => {
    // Don't compress responses for old browsers without gzip support
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use the default compression filter function
    return compression.filter(req, res);
  },
  // Set compression level (0-9, where 9 is maximum compression)
  level: 6
}));

// Security middleware
app.use(helmet());
app.use(bodyParser.json());

// Configure rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later'
  }
});

// Apply rate limiting to API endpoints
app.use('/api/', apiLimiter);

// Load environment variables
const CLAUDE_API_KEY = env.get('CLAUDE_API_KEY');
const MONDAY_API_TOKEN = env.get('MONDAY_API_TOKEN');
const REGION = env.get('REGION') || 'US';

// Region-specific API endpoints
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

// Set region-specific endpoints
const MONDAY_API_URL = regionConfig.MONDAY_API_URL;
const CLAUDE_API_URL = regionConfig.CLAUDE_API_URL;

// Mount route handlers
app.use('/', oauthRoutes);
app.use('/api', monetizationRoutes);

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', region: REGION });
});

/**
 * Webhook challenge endpoint
 */
app.post('/webhook/challenge', (req, res) => {
  // Handle Monday.com webhook challenge
  if (req.body.challenge) {
    return res.json({ challenge: req.body.challenge });
  }
  
  res.status(400).json({ error: 'Invalid webhook payload' });
});

/**
 * Process a natural language request
 */
app.post('/api/process-request', [
  // Input validation
  body('userPrompt').isString().trim().isLength({ min: 1, max: 2000 })
    .withMessage('User prompt is required and must be between 1 and 2000 characters'),
  body('userId').isString().trim().notEmpty()
    .withMessage('User ID is required'),
  body('accountId').isString().trim().notEmpty()
    .withMessage('Account ID is required'),
  body('boardId').optional().isString()
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: errors.array() 
      });
    }
    
    const { userPrompt, userId, accountId, boardId } = req.body;
    
    // Track request in logs
    logger.info('Processing request', { 
      requestId: req.id,
      userId,
      accountId,
      boardId,
      promptLength: userPrompt.length
    });
    
    // Store the request in storage for logging/history
    await storage.set(`user_${userId}_request_${Date.now()}`, {
      prompt: userPrompt,
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
    
    // Process the request with Claude
    const claudeResponse = await claudeAPI.processMondayRequest(userPrompt);
    
    // Check if Claude generated a tool call
    if (claudeResponse.content && 
        claudeResponse.tool_calls && 
        claudeResponse.tool_calls.length > 0) {
      
      const toolCall = claudeResponse.tool_calls[0];
      
      if (toolCall.name === 'monday_action' && toolCall.input) {
        const { operation_type, graphql_string, variables } = toolCall.input;
        
        logger.info('Executing Monday.com operation', { 
          requestId: req.id,
          operationType: operation_type,
          variables: Object.keys(variables || {})
        });
        
        // Execute the monday.com operation
        const mondayResult = await mondayAPI.executeGraphQL(
          graphql_string,
          variables
        );
        
        // Generate explanation of the result
        const explanation = await claudeAPI.explainMondayResult(
          userPrompt,
          mondayResult
        );
        
        // Generate a unique ID for this conversation
        const conversationId = uuidv4();
        
        // Save conversation to history
        await claudeAPI.saveConversationHistory(userId, accountId, {
          id: conversationId,
          prompt: userPrompt,
          action: {
            operationType: operation_type,
            graphqlString: graphql_string,
            variables: variables
          },
          result: mondayResult,
          explanation,
          timestamp: new Date().toISOString()
        });
        
        return res.json({
          requestId: req.id,
          conversationId,
          action: {
            operationType: operation_type,
            graphqlString: graphql_string,
            variables: variables
          },
          result: mondayResult,
          explanation
        });
      }
    }
    
    // If Claude didn't generate a tool call, return a helpful message
    logger.warn('Claude did not generate a tool call', { requestId: req.id });
    
    return res.json({
      requestId: req.id,
      message: "I couldn't understand how to convert your request into a Monday.com action. Please try rephrasing with more specific details about what you'd like to do.",
      resolution: "Try mentioning specific boards, items, or actions you want to perform."
    });
    
  } catch (error) {
    const errorId = uuidv4();
    
    // Log detailed error information
    logger.error('Error processing request', { 
      errorId,
      requestId: req.id,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        // Include response info if it's an API error
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      }
    });
    
    // Return appropriate error response based on type
    if (error.response) {
      // API error response
      if (error.response.status === 429) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded',
          message: 'The service is experiencing high demand. Please try again later.',
          errorId
        });
      } else if (error.response.status >= 500) {
        return res.status(502).json({ 
          error: 'External service error',
          message: 'There was an issue communicating with our services. Please try again later.',
          errorId
        });
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      return res.status(503).json({ 
        error: 'Service unavailable',
        message: 'Unable to connect to required services. Please try again later.',
        errorId
      });
    }
    
    // Generic error for other cases
    return res.status(500).json({ 
      error: 'Processing error',
      message: 'An unexpected error occurred while processing your request. Our team has been notified.',
      errorId
    });
  }
});

/**
 * Process a document with Claude
 */
app.post('/api/process-document', [
  // Input validation
  body('document').isString().trim().isLength({ min: 1, max: 10000 })
    .withMessage('Document is required and must be between 1 and 10000 characters'),
  body('action').isString().trim().isIn(['summarize', 'analyze', 'extract_key_points', 'extract_action_items', 'simplify'])
    .withMessage('Valid action is required'),
  body('userId').isString().trim().notEmpty()
    .withMessage('User ID is required'),
  body('accountId').isString().trim().notEmpty()
    .withMessage('Account ID is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: errors.array() 
      });
    }
    
    const { document, action, userId, accountId } = req.body;
    
    // Map actions to prompts
    const actionPrompts = {
      'summarize': `Please provide a concise summary of the following document:\n\n${document}`,
      'analyze': `Please analyze the following document, including key themes, tone, and structure:\n\n${document}`,
      'extract_key_points': `Please extract the key points from the following document:\n\n${document}`,
      'extract_action_items': `Please identify all action items or tasks mentioned in the following document:\n\n${document}`,
      'simplify': `Please rewrite the following document in simpler, more accessible language while preserving all key information:\n\n${document}`
    };
    
    // Get the appropriate prompt
    const prompt = actionPrompts[action];
    
    // Process with Claude
    const claudeResponse = await claudeAPI.sendMessage({
      prompt: prompt,
      maxTokens: 1500
    });
    
    // Extract the content from Claude's response
    let result = '';
    if (claudeResponse.content && claudeResponse.content.length > 0) {
      result = claudeResponse.content[0].text;
    } else {
      result = "Could not process the document. Please try again with a clearer document.";
    }
    
    return res.json({
      result,
      action
    });
    
  } catch (error) {
    const errorId = uuidv4();
    
    // Log detailed error information
    logger.error('Error processing document', { 
      errorId,
      requestId: req.id,
      error: {
        message: error.message,
        stack: error.stack
      }
    });
    
    // Return appropriate error response
    return res.status(500).json({ 
      error: 'Processing error',
      message: 'An unexpected error occurred while processing your document.',
      errorId
    });
  }
});

/**
 * Endpoint to test automation logic without creating it
 */
app.post('/api/test-automation', [
  // Input validation
  body('automation').isObject().withMessage('Automation configuration is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: errors.array() 
      });
    }
    
    const { automation } = req.body;
    
    // Validate automation structure
    const validationResult = automationUtils.validateAutomationConfiguration(automation);
    if (!validationResult.isValid) {
      return res.status(400).json({
        error: 'Invalid automation structure',
        details: validationResult.errors
      });
    }
    
    // Generate optimization suggestions
    const suggestions = automationUtils.generateOptimizationSuggestions(automation);
    
    // Check for required permissions
    const requiredScopes = [['automations', 'create']];
    
    // Return success with any suggestions
    return res.json({
      result: 'success',
      message: 'Automation configuration is valid',
      suggestions,
      requiredPermissions: {
        scopes: requiredScopes,
        message: 'Creating automations requires the automations:create permission'
      }
    });
    
  } catch (error) {
    const errorId = uuidv4();
    logger.error('Error testing automation', { errorId, error });
    
    return res.status(500).json({ 
      error: 'Failed to test automation',
      errorId
    });
  }
});

/**
 * Get workflow templates endpoint
 */
app.get('/api/workflow-templates', (req, res) => {
  try {
    const workflowTemplates = require('./monday-claude-utils/workflowTemplates');
    const templates = workflowTemplates.getAvailableTemplateNames();
    
    return res.json({
      templates
    });
  } catch (error) {
    logger.error('Error getting workflow templates', { error });
    return res.status(500).json({ error: 'Failed to retrieve workflow templates' });
  }
});

/**
 * Get specific workflow template
 */
app.get('/api/workflow-templates/:templateName', (req, res) => {
  try {
    const { templateName } = req.params;
    const workflowTemplates = require('./monday-claude-utils/workflowTemplates');
    const template = workflowTemplates.getWorkflowTemplate(templateName);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    return res.json({
      template
    });
  } catch (error) {
    logger.error('Error getting workflow template', { error });
    return res.status(500).json({ error: 'Failed to retrieve workflow template' });
  }
});

/**
 * Get conversation history for a user
 */
app.get('/api/conversation-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate session token
    const sessionToken = req.headers['x-monday-session-token'];
    if (!sessionToken) {
      return res.status(401).json({ error: 'Missing session token' });
    }
    
    // Get conversation history
    const history = await claudeAPI.getConversationHistory(userId);
    
    return res.json(history);
  } catch (error) {
    logger.error('Error getting conversation history', { 
      error, 
      userId: req.params.userId 
    });
    
    return res.status(500).json({ 
      error: 'Failed to retrieve conversation history' 
    });
  }
});

/**
 * Clear conversation history for a user
 */
app.delete('/api/conversation-history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate session token
    const sessionToken = req.headers['x-monday-session-token'];
    if (!sessionToken) {
      return res.status(401).json({ error: 'Missing session token' });
    }
    
    // Clear history (set empty array)
    const historyKey = `conversation_history_${userId}`;
    await storage.set(historyKey, []);
    
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error clearing conversation history', { 
      error, 
      userId: req.params.userId 
    });
    
    return res.status(500).json({ 
      error: 'Failed to clear conversation history' 
    });
  }
});

// Serve static files from the client/build directory with caching
app.use(express.static('client/build', {
  maxAge: '1d', // Cache static assets for 1 day
  etag: true, // Enable ETag header
  lastModified: true // Enable Last-Modified header
}));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${REGION} region`);
});

// Export for testing
module.exports = {
  app
};