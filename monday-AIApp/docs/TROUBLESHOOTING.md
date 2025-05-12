# Troubleshooting Guide

This guide provides solutions for common issues you might encounter when working with the Monday.com Claude Integration App.

## Table of Contents

1. [Environment Setup Issues](#environment-setup-issues)
2. [Authentication Problems](#authentication-problems)
3. [API Rate Limiting](#api-rate-limiting)
4. [Claude API Errors](#claude-api-errors)
5. [Monday.com API Errors](#mondaycom-api-errors)
6. [Performance Issues](#performance-issues)
7. [Deployment Problems](#deployment-problems)
8. [Redis Cache Issues](#redis-cache-issues)

## Environment Setup Issues

### Missing Environment Variables

**Problem**: Application fails to start with error about missing environment variables.

**Solution**:
1. Ensure you've copied `.env.example` to `.env`
2. Fill in all required variables in the `.env` file
3. Restart the application

### Port Conflicts

**Problem**: Error `EADDRINUSE: address already in use :::3001`

**Solution**:
1. Find and stop the process using port 3001:
   ```bash
   # On Windows
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F
   
   # On macOS/Linux
   lsof -i :3001
   kill -9 <PID>
   ```
2. Or change the port in your `.env` file:
   ```
   PORT=3002
   ```

## Authentication Problems

### OAuth Flow Issues

**Problem**: OAuth redirect fails or returns an error.

**Solution**:
1. Verify your Monday.com OAuth credentials are correct
2. Ensure the redirect URI matches exactly what's configured in Monday.com
3. Check that your app has the required scopes

### Invalid Session Token

**Problem**: API requests fail with "Invalid session token" error.

**Solution**:
1. Ensure the client is correctly passing the session token in the `x-monday-session-token` header
2. Check that the token hasn't expired
3. Verify the token is being properly signed with your client secret

## API Rate Limiting

### Claude API Rate Limits

**Problem**: Receiving 429 Too Many Requests errors from Claude API.

**Solution**:
1. Implement proper backoff strategy (already included in the app)
2. Consider increasing the delay between requests
3. Monitor your usage patterns and adjust accordingly

### Monday.com API Rate Limits

**Problem**: Receiving rate limit errors from Monday.com API.

**Solution**:
1. Reduce the frequency of API calls
2. Implement caching for frequently accessed data
3. Use batch operations where possible

## Claude API Errors

### Context Window Exceeded

**Problem**: Claude API returns "context_window_exceeded" error.

**Solution**:
1. Reduce the size of your input prompt
2. Break large documents into smaller chunks
3. Use the truncation feature already implemented in the app

### Invalid API Key

**Problem**: Authentication failed with Claude API.

**Solution**:
1. Verify your Claude API key is correct
2. Check that the key has not expired
3. Ensure the key has the necessary permissions

## Monday.com API Errors

### GraphQL Syntax Errors

**Problem**: Monday.com API returns GraphQL syntax errors.

**Solution**:
1. Check the GraphQL query syntax
2. Verify field names and arguments
3. Test the query in Monday.com's GraphQL playground

### Permission Errors

**Problem**: Monday.com API returns permission errors.

**Solution**:
1. Verify the user has the necessary permissions
2. Check that your app has the required scopes
3. Ensure the API token has the correct permissions

## Performance Issues

### Slow Response Times

**Problem**: API endpoints are responding slowly.

**Solution**:
1. Enable Redis caching (already implemented)
2. Optimize database queries
3. Use the request queue for high-traffic scenarios
4. Monitor performance metrics using Prometheus

### Memory Leaks

**Problem**: Application memory usage grows over time.

**Solution**:
1. Use Node.js heap snapshots to identify memory leaks
2. Implement proper cleanup of event listeners
3. Consider implementing a restart strategy for long-running instances

## Deployment Problems

### CI/CD Pipeline Failures

**Problem**: GitHub Actions workflow fails during deployment.

**Solution**:
1. Check the workflow logs for specific errors
2. Verify all secrets are properly configured
3. Ensure tests are passing locally before pushing

### Environment Configuration Issues

**Problem**: Application works locally but fails in production.

**Solution**:
1. Compare environment variables between environments
2. Check for environment-specific configurations
3. Verify network connectivity to external services

## Redis Cache Issues

### Connection Failures

**Problem**: Cannot connect to Redis server.

**Solution**:
1. Verify Redis URL is correct
2. Check network connectivity to Redis server
3. Ensure Redis server is running
4. The app will fall back to in-memory caching if Redis is unavailable

### Cache Invalidation Issues

**Problem**: Stale data is being served from cache.

**Solution**:
1. Implement proper cache invalidation (already included)
2. Adjust TTL (Time To Live) values for cached items
3. Manually clear the cache when necessary:
   ```javascript
   const { invalidateCache } = require('./middleware/cacheMiddleware');
   await invalidateCache('prefix:key');
   ```

## Getting Additional Help

If you're still experiencing issues after trying these solutions:

1. Check the application logs for detailed error information
2. Review the [GitHub Issues](https://github.com/yourusername/monday-claude-integration/issues) for similar problems
3. Contact support with the following information:
   - Error message and stack trace
   - Steps to reproduce the issue
   - Environment details (Node.js version, OS, etc.)
   - Relevant log entries
