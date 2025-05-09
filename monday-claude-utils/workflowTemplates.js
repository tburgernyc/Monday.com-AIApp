/**
 * Library of common workflow templates that can be used as references
 * or starting points for creating new workflows
 */

const workflowTemplates = {
  /**
   * Basic task management workflow
   */
  taskManagement: {
    boards: [
      {
        name: "Task Management",
        columns: [
          { id: "status", title: "Status", type: "status", labels: ["Not Started", "In Progress", "Done", "Stuck"] },
          { id: "priority", title: "Priority", type: "status", labels: ["Low", "Medium", "High", "Critical"] },
          { id: "owner", title: "Owner", type: "person" },
          { id: "due_date", title: "Due Date", type: "date" }
        ],
        groups: [
          { id: "planning", title: "Planning" },
          { id: "active", title: "Active" },
          { id: "completed", title: "Completed" }
        ],
        automations: [
          {
            name: "Move to Active when Status changes to In Progress",
            trigger: {
              type: "when_status_change",
              config: {
                columnId: "status",
                fromStatus: null,
                toStatus: "In Progress"
              }
            },
            actions: [
              {
                type: "move_item_to_group",
                config: {
                  groupId: "active"
                }
              }
            ]
          },
          {
            name: "Move to Completed when Status changes to Done",
            trigger: {
              type: "when_status_change",
              config: {
                columnId: "status",
                fromStatus: null,
                toStatus: "Done"
              }
            },
            actions: [
              {
                type: "move_item_to_group",
                config: {
                  groupId: "completed"
                }
              }
            ]
          }
        ]
      }
    ]
  },
  
  /**
   * Project management workflow with multiple boards
   */
  projectManagement: {
    boards: [
      {
        name: "Projects",
        columns: [
          { id: "status", title: "Status", type: "status", labels: ["Planning", "In Progress", "On Hold", "Completed"] },
          { id: "project_owner", title: "Project Owner", type: "person" },
          { id: "start_date", title: "Start Date", type: "date" },
          { id: "due_date", title: "Due Date", type: "date" }
        ],
        groups: [
          { id: "current", title: "Current Projects" },
          { id: "upcoming", title: "Upcoming Projects" },
          { id: "completed", title: "Completed Projects" }
        ]
      },
      {
        name: "Tasks",
        columns: [
          { id: "status", title: "Status", type: "status", labels: ["To Do", "In Progress", "Done", "Blocked"] },
          { id: "project", title: "Project", type: "board_relation" },
          { id: "assignee", title: "Assignee", type: "person" },
          { id: "due_date", title: "Due Date", type: "date" }
        ],
        groups: [
          { id: "backlog", title: "Backlog" },
          { id: "this_week", title: "This Week" },
          { id: "completed", title: "Completed" }
        ]
      }
    ],
    automations: [
      {
        name: "Create task board when new project is created",
        trigger: {
          type: "when_item_created",
          config: {
            boardId: "Projects"
          }
        },
        actions: [
          {
            type: "create_board",
            config: {
              boardName: "{{item.name}} - Tasks",
              boardTemplate: "Tasks"
            }
          }
        ]
      },
      {
        name: "Notify project owner when task is blocked",
        trigger: {
          type: "when_status_change",
          config: {
            boardId: "Tasks",
            columnId: "status",
            toStatus: "Blocked"
          }
        },
        actions: [
          {
            type: "notify",
            config: {
              userIds: ["{{item.project.project_owner}}"],
              message: "Task {{item.name}} is blocked"
            }
          }
        ]
      }
    ]
  },
  
  /**
   * Customer request management workflow
   */
  customerRequests: {
    boards: [
      {
        name: "Customer Requests",
        columns: [
          { id: "status", title: "Status", type: "status", labels: ["New", "In Review", "In Progress", "Pending Customer", "Completed", "Cancelled"] },
          { id: "priority", title: "Priority", type: "status", labels: ["Low", "Medium", "High", "Urgent"] },
          { id: "customer", title: "Customer", type: "text" },
          { id: "request_type", title: "Type", type: "dropdown", options: ["Bug", "Feature Request", "Question", "Other"] },
          { id: "assigned_to", title: "Assigned To", type: "person" },
          { id: "deadline", title: "Deadline", type: "date" }
        ],
        groups: [
          { id: "new_requests", title: "New Requests" },
          { id: "in_progress", title: "In Progress" },
          { id: "customer_action", title: "Pending Customer" },
          { id: "completed", title: "Completed" }
        ],
        automations: [
          {
            name: "Auto-assign high priority requests",
            trigger: {
              type: "when_status_change",
              config: {
                columnId: "priority",
                toStatus: "High"
              }
            },
            actions: [
              {
                type: "notify",
                config: {
                  userIds: ["team_lead_id"],
                  message: "High priority request from {{item.customer}}: {{item.name}}"
                }
              }
            ]
          },
          {
            name: "Move request to appropriate group based on status",
            trigger: {
              type: "when_status_change",
              config: {
                columnId: "status"
              }
            },
            actions: [
              {
                type: "move_item_to_group",
                config: {
                  groupId: {
                    "New": "new_requests",
                    "In Review": "in_progress",
                    "In Progress": "in_progress",
                    "Pending Customer": "customer_action",
                    "Completed": "completed",
                    "Cancelled": "completed"
                  }
                }
              }
            ]
          }
        ]
      }
    ]
  },
  
  /**
   * Marketing campaign workflow
   */
  marketingCampaign: {
    boards: [
      {
        name: "Marketing Campaigns",
        columns: [
          { id: "status", title: "Status", type: "status", labels: ["Planning", "In Progress", "Live", "Completed", "Cancelled"] },
          { id: "campaign_type", title: "Type", type: "dropdown", options: ["Email", "Social Media", "Content", "Event", "PPC", "Other"] },
          { id: "target_audience", title: "Target Audience", type: "text" },
          { id: "start_date", title: "Start Date", type: "date" },
          { id: "end_date", title: "End Date", type: "date" },
          { id: "budget", title: "Budget", type: "numbers" },
          { id: "campaign_manager", title: "Campaign Manager", type: "person" }
        ],
        groups: [
          { id: "upcoming", title: "Upcoming Campaigns" },
          { id: "current", title: "Current Campaigns" },
          { id: "completed", title: "Completed Campaigns" }
        ]
      },
      {
        name: "Campaign Tasks",
        columns: [
          { id: "status", title: "Status", type: "status", labels: ["To Do", "In Progress", "Review", "Done"] },
          { id: "campaign", title: "Campaign", type: "board_relation" },
          { id: "assignee", title: "Assignee", type: "person" },
          { id: "due_date", title: "Due Date", type: "date" }
        ],
        groups: [
          { id: "planning", title: "Planning" },
          { id: "content", title: "Content Creation" },
          { id: "design", title: "Design" },
          { id: "review", title: "Review" },
          { id: "publish", title: "Publishing" }
        ]
      },
      {
        name: "Campaign Results",
        columns: [
          { id: "campaign", title: "Campaign", type: "board_relation" },
          { id: "impressions", title: "Impressions", type: "numbers" },
          { id: "clicks", title: "Clicks", type: "numbers" },
          { id: "conversions", title: "Conversions", type: "numbers" },
          { id: "roi", title: "ROI", type: "numbers" }
        ],
        groups: [
          { id: "results", title: "Campaign Results" }
        ]
      }
    ],
    automations: [
      {
        name: "Create tasks board when campaign is created",
        trigger: {
          type: "when_item_created",
          config: {
            boardId: "Marketing Campaigns"
          }
        },
        actions: [
          {
            type: "create_item",
            config: {
              boardId: "Campaign Tasks",
              groupId: "planning",
              itemName: "Initial Planning - {{item.name}}",
              columnValues: {
                "campaign": {"item_id": "{{item.id}}"},
                "status": {"label": "To Do"},
                "due_date": "{{item.start_date}}"
              }
            }
          }
        ]
      }
    ]
  },
  
  /**
   * Sales pipeline workflow
   */
  salesPipeline: {
    boards: [
      {
        name: "Sales Pipeline",
        columns: [
          { id: "status", title: "Status", type: "status", labels: ["Lead", "Contact Made", "Meeting Scheduled", "Proposal", "Negotiation", "Closed Won", "Closed Lost"] },
          { id: "company", title: "Company", type: "text" },
          { id: "contact_person", title: "Contact Person", type: "text" },
          { id: "contact_email", title: "Email", type: "email" },
          { id: "contact_phone", title: "Phone", type: "phone" },
          { id: "deal_value", title: "Deal Value", type: "numbers" },
          { id: "probability", title: "Probability", type: "numbers" },
          { id: "sales_owner", title: "Sales Owner", type: "person" },
          { id: "expected_close", title: "Expected Close", type: "date" }
        ],
        groups: [
          { id: "lead_generation", title: "Lead Generation" },
          { id: "qualification", title: "Qualification" },
          { id: "proposal", title: "Proposal" },
          { id: "negotiation", title: "Negotiation" },
          { id: "closed", title: "Closed" }
        ],
        automations: [
          {
            name: "Move deals through pipeline based on status",
            trigger: {
              type: "when_status_change",
              config: {
                columnId: "status"
              }
            },
            actions: [
              {
                type: "move_item_to_group",
                config: {
                  groupId: {
                    "Lead": "lead_generation",
                    "Contact Made": "lead_generation",
                    "Meeting Scheduled": "qualification",
                    "Proposal": "proposal",
                    "Negotiation": "negotiation",
                    "Closed Won": "closed",
                    "Closed Lost": "closed"
                  }
                }
              }
            ]
          },
          {
            name: "Notify sales owner when deal moves to negotiation",
            trigger: {
              type: "when_status_change",
              config: {
                columnId: "status",
                toStatus: "Negotiation"
              }
            },
            actions: [
              {
                type: "notify",
                config: {
                  userIds: ["{{item.sales_owner}}"],
                  message: "Deal with {{item.company}} has moved to Negotiation stage. Deal value: ${{item.deal_value}}"
                }
              }
            ]
          }
        ]
      }
    ]
  }
};

/**
 * Get a specific workflow template by name
 * @param {string} templateName - Name of the template to get
 * @returns {Object|null} - The workflow template or null if not found
 */
function getWorkflowTemplate(templateName) {
  return workflowTemplates[templateName] || null;
}

/**
 * Get all available workflow template names
 * @returns {string[]} - Array of template names
 */
function getAvailableTemplateNames() {
  return Object.keys(workflowTemplates);
}

/**
 * Get a scaled-down version of a workflow template with just the board structure
 * @param {string} templateName - Name of the template to get
 * @returns {Object|null} - Board structure from the template or null if not found
 */
function getBoardStructureFromTemplate(templateName) {
  const template = workflowTemplates[templateName];
  if (!template) return null;
  
  return {
    boards: template.boards.map(board => ({
      name: board.name,
      columns: board.columns,
      groups: board.groups
    }))
  };
}

module.exports = {
  workflowTemplates,
  getWorkflowTemplate,
  getAvailableTemplateNames,
  getBoardStructureFromTemplate
};