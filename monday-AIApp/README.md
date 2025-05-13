# Monday.com Claude Integration App

A secure cloud-based integration that enables natural language processing for Monday.com workflows using Claude AI.

## Features

- Natural language processing for Monday.com tasks
- Document analysis and summarization
- Workflow automation through conversational interface
- Secure OAuth authentication with Monday.com
- Usage tracking and subscription management

## Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm or yarn package manager
- Monday.com account with admin privileges
- Claude API key from Anthropic

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/monday-claude-integration.git
   cd monday-claude-integration
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   ```bash
   cp .env.example .env
   ```
   - Edit `.env` and fill in your credentials:
     - `MONDAY_CLIENT_ID`: Your Monday.com OAuth client ID
     - `MONDAY_CLIENT_SECRET`: Your Monday.com OAuth client secret
     - `MONDAY_API_TOKEN`: Your Monday.com API token
     - `CLAUDE_API_KEY`: Your Claude API key from Anthropic
     - `REGION`: Your Monday.com region (US or EU)

4. Start the development server:
   ```bash
   npm run dev
   ```

### Environment Variables

The application requires several environment variables to be set. Copy the `.env.example` file to `.env` and fill in your values:

```
# Monday.com OAuth credentials
MONDAY_CLIENT_ID=your_monday_client_id_here
MONDAY_CLIENT_SECRET=your_monday_client_secret_here
OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback

# Monday.com API token (for SDK authentication)
MONDAY_API_TOKEN=your_monday_api_token_here

# Claude AI API key (for AI assistant)
CLAUDE_API_KEY=your_claude_api_key_here

# Region for API endpoints (US or EU)
REGION=US

# Server port (default: 3001)
PORT=3001
```

## Usage

### Authentication

The app uses OAuth 2.0 for authentication with Monday.com. Users will be redirected to Monday.com to authorize the app, and then redirected back to the app with an authorization code.

### API Endpoints

- `/api/process-request`: Process a natural language request
- `/api/conversation-history`: Get conversation history
- `/api/document-process`: Process a document
- `/api/subscription/status`: Get subscription status
- `/api/usage`: Get usage statistics

## Development

### Project Structure

```
monday-claude-integration/
├── client/                 # Frontend code
├── monday-claude-utils/    # Utility functions
│   ├── enhanced-claudeAPI.js  # Claude API integration
│   ├── mondayAPI.js        # Monday.com API integration
│   └── ...
├── tests/                  # Test files
├── server.js               # Main server file
├── config.js               # Configuration
└── ...
```

### Testing

Run tests with:

```bash
npm test
```

## Deployment

### Production Build

Create a production build with:

```bash
npm run build
```

### Deployment to Monday.com Marketplace

Before submitting to the Monday.com marketplace:

1. Ensure all tests pass
2. Validate the app locally
3. Test the deployment
4. Review security considerations
5. Prepare documentation

## Security Considerations

### API Key Security
- **NEVER commit API keys or secrets to version control**
- Store all credentials in environment variables
- Use `.env.example` with placeholders to document required variables
- Rotate any credentials that may have been exposed

### Authentication and Authorization
- OAuth flow is used for secure authentication with Monday.com
- Session tokens are validated on all protected endpoints
- Permission checks are performed for sensitive operations
- HTTPS is required for all communications

### Rate Limiting and Protection
- Rate limiting is implemented to prevent abuse
- Exponential backoff with jitter for API retries
- Request queuing for high-traffic scenarios
- Input validation and sanitization on all endpoints

### Monitoring and Logging
- Structured logging with appropriate log levels
- Performance metrics collection via Prometheus
- Real-time monitoring for security events
- Sensitive data is redacted from logs

### Deployment Security
- Use GitHub Secrets for CI/CD credentials
- Separate environments for development, staging, and production
- Security scanning in the CI pipeline
- Regular dependency updates and vulnerability scanning

## Additional Documentation

For detailed setup guides, please refer to the following resources:

1. **[Security Configuration](docs/SECURITY_CONFIGURATION.md)** - How to configure security features and best practices
2. **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Solutions for common issues
3. **[GitHub Secrets Setup](docs/GITHUB_SECRETS_SETUP.md)** - How to securely store credentials for CI/CD pipelines
4. **[Prometheus Setup](docs/PROMETHEUS_SETUP.md)** - How to configure Prometheus to monitor your application
5. **[Redis Setup](docs/REDIS_SETUP.md)** - How to set up Redis for distributed caching

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- [Monday.com](https://monday.com) for their excellent API
- [Anthropic](https://anthropic.com) for Claude AI
- All contributors to this project
