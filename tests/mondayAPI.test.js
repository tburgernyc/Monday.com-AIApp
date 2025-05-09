const axios = require('axios');
const { Logger, Environment } = require('@mondaycom/apps-sdk');

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
      if (key === 'MONDAY_API_TOKEN') return 'test-api-token';
      if (key === 'REGION') return 'US';
      return null;
    })
  }))
}));

// Import the module to test
const mondayAPI = require('../monday-claude-utils/mondayAPI');

describe('Monday API Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('executeGraphQL', () => {
    test('should execute a GraphQL query successfully', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          data: {
            boards: [
              { id: '123', name: 'Board 1' },
              { id: '456', name: 'Board 2' }
            ]
          }
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      // Call the function
      const query = '{ boards { id name } }';
      const result = await mondayAPI.executeGraphQL(query);
      
      // Verify axios was called correctly
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.monday.com/v2',
        {
          query: query,
          variables: {}
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'test-api-token'
          }
        }
      );
      
      // Verify the result
      expect(result).toEqual(mockResponse.data);
    });
    
    test('should use provided token instead of environment token', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          data: { 
            boards: [] 
          }
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      // Call the function with custom token
      const query = '{ boards { id name } }';
      const customToken = 'custom-api-token';
      await mondayAPI.executeGraphQL(query, {}, customToken);
      
      // Verify custom token was used
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'custom-api-token'
          }
        }
      );
    });
    
    test('should throw error with GraphQL error message', async () => {
      // Mock API response with GraphQL error
      const mockResponse = {
        data: {
          errors: [
            { message: 'Field does not exist' }
          ]
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      // Call the function and expect it to throw
      await expect(mondayAPI.executeGraphQL('{ invalid { field } }'))
        .rejects.toThrow('Field does not exist');
    });
    
    test('should throw error when API token is missing', async () => {
      // Mock missing API token
      Environment.mockImplementationOnce(() => ({
        get: jest.fn().mockImplementation(() => null)
      }));
      
      // Call the function and expect it to throw
      await expect(mondayAPI.executeGraphQL('{ boards { id } }'))
        .rejects.toThrow('Monday.com API token is required');
    });
  });
  
  describe('getBoards', () => {
    test('should fetch boards with default options', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          data: {
            boards: [
              { id: '123', name: 'Board 1' },
              { id: '456', name: 'Board 2' }
            ]
          }
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      // Call the function with default options
      const result = await mondayAPI.getBoards();
      
      // Verify GraphQL query
      const query = axios.post.mock.calls[0][1].query;
      expect(query).toContain('query GetBoards');
      expect(query).toContain('boards(limit: $limit, ids: $ids)');
      expect(query).not.toContain('items_page');
      
      // Verify variables
      const variables = axios.post.mock.calls[0][1].variables;
      expect(variables).toEqual({ limit: 10 });
      
      // Verify the result
      expect(result).toEqual(mockResponse.data);
    });
    
    test('should include items when includeItems is true', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          data: {
            boards: [
              { 
                id: '123', 
                name: 'Board 1',
                items_page: {
                  items: [
                    { id: 'item1', name: 'Item 1' }
                  ]
                }
              }
            ]
          }
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      // Call the function with includeItems: true
      await mondayAPI.getBoards({ includeItems: true });
      
      // Verify GraphQL query includes items_page
      const query = axios.post.mock.calls[0][1].query;
      expect(query).toContain('items_page');
      expect(query).toContain('items {');
      expect(query).toContain('column_values {');
    });
    
    test('should filter boards by IDs when provided', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          data: {
            boards: [
              { id: '123', name: 'Board 1' }
            ]
          }
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      // Call the function with board IDs
      await mondayAPI.getBoards({ ids: ['123', '456'] });
      
      // Verify variables include ids
      const variables = axios.post.mock.calls[0][1].variables;
      expect(variables).toEqual({
        limit: 10,
        ids: ['123', '456']
      });
    });
  });
  
  describe('createBoard', () => {
    test('should create a new board', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          data: {
            create_board: {
              id: '123',
              name: 'New Board'
            }
          }
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      // Call the function
      const result = await mondayAPI.createBoard({
        name: 'New Board',
        boardKind: 'public'
      });
      
      // Verify GraphQL mutation
      const query = axios.post.mock.calls[0][1].query;
      expect(query).toContain('mutation CreateBoard');
      expect(query).toContain('create_board(board_name: $name, board_kind: $boardKind, folder_id: $folderId)');
      
      // Verify variables
      const variables = axios.post.mock.calls[0][1].variables;
      expect(variables).toEqual({
        name: 'New Board',
        boardKind: 'PUBLIC',
        folderId: null
      });
      
      // Verify the result
      expect(result).toEqual(mockResponse.data);
    });
    
    test('should throw error when board name is missing', async () => {
      // Call the function without a name and expect it to throw
      await expect(mondayAPI.createBoard({}))
        .rejects.toThrow('Board name is required');
    });
  });
  
  describe('createItem', () => {
    test('should create a new item on a board', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          data: {
            create_item: {
              id: 'item1',
              name: 'New Item'
            }
          }
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      // Call the function
      const result = await mondayAPI.createItem({
        boardId: '123',
        itemName: 'New Item',
        columnValues: { status: { label: 'Done' } }
      });
      
      // Verify GraphQL mutation
      const query = axios.post.mock.calls[0][1].query;
      expect(query).toContain('mutation CreateItem');
      expect(query).toContain('create_item(board_id: $boardId, item_name: $itemName, group_id: $groupId, column_values: $columnValues)');
      
      // Verify variables
      const variables = axios.post.mock.calls[0][1].variables;
      expect(variables).toEqual({
        boardId: '123',
        itemName: 'New Item',
        columnValues: JSON.stringify({ status: { label: 'Done' } })
      });
      
      // Verify the result
      expect(result).toEqual(mockResponse.data);
    });
    
    test('should throw error when required parameters are missing', async () => {
      // Call with missing boardId
      await expect(mondayAPI.createItem({ itemName: 'Test' }))
        .rejects.toThrow('Board ID and item name are required');
      
      // Call with missing itemName
      await expect(mondayAPI.createItem({ boardId: '123' }))
        .rejects.toThrow('Board ID and item name are required');
    });
  });
  
  describe('moveItemToGroup', () => {
    test('should move an item to a different group', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          data: {
            move_item_to_group: {
              id: 'item1'
            }
          }
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      // Call the function
      const result = await mondayAPI.moveItemToGroup({
        itemId: 'item1',
        groupId: 'group1'
      });
      
      // Verify GraphQL mutation
      const query = axios.post.mock.calls[0][1].query;
      expect(query).toContain('mutation MoveItemToGroup');
      expect(query).toContain('move_item_to_group(item_id: $itemId, group_id: $groupId)');
      
      // Verify variables
      const variables = axios.post.mock.calls[0][1].variables;
      expect(variables).toEqual({
        itemId: 'item1',
        groupId: 'group1'
      });
      
      // Verify the result
      expect(result).toEqual(mockResponse.data);
    });
    
    test('should throw error when required parameters are missing', async () => {
      // Call with missing itemId
      await expect(mondayAPI.moveItemToGroup({ groupId: 'group1' }))
        .rejects.toThrow('Item ID and group ID are required');
      
      // Call with missing groupId
      await expect(mondayAPI.moveItemToGroup({ itemId: 'item1' }))
        .rejects.toThrow('Item ID and group ID are required');
    });
  });
  
  describe('updateColumnValue', () => {
    test('should update a column value for an item', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          data: {
            change_column_value: {
              id: 'item1'
            }
          }
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      // Call the function
      const result = await mondayAPI.updateColumnValue({
        boardId: 'board1',
        itemId: 'item1',
        columnId: 'status',
        value: { label: 'Done' }
      });
      
      // Verify GraphQL mutation
      const query = axios.post.mock.calls[0][1].query;
      expect(query).toContain('mutation UpdateColumnValue');
      expect(query).toContain('change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value)');
      
      // Verify variables
      const variables = axios.post.mock.calls[0][1].variables;
      expect(variables).toEqual({
        boardId: 'board1',
        itemId: 'item1',
        columnId: 'status',
        value: JSON.stringify({ label: 'Done' })
      });
      
      // Verify the result
      expect(result).toEqual(mockResponse.data);
    });
    
    test('should throw error when required parameters are missing', async () => {
      // Call with missing parameters
      await expect(mondayAPI.updateColumnValue({ 
        boardId: 'board1',
        itemId: 'item1',
        // Missing columnId and value
      }))
        .rejects.toThrow('Board ID, item ID, column ID, and value are required');
    });
  });
  
  describe('deleteItem', () => {
    test('should delete an item', async () => {
      // Mock successful API response
      const mockResponse = {
        data: {
          data: {
            delete_item: {
              id: 'item1'
            }
          }
        }
      };
      
      axios.post.mockResolvedValueOnce(mockResponse);
      
      // Call the function
      const result = await mondayAPI.deleteItem('item1');
      
      // Verify GraphQL mutation
      const query = axios.post.mock.calls[0][1].query;
      expect(query).toContain('mutation DeleteItem');
      expect(query).toContain('delete_item(item_id: $itemId)');
      
      // Verify variables
      const variables = axios.post.mock.calls[0][1].variables;
      expect(variables).toEqual({
        itemId: 'item1'
      });
      
      // Verify the result
      expect(result).toEqual(mockResponse.data);
    });
    
    test('should throw error when item ID is missing', async () => {
      // Call without item ID and expect it to throw
      await expect(mondayAPI.deleteItem())
        .rejects.toThrow('Item ID is required');
    });
  });
});