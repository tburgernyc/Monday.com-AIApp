# Monday.com Claude Integration API Documentation

This document provides detailed information about the available API endpoints, their parameters, and response formats for the Monday.com Claude Integration App.

## Authentication

All API endpoints require authentication via a Monday.com session token. This token should be included in the `x-monday-session-token` header of each request.

### Obtaining a Session Token

The session token is provided by the Monday.com SDK in the client-side application. You can get it using:

```javascript
const monday = mondaySdk();
const tokenRes = await monday.get('sessionToken');
const token = tokenRes.data;
```

## Error Handling

All API endpoints use a consistent error response format:

```json
{
  "error": {
    "id": "err-uuid-1234",
    "type": "error_type",
    "message": "Human-readable error message",
    "userAction": "Suggested action for the user to resolve the issue"
  }
}
```

Common error types include:
- `validation_error`: Invalid input data
- `authentication_error`: Authentication issues
- `permission_error`: Insufficient permissions
- `rate_limit_error`: Too many requests
- `service_error`: External service issues
- `processing_error`: General processing errors

## Endpoints

### Process Natural Language Request

Processes a natural language request and converts it to Monday.com operations.

**URL:** `/api/process-request`  
**Method:** `POST`  
**Auth required:** Yes

**Request Body:**
```json
{
  "userPrompt": "Create a new board called Marketing Campaign",
  "userId": "12345",
  "accountId": "6789",
  "boardId": "1010" // Optional, current board context if available
}
```

**Success Response:**
```json
{
  "requestId": "req-uuid-1234",
  "conversationId": "conv-uuid-5678",
  "action": {
    "operationType": "mutation",
    "graphqlString": "mutation { create_board(board_name: \"Marketing Campaign\") { id } }",
    "variables": {}
  },
  "result": {
    "data": {
      "create_board": {
        "id": "1234567"
      }
    }
  },
  "explanation": "I created a new board called 'Marketing Campaign' for you."
}
```

**Error Response:**
```json
{
  "error": {
    "id": "err-uuid-1234",
    "type": "processing_error",
    "message": "An unexpected error occurred while processing your request.",
    "userAction": "Please try again later or contact support if the issue persists."
  }
}
```

### Process Document

Processes a document with Claude AI to perform various actions like summarization, analysis, etc.

**URL:** `/api/process-document`  
**Method:** `POST`  
**Auth required:** Yes

**Request Body:**
```json
{
  "document": "Document text content...",
  "action": "summarize", // One of: summarize, analyze, extract_key_points, extract_action_items, simplify
  "userId": "12345",
  "accountId": "6789"
}
```

**Success Response:**
```json
{
  "result": "Summarized or processed text result...",
  "action": "summarize"
}
```

### Get Conversation History

Retrieves conversation history for a specific user.

**URL:** `/api/conversation-history/:userId`  
**Method:** `GET`  
**Auth required:** Yes

**URL Parameters:**
- `userId`: The ID of the user whose conversation history to retrieve

**Success Response:**
```json
[
  {
    "id": "conv-uuid-1234",
    "prompt": "Create a new board called Marketing Campaign",
    "action": {
      "operationType": "mutation",
      "graphqlString": "mutation { create_board(board_name: \"Marketing Campaign\") { id } }",
      "variables": {}
    },
    "result": {
      "data": {
        "create_board": {
          "id": "1234567"
        }
      }
    },
    "explanation": "I created a new board called 'Marketing Campaign' for you.",
    "timestamp": "2023-06-15T14:30:00.000Z"
  },
  // More conversation entries...
]
```

### Clear Conversation History

Clears the conversation history for a specific user.

**URL:** `/api/conversation-history/:userId`  
**Method:** `DELETE`  
**Auth required:** Yes

**URL Parameters:**
- `userId`: The ID of the user whose conversation history to clear

**Success Response:**
```json
{
  "success": true
}
```

### Test Automation

Tests an automation configuration without creating it.

**URL:** `/api/test-automation`  
**Method:** `POST`  
**Auth required:** Yes

**Request Body:**
```json
{
  "automation": {
    "trigger": {
      "type": "status_change",
      "boardId": "12345"
    },
    "actions": [
      {
        "type": "create_item",
        "settings": {
          "boardId": "67890",
          "itemName": "New task"
        }
      }
    ]
  }
}
```

**Success Response:**
```json
{
  "result": "success",
  "message": "Automation configuration is valid",
  "suggestions": [
    "Consider adding a condition to filter which status changes trigger the automation"
  ],
  "requiredPermissions": {
    "scopes": [["automations", "create"]],
    "message": "Creating automations requires the automations:create permission"
  }
}
```

### Get Workflow Templates

Retrieves available workflow templates.

**URL:** `/api/workflow-templates`  
**Method:** `GET`  
**Auth required:** Yes

**Success Response:**
```json
{
  "templates": [
    "project_management",
    "sales_pipeline",
    "customer_onboarding",
    "content_calendar"
  ]
}
```

### Get Specific Workflow Template

Retrieves a specific workflow template.

**URL:** `/api/workflow-templates/:templateName`  
**Method:** `GET`  
**Auth required:** Yes

**URL Parameters:**
- `templateName`: The name of the template to retrieve

**Success Response:**
```json
{
  "template": {
    "name": "project_management",
    "description": "A complete project management workflow",
    "boards": [
      {
        "name": "Projects",
        "columns": [
          {
            "title": "Status",
            "type": "status"
          },
          // More columns...
        ]
      },
      // More boards...
    ],
    "automations": [
      // Automation configurations...
    ]
  }
}
```

## Subscription and Usage Endpoints

### Get Subscription Status

Retrieves the subscription status for a user or account.

**URL:** `/api/subscription/status`  
**Method:** `GET`  
**Auth required:** Yes

**Query Parameters:**
- `user_id`: User ID
- `account_id`: Account ID

**Success Response:**
```json
{
  "status": "active",
  "plan": "pro",
  "features": ["advanced_requests", "document_processing"],
  "expiresAt": "2024-06-15T00:00:00.000Z",
  "usage": {
    "requests": {
      "total": 150,
      "byOperation": {
        "query": 100,
        "completion": 50
      }
    },
    "tokens": {
      "total": 25000,
      "byOperation": {
        "query": 15000,
        "completion": 10000
      }
    }
  },
  "limits": {
    "requests": 1000,
    "tokens": 100000
  },
  "withinLimits": true
}
```

### Get Usage Statistics

Retrieves usage statistics for a user.

**URL:** `/api/usage`  
**Method:** `GET`  
**Auth required:** Yes

**Query Parameters:**
- `user_id`: User ID
- `account_id`: (Optional) Account ID for retrieving subscription limits

**Success Response:**
```json
{
  "requests": {
    "total": 150,
    "byOperation": {
      "query": 100,
      "completion": 50
    },
    "limit": 1000,
    "resetDate": "2023-07-01T00:00:00.000Z"
  },
  "tokens": {
    "total": 25000,
    "byOperation": {
      "query": 15000,
      "completion": 10000
    },
    "limit": 100000
  },
  "lastUpdated": "2023-06-15T14:30:00.000Z"
}
```

### Track Usage

Tracks API usage for a user.

**URL:** `/api/track-usage`  
**Method:** `POST`  
**Auth required:** Yes

**Request Body:**
```json
{
  "user_id": "12345",
  "operation": "query",
  "tokens": 150
}
```

**Success Response:**
```json
{
  "status": "ok",
  "usage": {
    "requests": {
      "total": 151,
      "byOperation": {
        "query": 101,
        "completion": 50
      },
      "lastReset": 1623760200
    },
    "tokens": {
      "total": 25150,
      "byOperation": {
        "query": 15150,
        "completion": 10000
      }
    },
    "lastUpdated": 1623760200
  }
}
```
