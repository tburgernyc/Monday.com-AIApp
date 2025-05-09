# Monday.com Claude Integration App

A powerful integration that enables monday.com users to manage their boards, items, subitems, automations, and workflows using natural language through Claude's AI capabilities.

## Features

- **Natural Language Interface**: Use plain English to create, update, and manage monday.com entities
- **Comprehensive Management**: Support for boards, items, subitems, columns, groups, and more
- **Intelligent Responses**: Clear explanations of actions performed and results
- **Seamless Integration**: Works as a native monday.com app feature

## Architecture

The app consists of:

1. **Backend Server (Node.js)**: Handles API requests, authentication, and business logic
2. **Frontend Component (React.js)**: Provides user interface within monday.com
3. **Claude API Integration**: Processes natural language and generates structured operations
4. **Monday.com GraphQL API**: Executes operations on the monday.com platform

## Prerequisites

Before you begin, ensure you have:

- A monday.com account with developer permissions
- An API token for the Anthropic Claude API
- Node.js (v16 or higher) and npm installed
- The monday.com Apps CLI installed globally (`npm install -g @mondaycom/apps-cli`)

## Setup and Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/monday-claude-integration.git
bashnpm install
cd monday-claude-integratio2. Install server dependencies
3. Install client dependencies
bashcd client
npm install
cd ..
4. Configure environment variables
Copy the .env.template file to .env and fill in your API credentials:
bashcp .env.template .env
Edit the .env file with your monday.com API token and Claude API key.
5. Initialize monday apps CLI
bashmapps init
Follow the prompts to connect to your monday.com account.
6. Create the app in monday.com

Go to your monday.com account
Navigate to the Developer Center (click your profile photo → Developers)
Click "Create App"
Fill in the app details
Note the App ID and update it in your .env file

Development
Local development
Run the backend and frontend concurrently:
bashnpm run dev-concurrent
Or run them separately:
bash# Backend only
npm run dev

# Frontend only
npm run client
Building for production
bash# Build the client
npm run client-build

# Deploy to monday code
npm run deploy
Usage
Once deployed, you can access the Claude AI Assistant in two ways:

Board View: Add it as a view to any monday.com board
AI Assistant: Use it from the board header by clicking the AI Assistant button

Example prompts

"Create a new board called Q1 Marketing Campaign"
"Add an item called Website Redesign to the Marketing Projects board with a status of In Progress"
"Show me all items with status Stuck"
"Create a subitem called Design Homepage under the Website Redesign item"
"Move the Website Redesign item to the Done group"
"Change the status of all items assigned to John to Done"

Permissions
This app requires the following permissions:

Read/write access to boards
Read/write access to items
Read/write access to columns
Read access to users
Read access to account information

Troubleshooting
Common issues

Authorization errors: Ensure your monday.com API token has the correct permissions
Claude API errors: Verify your Claude API key is valid and has the right model access
Deployment issues: Make sure you've initialized the monday apps CLI correctly

Logs
Check the logs for more detailed error information:
bashmapps code:logs
Contributing
Contributions are welcome! Please feel free to submit a Pull Request.
License
This project is licensed under the MIT License - see the LICENSE file for details.
Acknowledgments

monday.com Apps Framework
Claude API Documentation
monday.com GraphQL APIn