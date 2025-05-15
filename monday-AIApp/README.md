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

3. Set up environment variables and generate security keys:
   - Copy `.env.example` to `.env`
   ```bash
   cp .env.example .env
   ```
   - Generate secure encryption keys:
   ```bash
   npm run generate-keys
   ```
   - Copy the generated ENCRYPTION_KEY and SESSION_SECRET values to your .env file
   - Edit `.env` and fill in your credentials:
     - `MONDAY_CLIENT_ID`: Your Monday.com OAuth client ID
     - `MONDAY_CLIENT_SECRET`: Your Monday.com OAuth client secret
     - `MONDAY_SIGNING_SECRET`: Your Monday.com signing secret
     - `MONDAY_API_TOKEN`: Your Monday.com API token
     - `CLAUDE_API_KEY`: Your Claude API key from Anthropic
     - `REGION`: Your Monday.com region (US or EU)

4. Start the development server:
   ```bash
   npm run dev
   ```

   Alternatively, you can use the setup script to install dependencies and generate keys in one step:
   ```bash
   npm run setup
   ```

### Environment Variables

The application requires several environment variables to be set. Copy the `.env.example` file to `.env` and fill in your values:

```env
# Monday.com OAuth credentials
MONDAY_CLIENT_ID=your_monday_client_id_here
MONDAY_CLIENT_SECRET=your_monday_client_secret_here
MONDAY_SIGNING_SECRET=your_monday_signing_secret_here
OAUTH_REDIRECT_URI=http://localhost:3000/oauth/callback

# Monday.com API token (for SDK authentication)
MONDAY_API_TOKEN=your_monday_api_token_here

# Claude AI API key (for AI assistant)
CLAUDE_API_KEY=your_claude_api_key_here

# Region for API endpoints (US or EU)
REGION=US

# Server port (default: 3001)
PORT=3001

# Security configuration (generate with npm run generate-keys)
ENCRYPTION_KEY=your_secure_encryption_key
SESSION_SECRET=your_secure_session_secret
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

```bash
monday-claude-integration/
├── client/                 # Frontend code
├── middleware/             # Express middleware
│   ├── authMiddleware.js   # Authentication middleware
│   ├── securityMiddleware.js # Security headers and protections
│   └── ...
├── monday-claude-utils/    # Utility functions
│   ├── enhanced-claudeAPI.js  # Claude API integration
│   ├── mondayAPI.js        # Monday.com API integration
│   └── ...
├── scripts/                # Utility scripts
│   └── generate-keys.js    # Security key generator
├── tests/                  # Test files
│   ├── api.integration.test.js # API integration tests
│   ├── enhanced-claudeAPI.test.js # Claude API unit tests
│   └── health.test.js      # Health check tests
├── utils/                  # Utility functions
│   ├── encryption.js       # Data encryption utilities
│   ├── env-validator.js    # Environment variable validation
│   └── secure-logger.js    # Secure logging utilities
├── server.js               # Main server file
├── config.js               # Configuration
├── oauth-routes.js         # OAuth authentication routes
├── monetization-routes.js  # Subscription management routes
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
- Use the `npm run generate-keys` script to create secure encryption keys

### Data Encryption

- All sensitive data is encrypted using AES-256-GCM
- Encryption keys are required and validated at startup
- Secure token generation for CSRF protection
- HMAC signatures for data integrity verification

### Authentication and Authorization

- OAuth flow is used for secure authentication with Monday.com
- Session tokens are validated on all protected endpoints
- Permission checks are performed for sensitive operations
- HTTPS is required for all communications
- Secure cookie handling with proper flags

### Rate Limiting and Protection

- Rate limiting is implemented to prevent abuse
- Exponential backoff with jitter for API retries
- Request queuing for high-traffic scenarios
- Input validation and sanitization on all endpoints
- Circuit breaker pattern for external API calls

### Monitoring and Logging

- Structured logging with appropriate log levels
- Performance metrics collection via Prometheus
- Real-time monitoring for security events
- Sensitive data is redacted from logs
- Detailed error tracking with unique error IDs

### Deployment Security

- Use GitHub Secrets for CI/CD credentials
- Separate environments for development, staging, and production
- Security scanning in the CI pipeline
- Regular dependency updates and vulnerability scanning
- Environment validation at application startup

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
