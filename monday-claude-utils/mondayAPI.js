/**
 * Utility functions for interacting with the Monday.com GraphQL API
 */

const axios = require('axios');
const { Logger, Environment } = require('@mondaycom/apps-sdk');

const logger = new Logger('monday-api-utils');
const env = new Environment();

// Monday.com GraphQL API endpoint
const MONDAY_API_URL = 'https://api.monday.com/v2';

/**
 * Execute a GraphQL query or mutation on the Monday.com API
 * 
 * @param {string} query - GraphQL query or mutation string
 * @param {Object} variables - Variables for the GraphQL operation
 * @param {string} token - API token (optional, will use env token if not provided)
 * @returns {Promise<Object>} - API response data
 */
async function executeGraphQL(query, variables = {}, token = null) {
  const apiToken = token || env.get('MONDAY_API_TOKEN');

  if (!apiToken) {
    throw new Error('Monday.com API token is required');
  }

  try {
    logger.info('Executing GraphQL operation', { 
      queryLength: query.length,
      variablesCount: Object.keys(variables).length
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
        }
      }
    );

    // Check for errors in the response
    if (response.data.errors) {
      logger.error('GraphQL operation returned errors', { errors: response.data.errors });
      throw new Error(response.data.errors[0].message);
    }

    logger.info('GraphQL operation completed successfully');
    return response.data;
  } catch (error) {
    logger.error('Failed to execute GraphQL operation', { error });
    throw error;
  }
}

/**
 * Get boards with optional filtering
 * 
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of boards to return
 * @param {string[]} options.ids - Array of board IDs to fetch
 * @param {boolean} options.includeItems - Whether to include items in the response
 * @param {string} token - API token (optional)
 * @returns {Promise<Object>} - Boards data
 */
async function getBoards(options = {}, token = null) {
  const { limit = 10, ids = null, includeItems = false } = options;
  
  let query = `
    query GetBoards($limit: Int, $ids: [ID]) {
      boards(limit: $limit, ids: $ids) {
        id
        name
        state
        board_kind
        description
        ${includeItems ? `
          items_page {
            items {
              id
              name
              column_values {
                id
                title
                text
                value
              }
            }
          }
        ` : ''}
      }
    }
  `;

  const variables = {
    limit: limit
  };

  if (ids && ids.length > 0) {
    variables.ids = ids;
  }

  return executeGraphQL(query, variables, token);
}

/**
 * Create a new board
 * 
 * @param {Object} boardData - Board information
 * @param {string} boardData.name - Name of the board
 * @param {string} boardData.boardKind - Kind of board ("public"/"private"/"share")
 * @param {string} boardData.folderId - Optional folder ID
 * @param {string} token - API token (optional)
 * @returns {Promise<Object>} - Created board data
 */
async function createBoard(boardData, token = null) {
  const { name, boardKind = 'public', folderId = null } = boardData;
  
  if (!name) {
    throw new Error('Board name is required');
  }

  let query = `
    mutation CreateBoard($name: String!, $boardKind: BoardKind!, $folderId: ID) {
      create_board(board_name: $name, board_kind: $boardKind, folder_id: $folderId) {
        id
        name
      }
    }
  `;

  const variables = {
    name: name,
    boardKind: boardKind.toUpperCase(),
    folderId: folderId
  };

  return executeGraphQL(query, variables, token);
}

/**
 * Create a new item on a board
 * 
 * @param {Object} itemData - Item information
 * @param {string} itemData.boardId - ID of the board
 * @param {string} itemData.itemName - Name of the item
 * @param {string} itemData.groupId - Optional group ID
 * @param {Object} itemData.columnValues - Column values as JSON object
 * @param {string} token - API token (optional)
 * @returns {Promise<Object>} - Created item data
 */
async function createItem(itemData, token = null) {
  const { boardId, itemName, groupId = null, columnValues = null } = itemData;
  
  if (!boardId || !itemName) {
    throw new Error('Board ID and item name are required');
  }

  let query = `
    mutation CreateItem($boardId: ID!, $itemName: String!, $groupId: String, $columnValues: JSON) {
      create_item(board_id: $boardId, item_name: $itemName, group_id: $groupId, column_values: $columnValues) {
        id
        name
      }
    }
  `;

  const variables = {
    boardId: boardId,
    itemName: itemName
  };

  if (groupId) {
    variables.groupId = groupId;
  }

  if (columnValues) {
    variables.columnValues = JSON.stringify(columnValues);
  }

  return executeGraphQL(query, variables, token);
}

/**
 * Create a new subitem
 * 
 * @param {Object} subitemData - Subitem information
 * @param {string} subitemData.parentItemId - ID of the parent item
 * @param {string} subitemData.itemName - Name of the subitem
 * @param {Object} subitemData.columnValues - Column values as JSON object
 * @param {string} token - API token (optional)
 * @returns {Promise<Object>} - Created subitem data
 */
async function createSubitem(subitemData, token = null) {
  const { parentItemId, itemName, columnValues = null } = subitemData;
  
  if (!parentItemId || !itemName) {
    throw new Error('Parent item ID and subitem name are required');
  }

  let query = `
    mutation CreateSubitem($parentItemId: ID!, $itemName: String!, $columnValues: JSON) {
      create_subitem(parent_item_id: $parentItemId, item_name: $itemName, column_values: $columnValues) {
        id
        name
      }
    }
  `;

  const variables = {
    parentItemId: parentItemId,
    itemName: itemName
  };

  if (columnValues) {
    variables.columnValues = JSON.stringify(columnValues);
  }

  return executeGraphQL(query, variables, token);
}

/**
 * Update a column value for an item
 * 
 * @param {Object} updateData - Update information
 * @param {string} updateData.boardId - ID of the board
 * @param {string} updateData.itemId - ID of the item
 * @param {string} updateData.columnId - ID of the column
 * @param {Object} updateData.value - New value for the column
 * @param {string} token - API token (optional)
 * @returns {Promise<Object>} - Updated item data
 */
async function updateColumnValue(updateData, token = null) {
  const { boardId, itemId, columnId, value } = updateData;
  
  if (!boardId || !itemId || !columnId || !value) {
    throw new Error('Board ID, item ID, column ID, and value are required');
  }

  let query = `
    mutation UpdateColumnValue($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
      change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) {
        id
      }
    }
  `;

  const variables = {
    boardId: boardId,
    itemId: itemId,
    columnId: columnId,
    value: JSON.stringify(value)
  };

  return executeGraphQL(query, variables, token);
}

/**
 * Move an item to a different group
 * 
 * @param {Object} moveData - Move information
 * @param {string} moveData.itemId - ID of the item
 * @param {string} moveData.groupId - ID of the destination group
 * @param {string} token - API token (optional)
 * @returns {Promise<Object>} - Updated item data
 */
async function moveItemToGroup(moveData, token = null) {
  const { itemId, groupId } = moveData;
  
  if (!itemId || !groupId) {
    throw new Error('Item ID and group ID are required');
  }

  let query = `
    mutation MoveItemToGroup($itemId: ID!, $groupId: String!) {
      move_item_to_group(item_id: $itemId, group_id: $groupId) {
        id
      }
    }
  `;

  const variables = {
    itemId: itemId,
    groupId: groupId
  };

  return executeGraphQL(query, variables, token);
}

/**
 * Delete an item
 * 
 * @param {string} itemId - ID of the item to delete
 * @param {string} token - API token (optional)
 * @returns {Promise<Object>} - Deletion result
 */
async function deleteItem(itemId, token = null) {
  if (!itemId) {
    throw new Error('Item ID is required');
  }

  let query = `
    mutation DeleteItem($itemId: ID!) {
      delete_item(item_id: $itemId) {
        id
      }
    }
  `;

  const variables = {
    itemId: itemId
  };

  return executeGraphQL(query, variables, token);
}

module.exports = {
  executeGraphQL,
  getBoards,
  createBoard,
  createItem,
  createSubitem,
  updateColumnValue,
  moveItemToGroup,
  deleteItem
};