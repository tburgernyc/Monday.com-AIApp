/**
 * Integration tests for Monday.com Claude Integration App API
 */

const request = require('supertest');
const { app } = require('../server');
const mondayAPI = require('../monday-claude-utils/mondayAPI');
const claudeAPI = require('../monday-claude-utils/enhanced-claudeAPI');
const jwt = require('jsonwebtoken');
const config = require('../config');

// Mock dependencies
jest.mock('../monday-claude-utils/mondayAPI');
jest.mock('../monday-claude-utils/enhanced-claudeAPI');

describe('API Integration Tests', () => {
  let mockSessionToken;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock session token
    mockSessionToken = jwt.sign(
      { 
        userId: 'user123',
        accountId: 'account456',
        permissions: ['boards:read', 'boards:write']
      },
      config.MONDAY_CLIENT_SECRET,
      { algorithm: 'HS256' }
    );
  });
  
  describe('GET /health', () => {
    it('should return a successful health check', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('region');
      expect(response.body).toHaveProperty('services');
    });
  });
  
  describe('POST /api/process-request', () => {
    it('should process a valid request successfully', async () => {
      // Mock Claude API to return a tool call
      claudeAPI.processMondayRequest.mockResolvedValue({
        content: [{ text: 'I will create a new board' }],
        tool_calls: [{
          name: 'monday_action',
          input: {
            operation_type: 'mutation',
            graphql_string: 'mutation { create_board(board_name: "Test Board") { id } }',
            variables: {}
          }
        }]
      });
      
      // Mock Monday API to return a successful result
      mondayAPI.executeGraphQL.mockResolvedValue({
        data: { create_board: { id: '12345' } }
      });
      
      // Mock explanation generation
      claudeAPI.explainMondayResult.mockResolvedValue('I created a new board for you');
      
      // Mock conversation history saving
      claudeAPI.saveConversationHistory.mockResolvedValue();
      
      const response = await request(app)
        .post('/api/process-request')
        .set('x-monday-session-token', mockSessionToken)
        .send({
          userPrompt: 'Create a new board called Test Board',
          userId: 'user123',
          accountId: 'account456',
          boardId: 'board789'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('explanation', 'I created a new board for you');
      expect(claudeAPI.processMondayRequest).toHaveBeenCalledWith('Create a new board called Test Board');
      expect(mondayAPI.executeGraphQL).toHaveBeenCalled();
    });
    
    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/process-request')
        .set('x-monday-session-token', mockSessionToken)
        .send({
          // Missing required fields
          userPrompt: '',
          userId: '',
          accountId: ''
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should handle Claude API errors gracefully', async () => {
      // Mock Claude API to throw an error
      claudeAPI.processMondayRequest.mockRejectedValue(new Error('Claude API error'));
      
      const response = await request(app)
        .post('/api/process-request')
        .set('x-monday-session-token', mockSessionToken)
        .send({
          userPrompt: 'Create a new board called Test Board',
          userId: 'user123',
          accountId: 'account456',
          boardId: 'board789'
        });
      
      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('GET /api/conversation-history/:userId', () => {
    it('should return conversation history for a user', async () => {
      // Mock conversation history
      const mockHistory = [
        { id: 'conv1', prompt: 'Test prompt 1', timestamp: new Date().toISOString() },
        { id: 'conv2', prompt: 'Test prompt 2', timestamp: new Date().toISOString() }
      ];
      
      claudeAPI.getConversationHistory.mockResolvedValue(mockHistory);
      
      const response = await request(app)
        .get('/api/conversation-history/user123')
        .set('x-monday-session-token', mockSessionToken);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockHistory);
      expect(claudeAPI.getConversationHistory).toHaveBeenCalledWith('user123');
    });
    
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/conversation-history/user123');
      
      expect(response.status).toBe(401);
    });
  });
  
  describe('DELETE /api/conversation-history/:userId', () => {
    it('should clear conversation history for a user', async () => {
      const response = await request(app)
        .delete('/api/conversation-history/user123')
        .set('x-monday-session-token', mockSessionToken);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
    
    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/conversation-history/user123');
      
      expect(response.status).toBe(401);
    });
  });
});
