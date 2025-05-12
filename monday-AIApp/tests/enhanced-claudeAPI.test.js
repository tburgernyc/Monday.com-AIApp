/**
 * Unit tests for Enhanced Claude API utility
 */

const axios = require('axios');
const { sendMessage, ERROR_TYPES } = require('../monday-claude-utils/enhanced-claudeAPI');
const requestQueue = require('../monday-claude-utils/requestQueue');

// Mock dependencies
jest.mock('axios');
jest.mock('../monday-claude-utils/requestQueue');

describe('Enhanced Claude API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.CLAUDE_API_KEY = 'test-api-key';
    
    // Mock requestQueue.enqueueRequest to directly call and return the function result
    requestQueue.enqueueRequest.mockImplementation(async (fn) => {
      return fn();
    });
  });
  
  describe('sendMessage', () => {
    it('should send a message to Claude API successfully', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          content: [{ text: 'Test response' }]
        }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const result = await sendMessage({
        prompt: 'Test prompt',
        model: 'claude-3-5-sonnet-20240307',
        maxTokens: 500
      });
      
      expect(result).toEqual(mockResponse.data);
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post.mock.calls[0][1]).toMatchObject({
        model: 'claude-3-5-sonnet-20240307',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Test prompt' }]
          }
        ]
      });
    });
    
    it('should handle rate limiting with exponential backoff', async () => {
      // Mock rate limit error then success
      axios.post
        .mockRejectedValueOnce({
          response: {
            status: 429,
            data: { error: { type: 'rate_limit_error' } }
          }
        })
        .mockResolvedValueOnce({
          data: { content: [{ text: 'Success response' }] }
        });
      
      // Mock setTimeout to avoid actual waiting
      jest.spyOn(global, 'setTimeout').mockImplementation(cb => cb());
      
      const result = await sendMessage({ prompt: 'Test prompt' });
      
      expect(axios.post).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ content: [{ text: 'Success response' }] });
    });
    
    it('should handle context window exceeded errors by truncating the prompt', async () => {
      // Mock context window error then success
      axios.post
        .mockRejectedValueOnce({
          response: {
            status: 400,
            data: { error: { type: 'context_window_exceeded' } }
          }
        })
        .mockResolvedValueOnce({
          data: { content: [{ text: 'Success with truncated prompt' }] }
        });
      
      // Create a long prompt
      const longPrompt = 'A'.repeat(1000);
      
      const result = await sendMessage({ prompt: longPrompt });
      
      expect(axios.post).toHaveBeenCalledTimes(2);
      
      // Check that the second call used a truncated prompt
      const secondCallPrompt = axios.post.mock.calls[1][1].messages[0].content[0].text;
      expect(secondCallPrompt.length).toBeLessThan(longPrompt.length);
      expect(secondCallPrompt).toContain('[Note: Original message was truncated');
      
      expect(result).toEqual({ content: [{ text: 'Success with truncated prompt' }] });
    });
    
    it('should enhance errors with additional information', async () => {
      // Mock API error
      const apiError = {
        response: {
          status: 400,
          data: { error: { message: 'Invalid request' } }
        },
        message: 'Request failed with status code 400'
      };
      
      axios.post.mockRejectedValue(apiError);
      
      await expect(sendMessage({ prompt: 'Test prompt' })).rejects.toThrow('Claude API Error');
      
      try {
        await sendMessage({ prompt: 'Test prompt' });
      } catch (error) {
        expect(error.originalError).toBeDefined();
        expect(error.type).toBe(ERROR_TYPES.VALIDATION);
        expect(error.status).toBe(400);
      }
    });
    
    it('should throw an error if API key is missing', async () => {
      // Remove API key
      delete process.env.CLAUDE_API_KEY;
      
      await expect(sendMessage({ prompt: 'Test prompt' })).rejects.toThrow('Claude API key is required');
    });
    
    it('should throw an error if prompt is missing', async () => {
      await expect(sendMessage({})).rejects.toThrow('Prompt is required');
    });
    
    it('should use the request queue for API calls', async () => {
      // Mock successful API response
      axios.post.mockResolvedValue({
        data: { content: [{ text: 'Test response' }] }
      });
      
      await sendMessage({ prompt: 'Test prompt' });
      
      expect(requestQueue.enqueueRequest).toHaveBeenCalledTimes(1);
    });
  });
});
