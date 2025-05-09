// monday-claude-utils/mondayGraphQLOperations.js

/**
 * Example GraphQL operations for common monday.com operations
 */

// 1. Create a new board
const createBoardMutation = `
mutation CreateBoard($boardName: String!, $boardKind: BoardKind!) {
  create_board(board_name: $boardName, board_kind: $boardKind) {
    id
    name
  }
}
`;

// 2. Create a new item
const createItemMutation = `
mutation CreateItem($boardId: ID!, $itemName: String!, $columnValues: JSON) {
  create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
    id
    name
  }
}
`;

// 3. Create a subitem
const createSubitemMutation = `
mutation CreateSubitem($parentItemId: ID!, $itemName: String!, $columnValues: JSON) {
  create_subitem(parent_item_id: $parentItemId, item_name: $itemName, column_values: $columnValues) {
    id
    name
    board {
      id
    }
  }
}
`;

// 4. Update an item's column values
const updateItemMutation = `
mutation ChangeColumnValue($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
  change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) {
    id
  }
}
`;

// 5. Query boards
const getBoardsQuery = `
query GetBoards($limit: Int) {
  boards(limit: $limit) {
    id
    name
    state
    board_kind
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
  }
}
`;

// 6. Query items from a specific board
const getBoardItemsQuery = `
query GetBoardItems($boardId: ID!, $limit: Int) {
  boards(ids: [$boardId], limit: $limit) {
    items_page {
      items {
        id
        name
        state
        column_values {
          id
          title
          text
          value
        }
        subitems {
          id
          name
        }
      }
    }
  }
}
`;

// 7. Move an item to a different group
const moveItemToGroupMutation = `
mutation MoveItemToGroup($itemId: ID!, $groupId: String!) {
  move_item_to_group(item_id: $itemId, group_id: $groupId) {
    id
  }
}
`;

// 8. Archive an item
const archiveItemMutation = `
mutation ArchiveItem($itemId: ID!) {
  archive_item(item_id: $itemId) {
    id
  }
}
`;

// 9. Delete an item
const deleteItemMutation = `
mutation DeleteItem($itemId: ID!) {
  delete_item(item_id: $itemId) {
    id
  }
}
`;

// 10. Create a new group in a board
const createGroupMutation = `
mutation CreateGroup($boardId: ID!, $groupName: String!) {
  create_group(board_id: $boardId, group_name: $groupName) {
    id
  }
}
`;

module.exports = {
  createBoardMutation,
  createItemMutation,
  createSubitemMutation,
  updateItemMutation,
  getBoardsQuery,
  getBoardItemsQuery,
  moveItemToGroupMutation,
  archiveItemMutation,
  deleteItemMutation,
  createGroupMutation
};