const request = require('supertest');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const { Storage, Logger, Environment, SecureStorage } = require('@mondaycom/apps-sdk');

// Mock the external dependencies
jest.mock('@mondaycom/apps-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })),
  Environment: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockImplementation(key => {
      if (key === 'CLAUDE_API_KEY') return 'test-api-key';
      if (key === 'MONDAY_API_TOKEN') return 'test-api-token';
      if (key === 'REGION') return 'US';
      if (key === 'MONDAY_SIGNING_SECRET') return 'test-signing-secret';
      return null;
    })
  })),
  SecureStorage: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn()
  })),
  Storage: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn()
  }))
}));

// Mock uuid to generate predictable IDs for testing
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid')
}));

// Mock claudeAPI
jest.mock('../monday-claude-utils/enhanced-claudeAPI', () => ({
  processMondayRequest: jest.fn(),
  explainMondayResult: jest.fn(),
  saveConversationHistory: jest.fn(),
  getConversationHistory: jest.fn(),
  sendMessage: jest.fn()
}));

// Mock mondayAPI
jest.mock('../monday-claude-utils/mondayAPI', () => ({
  executeGraphQL: jest.fn()
}));

// Mock monetizationHandler
jest.mock('../monday-claude-utils/monetizationHandler', () => ({
  verifySessionToken: jest.fn(),
  validateWebhookSignature: jest.fn(),
  processSubscriptionEvent: jest.fn(),
  getSubscription: jest.fn(),
  SUBSCRIPTION_PLANS: {
    free_trial: {
      maxRequests: 25,
      featureFlags: {}
    },
    basic_plan: {
      maxRequests: 100,
      featureFlags: {}
    }
  },
  isWithinRequestLimit: jest.fn(),
  incrementUsage: jest.fn(),
  hasFeature: jest.fn()
}));

// Create a minimal Express app for testing
const createTestApp = () => {
  const app = express();
  app.use(bodyParser.json());
  
  // Add request ID middleware
  app.use((req, res, next) => {
    req.id = 'test-request-id';
    next();
  });
  
  // Import the server routes
  const processRequestHandler = require('../enhanced-server').app._router.stack
    .filter(layer => layer.route && layer.route.path === '/api/process-request')[0].route.stack[0].handle;
  
  const processDocumentHandler = require('../enhanced-server').app._router.stack
    .filter(layer => layer.route && layer.route.path === '/api/process-document')[0].route.stack[0].handle;
  
  const getConversationHistoryHandler = require('../enhanced-server').app._router.stack
    .filter(layer => layer.route && layer.route.path === '/api/conversation-history/:userId')[0].route.stack[0].handle;
  
  const clearConversationHistoryHandler = require('../enhanced-server').app._router.stack
    .filter(layer => layer.route && layer.route.path === '/api/conversation-history/:userId' && layer.method === 'delete')[0].route.stack[0].handle;
  
  // Mount the handlers on the test app
  app.post('/api/process-request', processRequestHandler);
  app.post('/api/process-document', processDocumentHandler);
  app.get('/api/conversation-history/:userId', getConversationHistoryHandler);
  app.delete('/api/conversation-history/:userId', clearConversationHistoryHandler);
  
  return app;
};

describe('API Integration Tests', () => {
  let app;
  
  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });
  
  describe('POST /api/process-request', () => {
    test('should process a valid request successfully', async () => {
      // Mock Claude API response
      const claudeAPI = require('../monday-claude-utils/enhanced-claudeAPI');
      claudeAPI.processMondayRequest.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response content' }],
        tool_calls: [
          {
            name: 'monday_action',
            input: {
              operation_type: 'query',
              graphql_string: '{ boards { id name } }',
              variables: {}
            }
          }
        ]
      });
      
      // Mock Monday API response
      const mondayAPI = require('../monday-claude-utils/mondayAPI');
      mondayAPI.executeGraphQL.mockResolvedValueOnce({
        data: {
          boards: [
            { id: '123', name: 'Board 1' }
          ]
        }
      });
      
      // Mock explanation generation
      claudeAPI.explainMondayResult.mockResolvedValueOnce('Fetched your boards successfully.');
      
      // Mock conversation history saving
      claudeAPI.saveConversationHistory.mockResolvedValueOnce();
      
      // Send request
      const response = await request(app)
        .post('/api/process-request')
        .set('Content-Type', 'application/json')
        .send({
          userPrompt: 'Show me my boards',
          userId: 'user123',
          accountId: 'account456',
          boardId: 'board789'
        });
      
      // Verify response
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        requestId: 'test-request-id',
        conversationId: 'test-uuid',
        explanation: 'Fetched your boards successfully.'
      });
      
      // Verify Claude API was called
      expect(claudeAPI.processMondayRequest).toHaveBeenCalledWith('Show me my boards');
      
      // Verify Monday API was called
      expect(mondayAPI.executeGraphQL).toHaveBeenCalledWith(
        '{ boards { id name } }',
        {}
      );
      
      // Verify conversation was saved
      expect(claudeAPI.saveConversationHistory).toHaveBeenCalled();
    });
    
    test('should return 400 for invalid request data', async () => {
      // Send request with missing required fields
      const response = await request(app)
        .post('/api/process-request')
        .set('Content-Type', 'application/json')
        .send({
          // Missing userPrompt
          userId: 'user123',
          accountId: 'account456'
        });
      
      // Verify response
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid request data');
      expect(response.body).toHaveProperty('details');
    });
    
    test('should handle case when Claude does not generate a tool call', async () => {
      // Mock Claude API response without tool calls
      const claudeAPI = require('../monday-claude-utils/enhanced-claudeAPI');
      claudeAPI.processMondayRequest.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'I cannot process this request' }],
        tool_calls: [] // No tool calls
      });
      
      // Send request
      const response = await request(app)
        .post('/api/process-request')
        .set('Content-Type', 'application/json')
        .send({
          userPrompt: 'Invalid request',
          userId: 'user123',
          accountId: 'account456',
          boardId: 'board789'
        });
      
      // Verify response
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        requestId: 'test-request-id',
        message: expect.stringContaining('couldn\'t understand'),
        resolution: expect.stringContaining('Try mentioning')
      });
    });
    
    test('should handle API errors correctly', async () => {
      // Mock Claude API to throw an error
      const claudeAPI = require('../monday-claude-utils/enhanced-claudeAPI');
      claudeAPI.processMondayRequest.mockRejectedValueOnce(new Error('API Error'));
      
      // Send request
      const response = await request(app)
        .post('/api/process-request')
        .set('Content-Type', 'application/json')
        .send({
          userPrompt: 'Show me my boards',
          userId: 'user123',
          accountId: 'account456',
          boardId: 'board789'
        });
      
      // Verify response
      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'Processing error',
        message: expect.stringContaining('unexpected error'),
        errorId: expect.any(String)
      });
    });
    
    test('should handle rate limit errors specifically', async () => {
      // Mock Claude API to throw a rate limit error
      const claudeAPI = require('../monday-claude-utils/enhanced-claudeAPI');
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.response = { status: 429 };
      claudeAPI.processMondayRequest.mockRejectedValueOnce(rateLimitError);
      
      // Send request
      const response = await request(app)
        .post('/api/process-request')
        .set('Content-Type', 'application/json')
        .send({
          userPrompt: 'Show me my boards',
          userId: 'user123',
          accountId: 'account456',
          boardId: 'board789'
        });
      
      // Verify response
      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({
        error: 'Rate limit exceeded',
        message: expect.stringContaining('high demand')
      });
    });
  });
  
  describe('POST /api/process-document', () => {
    test('should process a document successfully', async () => {
      // Mock Claude API response
      const claudeAPI = require('../monday-claude-utils/enhanced-claudeAPI');
      claudeAPI.sendMessage.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Document summary' }]
      });
      
      // Send request
      const response = await request(app)
        .post('/api/process-document')
        .set('Content-Type', 'application/json')
        .send({
          document: 'This is a test document.',
          action: 'summarize',
          userId: 'user123',
          accountId: 'account456'
        });
      
      // Verify response
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        result: 'Document summary',
        action: 'summarize'
      });
      
      // Verify Claude API was called with correct prompt
      expect(claudeAPI.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        prompt: expect.stringContaining('This is a test document')
      }));
    });
    
    test('should return 400 for invalid request data', async () => {
      // Send request with invalid action
      const response = await request(app)
        .post('/api/process-document')
        .set('Content-Type', 'application/json')
        .send({
          document: 'This is a test document.',
          action: 'invalid_action', // Invalid action
          userId: 'user123',
          accountId: 'account456'
        });
      
      // Verify response
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid request data');
    });
    
    test('should handle API errors correctly', async () => {
      // Mock Claude API to throw an error
      const claudeAPI = require('../monday-claude-utils/enhanced-claudeAPI');
      claudeAPI.sendMessage.mockRejectedValueOnce(new Error('API Error'));
      
      // Send request
      const response = await request(app)
        .post('/api/process-document')
        .set('Content-Type', 'application/json')
        .send({
          document: 'This is a test document.',
          action: 'summarize',
          userId: 'user123',
          accountId: 'account456'
        });
      
      // Verify response
      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'Processing error',
        message: expect.stringContaining('unexpected error')
      });
    });
  });
  
  describe('GET /api/conversation-history/:userId', () => {
    test('should get conversation history for a user', async () => {
      // Mock conversation history
      const mockHistory = [
        {
          id: 'conv1',
          prompt: 'Show me my boards',
          explanation: 'Here are your boards',
          timestamp: '2025-01-01T00:00:00.000Z'
        }
      ];
      
      // Mock Claude API response
      const claudeAPI = require('../monday-claude-utils/enhanced-claudeAPI');
      claudeAPI.getConversationHistory.mockResolvedValueOnce(mockHistory);
      
      // Mock session token validation
      const monetizationHandler = require('../monday-claude-utils/monetizationHandler');
      monetizationHandler.verifySessionToken.mockReturnValueOnce({ userId: 'user123' });
      
      // Send request
      const response = await request(app)
        .get('/api/conversation-history/user123')
        .set('x-monday-session-token', 'valid-token');
      
      // Verify response
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockHistory);
      
      // Verify API was called
      expect(claudeAPI.getConversationHistory).toHaveBeenCalledWith('user123');
    });
    
    test('should return 401 when session token is missing', async () => {
      // Send request without session token
      const response = await request(app)
        .get('/api/conversation-history/user123');
      
      // Verify response
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Missing session token');
    });
  });
  
  describe('DELETE /api/conversation-history/:userId', () => {
    test('should clear conversation history for a user', async () => {
      // Mock conversation history
      const storage = require('@mondaycom/apps-sdk').Storage();
      storage.set.mockResolvedValueOnce(true);
      
      // Mock session token validation
      const monetizationHandler = require('../monday-claude-utils/monetizationHandler');
      monetizationHandler.verifySessionToken.mockReturnValueOnce({ userId: 'user123' });
      
      // Send request
      const response = await request(app)
        .delete('/api/conversation-history/user123')
        .set('x-monday-session-token', 'valid-token');
      
      // Verify response
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ success: true });
      
      // Verify storage was called to clear history
      expect(storage.set).toHaveBeenCalledWith('conversation_history_user123', []);
    });
    
    test('should return 401 when session token is missing', async () => {
      // Send request without session token
      const response = await request(app)
        .delete('/api/conversation-history/user123');
      
      // Verify response
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Missing session token');
    });
  });
});