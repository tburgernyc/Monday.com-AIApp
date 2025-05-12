/**
 * Predefined workflow templates for Monday.com
 */

// Collection of workflow templates
const templates = {
  'project_management': {
    name: 'Project Management',
    description: 'Standard project management workflow with tasks, timeline, and status tracking',
    boards: [
      {
        name: 'Projects',
        groups: ['Planning', 'In Progress', 'Review', 'Completed'],
        columns: [
          { id: 'status', title: 'Status', type: 'status' },
          { id: 'owner', title: 'Owner', type: 'person' },
          { id: 'date', title: 'Due Date', type: 'date' },
          { id: 'timeline', title: 'Timeline', type: 'timeline' },
          { id: 'priority', title: 'Priority', type: 'dropdown' }
        ]
      },
      {
        name: 'Tasks',
        groups: ['To Do', 'In Progress', 'Done'],
        columns: [
          { id: 'status', title: 'Status', type: 'status' },
          { id: 'owner', title: 'Owner', type: 'person' },
          { id: 'date', title: 'Due Date', type: 'date' },
          { id: 'project', title: 'Project', type: 'board_relation' },
          { id: 'time', title: 'Time Estimate', type: 'numbers' }
        ]
      }
    ],
    automations: [
      {
        name: 'Notify on task assignment',
        trigger: {
          type: 'when_column_changes',
          boardId: '{tasks_board_id}',
          columnId: 'owner'
        },
        actions: [
          {
            type: 'notify',
            settings: {
              userId: '{column.owner.value}',
              message: 'You have been assigned to task: {item.name}'
            }
          }
        ]
      },
      {
        name: 'Update project status based on tasks',
        trigger: {
          type: 'when_status_changes',
          boardId: '{tasks_board_id}',
          columnId: 'status'
        },
        actions: [
          {
            type: 'update_parent_item',
            settings: {
              parentBoardId: '{projects_board_id}',
              columnId: 'status',
              value: 'In Progress'
            }
          }
        ]
      }
    ]
  },
  
  'customer_support': {
    name: 'Customer Support',
    description: 'Workflow for managing customer support tickets and inquiries',
    boards: [
      {
        name: 'Support Tickets',
        groups: ['New', 'In Progress', 'Waiting for Customer', 'Resolved'],
        columns: [
          { id: 'status', title: 'Status', type: 'status' },
          { id: 'priority', title: 'Priority', type: 'dropdown' },
          { id: 'customer', title: 'Customer', type: 'text' },
          { id: 'agent', title: 'Support Agent', type: 'person' },
          { id: 'category', title: 'Category', type: 'dropdown' },
          { id: 'sla', title: 'SLA', type: 'timeline' }
        ]
      },
      {
        name: 'Knowledge Base',
        groups: ['General', 'Product', 'Billing', 'Technical'],
        columns: [
          { id: 'status', title: 'Status', type: 'status' },
          { id: 'author', title: 'Author', type: 'person' },
          { id: 'last_updated', title: 'Last Updated', type: 'date' },
          { id: 'related_tickets', title: 'Related Tickets', type: 'board_relation' }
        ]
      }
    ],
    automations: [
      {
        name: 'Assign ticket to available agent',
        trigger: {
          type: 'when_status_changes',
          boardId: '{support_tickets_board_id}',
          columnId: 'status',
          value: 'New'
        },
        actions: [
          {
            type: 'assign_to_person',
            settings: {
              columnId: 'agent',
              personMethod: 'round_robin',
              personIds: ['{agent1_id}', '{agent2_id}', '{agent3_id}']
            }
          }
        ]
      },
      {
        name: 'Send resolution email',
        trigger: {
          type: 'when_status_changes',
          boardId: '{support_tickets_board_id}',
          columnId: 'status',
          value: 'Resolved'
        },
        actions: [
          {
            type: 'send_email',
            settings: {
              to: '{column.customer.value}',
              subject: 'Your support ticket has been resolved',
              body: 'Dear {column.customer.value},\n\nYour support ticket "{item.name}" has been resolved.\n\nThank you for your patience.'
            }
          }
        ]
      }
    ]
  }
};

/**
 * Get a list of available template names
 * 
 * @returns {Array} - Array of template objects with name and description
 */
function getAvailableTemplateNames() {
  return Object.keys(templates).map(key => ({
    id: key,
    name: templates[key].name,
    description: templates[key].description
  }));
}

/**
 * Get a specific workflow template by name
 * 
 * @param {string} templateName - Name of the template to retrieve
 * @returns {Object|null} - Template object or null if not found
 */
function getWorkflowTemplate(templateName) {
  return templates[templateName] || null;
}

module.exports = {
  getAvailableTemplateNames,
  getWorkflowTemplate
};
