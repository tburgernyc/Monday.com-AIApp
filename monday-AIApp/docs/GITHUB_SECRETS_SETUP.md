# Setting Up GitHub Secrets for CI/CD Pipeline

This guide will walk you through setting up GitHub Secrets for your CI/CD pipeline to securely store and use your credentials.

## Why Use GitHub Secrets?

GitHub Secrets allow you to store sensitive information like API keys and credentials securely. These secrets:
- Are encrypted
- Are not exposed in logs
- Cannot be accessed by pull requests from forks
- Are only available during workflow runs

## Required Secrets

For the Monday.com Claude Integration App, you need to set up the following secrets for each environment:

### Test Environment

```
MONDAY_CLIENT_ID_TEST=your_monday_client_id_here
MONDAY_CLIENT_SECRET_TEST=your_monday_client_secret_here
MONDAY_API_TOKEN_TEST=your_monday_api_token_here
CLAUDE_API_KEY_TEST=your_claude_api_key_here
```

### Staging Environment

```
MONDAY_CLIENT_ID_STAGING=your_monday_client_id_here
MONDAY_CLIENT_SECRET_STAGING=your_monday_client_secret_here
MONDAY_API_TOKEN_STAGING=your_monday_api_token_here
CLAUDE_API_KEY_STAGING=your_claude_api_key_here
REDIS_URL_STAGING=redis://username:password@your-redis-host:6379
REGION_STAGING=US
```

### Production Environment

```
MONDAY_CLIENT_ID_PROD=your_monday_client_id_here
MONDAY_CLIENT_SECRET_PROD=your_monday_client_secret_here
MONDAY_API_TOKEN_PROD=your_monday_api_token_here
CLAUDE_API_KEY_PROD=your_claude_api_key_here
REDIS_URL_PROD=redis://username:password@your-redis-host:6379
REGION_PROD=US
```

## Step-by-Step Instructions

1. Go to your GitHub repository at https://github.com/tburgernyc/Monday.com-AIApp
2. Click on "Settings" tab
3. In the left sidebar, click on "Secrets and variables" → "Actions"
4. Click on "New repository secret"
5. Add each secret one by one:
   - Enter the name (e.g., `MONDAY_CLIENT_ID_TEST`)
   - Enter the value
   - Click "Add secret"
6. Repeat for all required secrets

## Verifying Secrets

After adding all secrets, you should see them listed in the "Repository secrets" section. The values will be hidden, but you can see the names.

## Using Secrets in Workflows

Your CI/CD workflow (`.github/workflows/ci-cd.yml`) is already configured to use these secrets. For example:

```yaml
- name: Create .env file
  run: |
    echo "MONDAY_CLIENT_ID=${{ secrets.MONDAY_CLIENT_ID_STAGING }}" >> .env
    echo "MONDAY_CLIENT_SECRET=${{ secrets.MONDAY_CLIENT_SECRET_STAGING }}" >> .env
    # ... other environment variables
```

## Security Best Practices

1. **Regularly rotate credentials** - Set a schedule to update these secrets
2. **Limit access** - Only repository administrators can manage secrets
3. **Use environment secrets** for production-specific values
4. **Never log secret values** in your workflows

## Troubleshooting

If your workflow fails with credential issues:

1. Check that all required secrets are defined
2. Verify the secret names match what's used in the workflow
3. Ensure the values are correct and not expired
4. Check that the workflow has permission to access the secrets

For more information, see [GitHub's documentation on encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets).
