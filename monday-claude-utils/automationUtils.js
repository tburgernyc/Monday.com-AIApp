/**
 * Utility functions for creating and managing Monday.com automations
 */

const axios = require('axios');
const { Logger, Environment } = require('@mondaycom/apps-sdk');
const mondayAPI = require('./mondayAPI');

const logger = new Logger('automation-utils');
const env = new Environment();

/**
 * Create a new automation recipe
 * @param {Object} automationData - Automation recipe data
 * @param {string} automationData.boardId - Board ID to attach automation to
 * @param {Object} automationData.trigger - Trigger configuration
 * @param {Object[]} automationData.actions - Actions to perform
 * @returns {Promise<Object>} - Created automation data
 */
async function createAutomation(automationData) {
  const { boardId, trigger, actions } = automationData;
  
  if (!boardId || !trigger || !actions || !actions.length) {
    throw new Error('Board ID, trigger, and at least one action are required');
  }

  // GraphQL mutation for creating automation
  const query = `
    mutation CreateAutomation($boardId: ID!, $trigger: JSON!, $actions: JSON!) {
      create_automation(
        board_id: $boardId,
        trigger: $trigger,
        actions: $actions
      ) {
        id
        name
        enabled
      }
    }
  `;

  const variables = {
    boardId,
    trigger: JSON.stringify(trigger),
    actions: JSON.stringify(actions)
  };

  return mondayAPI.executeGraphQL(query, variables);
}

/**
 * Get common automation trigger templates
 * @param {string} triggerType - Type of trigger to get template for
 * @returns {Object} - Trigger template
 */
function getAutomationTriggerTemplate(triggerType) {
  const templates = {
    status_change: {
      type: "when_status_change",
      config: {
        columnId: "", // Status column ID
        fromStatus: null, // null means any status
        toStatus: "" // Target status ID
      }
    },
    date_arrived: {
      type: "when_date_arrived",
      config: {
        columnId: "", // Date column ID
        daysInterval: 0 // 0 = on the date, positive = days after, negative = days before
      }
    },
    item_created: {
      type: "when_item_created",
      config: {}
    },
    item_name_changed: {
      type: "when_item_name_change",
      config: {}
    },
    subitem_created: {
      type: "when_subitem_created",
      config: {}
    }
  };
  
  return templates[triggerType] || null;
}

/**
 * Get common automation action templates
 * @param {string} actionType - Type of action to get template for
 * @returns {Object} - Action template
 */
function getAutomationActionTemplate(actionType) {
  const templates = {
    create_item: {
      type: "create_item",
      config: {
        boardId: "", // Target board ID
        groupId: "", // Target group ID
        columnValues: {} // Column values for the new item
      }
    },
    change_column_value: {
      type: "change_column_value",
      config: {
        columnId: "", // Column ID to change
        value: {} // Value to set
      }
    },
    notify: {
      type: "notify",
      config: {
        userIds: [], // User IDs to notify
        message: "" // Notification message
      }
    },
    create_update: {
      type: "create_update",
      config: {
        text: "" // Update text
      }
    },
    send_email: {
      type: "send_email",
      config: {
        to: "", // Email recipients
        subject: "", // Email subject
        body: "" // Email body
      }
    },
    move_item_to_group: {
      type: "move_item_to_group",
      config: {
        groupId: "" // Target group ID
      }
    }
  };
  
  return templates[actionType] || null;
}

/**
 * Validate automation configuration
 * @param {Object} automation - Automation configuration to validate
 * @returns {Object} - Validation result
 */
function validateAutomationConfiguration(automation) {
  const errors = [];
  
  // Validate basic structure
  if (!automation) {
    return {
      isValid: false,
      errors: ['Automation configuration is required']
    };
  }
  
  if (!automation.trigger) {
    errors.push('Trigger is required');
  }
  
  if (!automation.actions || !Array.isArray(automation.actions) || automation.actions.length === 0) {
    errors.push('At least one action is required');
  }
  
  // Validate trigger
  if (automation.trigger) {
    if (!automation.trigger.type) {
      errors.push('Trigger type is required');
    }
    
    // Specific validation based on trigger type
    if (automation.trigger.type === 'when_status_change') {
      if (!automation.trigger.config || !automation.trigger.config.columnId) {
        errors.push('Status column ID is required for status change trigger');
      }
      if (!automation.trigger.config || !automation.trigger.config.toStatus) {
        errors.push('Target status is required for status change trigger');
      }
    }
    
    if (automation.trigger.type === 'when_date_arrived') {
      if (!automation.trigger.config || !automation.trigger.config.columnId) {
        errors.push('Date column ID is required for date arrived trigger');
      }
    }
  }
  
  // Validate actions
  if (automation.actions && Array.isArray(automation.actions)) {
    automation.actions.forEach((action, index) => {
      if (!action.type) {
        errors.push(`Action ${index + 1}: Type is required`);
      }
      
      // Specific validation based on action type
      if (action.type === 'create_item') {
        if (!action.config || !action.config.boardId) {
          errors.push(`Action ${index + 1}: Board ID is required for create_item action`);
        }
      }
      
      if (action.type === 'change_column_value') {
        if (!action.config || !action.config.columnId) {
          errors.push(`Action ${index + 1}: Column ID is required for change_column_value action`);
        }
        if (!action.config || !action.config.value) {
          errors.push(`Action ${index + 1}: Value is required for change_column_value action`);
        }
      }
      
      if (action.type === 'notify') {
        if (!action.config || !action.config.userIds || !action.config.userIds.length) {
          errors.push(`Action ${index + 1}: User IDs are required for notify action`);
        }
        if (!action.config || !action.config.message) {
          errors.push(`Action ${index + 1}: Message is required for notify action`);
        }
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate suggestions to optimize an automation
 * @param {Object} automation - Automation configuration
 * @returns {string[]} - Optimization suggestions
 */
function generateOptimizationSuggestions(automation) {
  const suggestions = [];
  
  // Check for potential performance issues
  if (automation.actions && automation.actions.length > 5) {
    suggestions.push('Consider breaking down automations with many actions for better performance');
  }
  
  // Check for potential logical issues
  if (automation.trigger && automation.trigger.type === 'when_status_change' && 
      automation.actions && Array.isArray(automation.actions)) {
    
    const statusChangeActions = automation.actions.filter(action => 
      action.type === 'change_column_value' && 
      action.config && 
      action.config.columnId === automation.trigger.config.columnId
    );
    
    if (statusChangeActions.length > 0) {
      suggestions.push('Potential infinite loop: The automation changes the same status column that triggers it');
    }
  }
  
  // Check for missing names
  if (!automation.name) {
    suggestions.push('Adding a descriptive name to the automation will help with management');
  }
  
  // Check for complex conditions
  if (automation.trigger && automation.trigger.config && 
      automation.trigger.config.conditions && 
      automation.trigger.config.conditions.length > 3) {
    suggestions.push('Complex trigger conditions may be hard to maintain. Consider simplifying or breaking down into multiple automations');
  }
  
  return suggestions;
}

module.exports = {
  createAutomation,
  getAutomationTriggerTemplate,
  getAutomationActionTemplate,
  validateAutomationConfiguration,
  generateOptimizationSuggestions
};