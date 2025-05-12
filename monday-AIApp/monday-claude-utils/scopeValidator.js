/**
 * Utility functions for validating OAuth scopes
 */

/**
 * Check if the required scopes are granted
 * 
 * @param {Array} requiredScopes - Array of required scopes, each an array of [resource, permission]
 * @param {Array} grantedScopes - Array of granted scopes, each a string like "resource:permission"
 * @returns {Object} - Validation result with isValid flag and missing scopes
 */
function validateScopes(requiredScopes, grantedScopes) {
  const missingScopes = [];
  
  // Convert granted scopes to a map for easier lookup
  const grantedScopeMap = {};
  grantedScopes.forEach(scope => {
    const [resource, permission] = scope.split(':');
    if (!grantedScopeMap[resource]) {
      grantedScopeMap[resource] = [];
    }
    grantedScopeMap[resource].push(permission);
  });
  
  // Check each required scope
  requiredScopes.forEach(([resource, permission]) => {
    if (!grantedScopeMap[resource] || !grantedScopeMap[resource].includes(permission)) {
      missingScopes.push(`${resource}:${permission}`);
    }
  });
  
  return {
    isValid: missingScopes.length === 0,
    missingScopes
  };
}

/**
 * Get the scopes required for a specific operation
 * 
 * @param {string} operationType - Type of operation (e.g., 'create_item', 'change_column_value')
 * @returns {Array} - Array of required scopes, each an array of [resource, permission]
 */
function getScopesForOperation(operationType) {
  // Map of operation types to required scopes
  const operationScopes = {
    'create_item': [['items', 'create'], ['boards', 'read']],
    'change_column_value': [['items', 'write'], ['boards', 'read']],
    'create_update': [['items', 'write'], ['boards', 'read']],
    'create_notification': [['users', 'read']],
    'create_board': [['boards', 'create']],
    'create_group': [['groups', 'create'], ['boards', 'read']],
    'create_column': [['columns', 'create'], ['boards', 'read']],
    'create_webhook': [['boards', 'write']],
    'create_automation': [['automations', 'create'], ['boards', 'read']]
  };
  
  return operationScopes[operationType] || [];
}

module.exports = {
  validateScopes,
  getScopesForOperation
};
