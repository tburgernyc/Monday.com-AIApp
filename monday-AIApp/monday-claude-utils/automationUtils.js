/**
 * Utility functions for Monday.com automations
 */

/**
 * Validate an automation configuration
 * 
 * @param {Object} automation - Automation configuration object
 * @returns {Object} - Validation result with isValid flag and errors array
 */
function validateAutomationConfiguration(automation) {
  const errors = [];
  
  // Check if automation has a trigger
  if (!automation.trigger) {
    errors.push('Automation must have a trigger');
  } else {
    // Validate trigger
    if (!automation.trigger.type) {
      errors.push('Trigger must have a type');
    }
    
    if (!automation.trigger.boardId) {
      errors.push('Trigger must have a boardId');
    }
  }
  
  // Check if automation has actions
  if (!automation.actions || !Array.isArray(automation.actions) || automation.actions.length === 0) {
    errors.push('Automation must have at least one action');
  } else {
    // Validate each action
    automation.actions.forEach((action, index) => {
      if (!action.type) {
        errors.push(`Action ${index + 1} must have a type`);
      }
      
      if (!action.settings) {
        errors.push(`Action ${index + 1} must have settings`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate optimization suggestions for an automation
 * 
 * @param {Object} automation - Automation configuration object
 * @returns {Array} - Array of suggestion objects
 */
function generateOptimizationSuggestions(automation) {
  const suggestions = [];
  
  // Check for potential infinite loops
  if (automation.trigger && automation.actions) {
    const triggerType = automation.trigger.type;
    const triggerBoardId = automation.trigger.boardId;
    
    automation.actions.forEach((action, index) => {
      if (action.type === 'change_column_value' && 
          action.settings && 
          action.settings.boardId === triggerBoardId) {
        
        // If trigger is status change and action changes status, potential loop
        if (triggerType === 'status_change' && 
            action.settings.columnType === 'status') {
          suggestions.push({
            type: 'warning',
            message: `Action ${index + 1} might create an infinite loop with the trigger`,
            details: 'The trigger responds to status changes and the action changes a status on the same board'
          });
        }
      }
    });
  }
  
  // Check for performance optimizations
  if (automation.actions && automation.actions.length > 3) {
    suggestions.push({
      type: 'performance',
      message: 'Consider splitting this automation into multiple smaller automations',
      details: 'Automations with many actions can be slower and harder to maintain'
    });
  }
  
  // Check for missing error handling
  if (automation.actions && !automation.errorHandling) {
    suggestions.push({
      type: 'reliability',
      message: 'Add error handling to improve reliability',
      details: 'Specify what should happen if an action fails'
    });
  }
  
  return suggestions;
}

module.exports = {
  validateAutomationConfiguration,
  generateOptimizationSuggestions
};
