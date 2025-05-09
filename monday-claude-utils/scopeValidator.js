/**
 * Utility to validate Monday.com OAuth scopes
 * and check if requested operations are allowed
 */

const { Logger } = require('@mondaycom/apps-sdk');
const logger = new Logger('scope-validator');

// Define all possible Monday.com OAuth scopes
const ALL_SCOPES = {
  boards: ['read', 'write', 'create', 'delete'],
  items: ['read', 'write', 'create', 'delete'],
  columns: ['read', 'write', 'create'],
  groups: ['read', 'write', 'create'],
  account: ['read'],
  teams: ['read'],
  users: ['read'],
  automations: ['read', 'write', 'create', 'delete']
};

/**
 * Check if a specific operation is allowed by the granted scopes
 * 
 * @param {Object} context - App context from Monday.com
 * @param {string} entity - Entity type (e.g., 'boards', 'items')
 * @param {string} action - Action type (e.g., 'read', 'write')
 * @returns {Object} - Result of validation
 */
function validateScope(context, entity, action) {
  if (!context || !context.permissions) {
    return {
      allowed: false,
      missingScopes: [`${entity}:${action}`],
      message: 'App context or permissions not available'
    };
  }
  
  // Normalize entity and action
  entity = entity.toLowerCase();
  action = action.toLowerCase();
  
  // Check if entity and action are valid
  if (!ALL_SCOPES[entity] || !ALL_SCOPES[entity].includes(action)) {
    return {
      allowed: false,
      message: `Invalid scope: ${entity}:${action}`
    };
  }
  
  // Check if the scope is granted
  const scopeString = `${entity}:${action}`;
  const isGranted = context.permissions.includes(scopeString);
  
  if (isGranted) {
    return {
      allowed: true,
      message: 'Operation allowed'
    };
  }
  
  // Return validation failure
  return {
    allowed: false,
    missingScopes: [scopeString],
    message: `Missing required scope: ${scopeString}`
  };
}

/**
 * Validate multiple required scopes at once
 * 
 * @param {Object} context - App context from Monday.com
 * @param {Array} requiredScopes - Array of required scopes in format [entity, action]
 * @returns {Object} - Result of validation
 */
function validateMultipleScopes(context, requiredScopes) {
  if (!Array.isArray(requiredScopes) || requiredScopes.length === 0) {
    return {
      allowed: true,
      message: 'No scopes required'
    };
  }
  
  const missingScopes = [];
  
  for (const [entity, action] of requiredScopes) {
    const result = validateScope(context, entity, action);
    if (!result.allowed) {
      missingScopes.push(...(result.missingScopes || []));
    }
  }
  
  if (missingScopes.length === 0) {
    return {
      allowed: true,
      message: 'All required scopes are granted'
    };
  }
  
  return {
    allowed: false,
    missingScopes,
    message: `Missing required scopes: ${missingScopes.join(', ')}`
  };
}

/**
 * Check if an operation for creating automations is allowed
 * 
 * @param {Object} context - App context from Monday.com
 * @returns {Object} - Result of validation
 */
function canCreateAutomations(context) {
  return validateScope(context, 'automations', 'create');
}

/**
 * Check the scopes required for a specific operation type
 * 
 * @param {string} operationType - Type of operation (e.g., 'create_board', 'update_item')
 * @returns {Array} - Array of [entity, action] pairs needed for the operation
 */
function getScopesForOperation(operationType) {
  const scopeMap = {
    // Board operations
    'create_board': [['boards', 'create']],
    'get_boards': [['boards', 'read']],
    'update_board': [['boards', 'write']],
    'delete_board': [['boards', 'delete']],
    
    // Item operations
    'create_item': [['items', 'create']],
    'get_items': [['items', 'read']],
    'update_item': [['items', 'write']],
    'delete_item': [['items', 'delete']],
    
    // Column operations
    'create_column': [['columns', 'create']],
    'get_columns': [['columns', 'read']],
    'change_column_value': [['columns', 'write']],
    
    // Group operations
    'create_group': [['groups', 'create']],
    'get_groups': [['groups', 'read']],
    'update_group': [['groups', 'write']],
    
    // Automation operations
    'create_automation': [['automations', 'create']],
    'get_automations': [['automations', 'read']],
    'update_automation': [['automations', 'write']],
    'delete_automation': [['automations', 'delete']],
    
    // Complex operations with multiple scopes
    'move_item_to_group': [['items', 'write'], ['groups', 'read']],
    'duplicate_item': [['items', 'read'], ['items', 'create']],
    'create_subitem': [['items', 'create'], ['items', 'read']],
    'create_board_view': [['boards', 'write']],
    'create_webhook': [['boards', 'read']]
  };
  
  return scopeMap[operationType] || [];
}

/**
 * Generate a message explaining the required permissions for an operation
 * 
 * @param {string} operationType - Type of operation
 * @returns {string} - Permission explanation message
 */
function generatePermissionsMessage(operationType) {
  const scopes = getScopesForOperation(operationType);
  
  if (scopes.length === 0) {
    return `Unable to determine permissions needed for '${operationType}'.`;
  }
  
  const scopeStrings = scopes.map(([entity, action]) => `${entity}:${action}`);
  
  return `The operation '${operationType}' requires the following permissions: ${scopeStrings.join(', ')}. Please ensure these permissions are granted to the app.`;
}

module.exports = {
  validateScope,
  validateMultipleScopes,
  canCreateAutomations,
  getScopesForOperation,
  generatePermissionsMessage,
  ALL_SCOPES
};