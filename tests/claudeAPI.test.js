const axios = require('axios');
const { Logger, Environment, Storage } = require('@mondaycom/apps-sdk');

// Mock the external dependencies
jest.mock('axios');
jest.mock('@mondaycom/apps-sdk', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })),
  Environment: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockImplementation(key => {
      if (key === 'CLAUDE_API_KEY') return 'test-api-key';
      if (key === 'CLAUDE_API_URL') return 'https://api.anthropic.com/v1/messages';
      if (key === 'CLAUDE_API_VERSION') return '2023-06-01';
      if (key === 'CLAUDE_MODEL') return 'claude-3-5-sonnet-20240307';
      return null;
    })
  })),
  Storage: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn()
  }))
}));

// Import the module to test
const claudeAPI = require('../monday-claude-utils/enhanced-claudeAPI');

describe('Claude API Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('sendMessage', () => {
    test('should send a message to Claude API successfully', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          id: 'msg_123',
          content: [{ type: 'text', text: 'This is a response' }],
          model: 'claude-3-5-sonnet-20240307'
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      // Call the function
      const result = await claudeAPI.sendMessage({
        prompt: 'Hello, Claude!'
      });
      
      // Verify axios was called correctly
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          model: 'claude-3-5-sonnet-20240307',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Hello, Claude!'
                }
              ]
            }
          ]
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'test-api-key',
            'anthropic-version': '2023-06-01'
          })
        })
      );
      
      // Verify the result
      expect(result).toEqual(mockResponse.data);
    });
    
    test('should retry on rate limit errors', async () => {
      // Mock rate limit error then success
      const rateLimitError = {
        response: {
          status: 429,
          data: { error: { type: 'rate_limit_error', message: 'Too many requests' } }
        }
      };
      
      const mockResponse = {
        data: {
          id: 'msg_123',
          content: [{ type: 'text', text: 'This is a response' }]
        }
      };
      
      axios.post.mockRejectedValueOnce(rateLimitError)
             .mockResolvedValueOnce(mockResponse);
      
      // Mock setTimeout to avoid waiting
      jest.spyOn(global, 'setTimeout').mockImplementation(callback => callback());
      
      // Call the function
      const result = await claudeAPI.sendMessage({
        prompt: 'Hello, Claude!'
      });
      
      // Verify axios was called twice (first failure, then retry)
      expect(axios.post).toHaveBeenCalledTimes(2);
      
      // Verify the result is from the second call
      expect(result).toEqual(mockResponse.data);
    });
    
    test('should handle context window errors by truncating the prompt', async () => {
      // Mock context window error then success
      const contextWindowError = {
        response: {
          status: 400,
          data: { error: { type: 'context_window_exceeded', message: 'Context window exceeded' } }
        }
      };
      
      const mockResponse = {
        data: {
          id: 'msg_123',
          content: [{ type: 'text', text: 'This is a response' }]
        }
      };
      
      axios.post.mockRejectedValueOnce(contextWindowError)
             .mockResolvedValueOnce(mockResponse);
      
      // Call the function with a long prompt
      const longPrompt = 'A'.repeat(1000);
      const result = await claudeAPI.sendMessage({
        prompt: longPrompt
      });
      
      // Verify axios was called twice (first failure, then retry with shorter prompt)
      expect(axios.post).toHaveBeenCalledTimes(2);
      
      // Verify the second call used a shortened prompt
      const secondCallArgs = axios.post.mock.calls[1][0];
      expect(secondCallArgs).toEqual('https://api.anthropic.com/v1/messages');
      
      const requestBody = axios.post.mock.calls[1][1];
      const promptInRequest = requestBody.messages[0].content[0].text;
      
      // Check that prompt was truncated and has the truncation notice
      expect(promptInRequest.length).toBeLessThan(longPrompt.length);
      expect(promptInRequest).toContain('[Note: Original message was truncated');
      
      // Verify the result
      expect(result).toEqual(mockResponse.data);
    });
    
    test('should throw enhanced error for non-retryable errors', async () => {
      // Mock a client error
      const clientError = {
        response: {
          status: 400,
          data: { error: { type: 'invalid_request_error', message: 'Invalid request' } }
        }
      };
      
      axios.post.mockRejectedValueOnce(clientError);
      
      // Call the function and expect it to throw
      await expect(claudeAPI.sendMessage({
        prompt: 'Hello, Claude!'
      })).rejects.toThrow('Claude API Error');
      
      // Verify axios was called once (no retry)
      expect(axios.post).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('processMondayRequest', () => {
    test('should process a monday.com request successfully', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          id: 'msg_123',
          content: [{ type: 'text', text: 'This is a response' }],
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
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      // Call the function
      const result = await claudeAPI.processMondayRequest('Show me my boards');
      
      // Verify axios was called correctly
      expect(axios.post).toHaveBeenCalledTimes(1);
      
      // Verify the request included tool definition and system prompt
      const requestBody = axios.post.mock.calls[0][1];
      expect(requestBody).toHaveProperty('tools');
      expect(requestBody).toHaveProperty('system');
      expect(requestBody.tools[0].name).toBe('monday_action');
      
      // Verify tool choice was set correctly
      expect(requestBody).toHaveProperty('tool_choice');
      expect(requestBody.tool_choice.name).toBe('monday_action');
      
      // Verify the result
      expect(result).toEqual(mockResponse.data);
    });
    
    test('should provide specific error message for rate limit errors', async () => {
      // Mock rate limit error
      const rateLimitError = {
        response: {
          status: 429,
          data: { error: { type: 'rate_limit_error', message: 'Too many requests' } }
        },
        status: 429
      };
      
      axios.post.mockRejectedValueOnce(rateLimitError);
      
      // Call the function and expect it to throw with specific message
      await expect(claudeAPI.processMondayRequest('Show me my boards'))
        .rejects.toThrow('Rate limit exceeded. Please try again in a few moments.');
    });
  });
  
  describe('explainMondayResult', () => {
    test('should generate explanation for monday.com operation result', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          id: 'msg_123',
          content: [{ type: 'text', text: 'I created a new board called "Project X".' }]
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      // Call the function
      const result = await claudeAPI.explainMondayResult(
        'Create a new board called Project X',
        { data: { create_board: { id: '12345', name: 'Project X' } } }
      );
      
      // Verify axios was called correctly
      expect(axios.post).toHaveBeenCalledTimes(1);
      
      // Verify the prompt includes the user prompt and operation result
      const requestBody = axios.post.mock.calls[0][1];
      const promptText = requestBody.messages[0].content[0].text;
      expect(promptText).toContain('Create a new board called Project X');
      expect(promptText).toContain('Project X');
      
      // Verify the result
      expect(result).toBe('I created a new board called "Project X".');
    });
    
    test('should return generic explanation if API call fails', async () => {
      // Mock API error
      axios.post.mockRejectedValueOnce(new Error('API Error'));
      
      // Call the function
      const result = await claudeAPI.explainMondayResult(
        'Create a new board',
        { data: { create_board: { id: '12345', name: 'Test Board' } } }
      );
      
      // Verify the result is a generic explanation
      expect(result).toContain('The operation completed with the following result');
      expect(result).toContain('Test Board');
    });
  });
  
  describe('Conversation History', () => {
    test('should save conversation history', async () => {
      // Mock storage
      const mockStorage = { set: jest.fn().mockResolvedValue(true) };
      Storage.mockImplementation(() => mockStorage);
      
      // Call the function
      await claudeAPI.saveConversationHistory('user123', 'account456', {
        id: 'conv789',
        prompt: 'Create a board',
        explanation: 'Created a new board'
      });
      
      // Verify storage was called correctly
      expect(mockStorage.set).toHaveBeenCalledTimes(1);
      expect(mockStorage.set).toHaveBeenCalledWith(
        'conversation_history_user123',
        expect.arrayContaining([
          expect.objectContaining({
            id: 'conv789',
            prompt: 'Create a board',
            explanation: 'Created a new board',
            timestamp: expect.any(String)
          })
        ])
      );
    });
    
    test('should get conversation history', async () => {
      // Mock storage with existing history
      const mockHistory = [
        {
          id: 'conv123',
          prompt: 'Create a board',
          explanation: 'Created a new board',
          timestamp: '2025-01-01T00:00:00.000Z'
        }
      ];
      
      const mockStorage = { 
        get: jest.fn().mockResolvedValue(mockHistory)
      };
      
      Storage.mockImplementation(() => mockStorage);
      
      // Call the function
      const result = await claudeAPI.getConversationHistory('user123');
      
      // Verify storage was called correctly
      expect(mockStorage.get).toHaveBeenCalledTimes(1);
      expect(mockStorage.get).toHaveBeenCalledWith('conversation_history_user123');
      
      // Verify the result
      expect(result).toEqual(mockHistory);
    });
    
    test('should return empty array if history not found', async () => {
      // Mock storage with no history
      const mockStorage = { 
        get: jest.fn().mockResolvedValue(null)
      };
      
      Storage.mockImplementation(() => mockStorage);
      
      // Call the function
      const result = await claudeAPI.getConversationHistory('user123');
      
      // Verify storage was called
      expect(mockStorage.get).toHaveBeenCalledTimes(1);
      
      // Verify the result is an empty array
      expect(result).toEqual([]);
    });
  });
});