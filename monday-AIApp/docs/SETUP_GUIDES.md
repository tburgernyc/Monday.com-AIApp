# Setup Guides for Monday.com Claude Integration App

This document provides comprehensive guides for setting up various components of the Monday.com Claude Integration App.

## Table of Contents

1. [GitHub Secrets Setup](#github-secrets-setup)
2. [Prometheus Monitoring Setup](#prometheus-monitoring-setup)
3. [Redis Setup for Production](#redis-setup-for-production)

## GitHub Secrets Setup

### Overview

GitHub Secrets allow you to store sensitive information like API keys and credentials securely. These secrets:
- Are encrypted
- Are not exposed in logs
- Cannot be accessed by pull requests from forks
- Are only available during workflow runs

### Required Secrets

For the Monday.com Claude Integration App, you need to set up the following secrets for each environment:

#### Test Environment

```
MONDAY_CLIENT_ID_TEST=your_monday_client_id_here
MONDAY_CLIENT_SECRET_TEST=your_monday_client_secret_here
MONDAY_API_TOKEN_TEST=your_monday_api_token_here
CLAUDE_API_KEY_TEST=your_claude_api_key_here
```

#### Staging Environment

```
MONDAY_CLIENT_ID_STAGING=your_monday_client_id_here
MONDAY_CLIENT_SECRET_STAGING=your_monday_client_secret_here
MONDAY_API_TOKEN_STAGING=your_monday_api_token_here
CLAUDE_API_KEY_STAGING=your_claude_api_key_here
REDIS_URL_STAGING=redis://username:password@your-redis-host:6379
REGION_STAGING=US
```

#### Production Environment

```
MONDAY_CLIENT_ID_PROD=your_monday_client_id_here
MONDAY_CLIENT_SECRET_PROD=your_monday_client_secret_here
MONDAY_API_TOKEN_PROD=your_monday_api_token_here
CLAUDE_API_KEY_PROD=your_claude_api_key_here
REDIS_URL_PROD=redis://username:password@your-redis-host:6379
REGION_PROD=US
```

### Step-by-Step Instructions

1. Go to your GitHub repository
2. Click on "Settings" tab
3. In the left sidebar, click on "Secrets and variables" → "Actions"
4. Click on "New repository secret"
5. Add each secret one by one:
   - Enter the name (e.g., `MONDAY_CLIENT_ID_TEST`)
   - Enter the value
   - Click "Add secret"
6. Repeat for all required secrets

### Security Best Practices

1. **Regularly rotate credentials** - Set a schedule to update these secrets
2. **Limit access** - Only repository administrators can manage secrets
3. **Use environment secrets** for production-specific values
4. **Never log secret values** in your workflows

## Prometheus Monitoring Setup

### Overview

Prometheus is an open-source monitoring and alerting toolkit that collects and stores metrics as time series data. We've already implemented a `/metrics` endpoint in the application that exposes metrics in Prometheus format.

### Installation Options

#### Using Docker (Recommended)

```bash
docker pull prom/prometheus
```

#### On Linux

```bash
# Download Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz

# Extract the archive
tar xvfz prometheus-2.45.0.linux-amd64.tar.gz
cd prometheus-2.45.0.linux-amd64/
```

### Configuration

Create a `prometheus.yml` configuration file:

```yaml
global:
  scrape_interval: 15s     # How frequently to scrape targets
  evaluation_interval: 15s # How frequently to evaluate rules

scrape_configs:
  - job_name: 'monday-claude-integration'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['your-app-hostname:3001']  # Replace with your app's hostname and port
```

### Starting Prometheus

#### Using Docker

```bash
docker run -d \
    --name prometheus \
    -p 9090:9090 \
    -v /path/to/prometheus.yml:/etc/prometheus/prometheus.yml \
    prom/prometheus
```

### Setting Up Grafana (Optional)

Grafana provides better visualization for your metrics.

```bash
docker pull grafana/grafana
docker run -d \
    --name grafana \
    -p 3000:3000 \
    grafana/grafana
```

### Key Metrics to Monitor

Your application exposes the following metrics:

- `http_request_duration_ms` - Duration of HTTP requests
- `errors_total` - Total number of errors
- `claude_api_request_duration_ms` - Duration of Claude API requests
- `rate_limit_hits_total` - Total number of rate limit hits
- `cache_operations_total` - Total number of cache operations
- `request_queue_size` - Current size of the request queue

## Redis Setup for Production

### Why Redis?

Redis is used in this application for:
- Distributed caching of API responses
- Rate limiting coordination
- Session storage (if enabled)

Using Redis improves performance and enables horizontal scaling of your application across multiple instances.

### Managed Redis Options (Recommended)

#### AWS ElastiCache

1. Create an ElastiCache cluster with Redis
2. Configure security groups to allow access from your application
3. Enable encryption in transit and at rest
4. Note the endpoint URL for connection

#### Azure Cache for Redis

1. Create an Azure Cache for Redis instance
2. Choose the appropriate pricing tier
3. Configure firewall rules
4. Get the connection string from "Access keys"

#### Redis Cloud

1. Sign up for Redis Cloud
2. Create a subscription and database
3. Configure memory limit and other settings
4. Get the connection information

### Self-Hosted Redis

#### Using Docker

```yaml
version: '3'
services:
  redis:
    image: redis:7
    command: redis-server --requirepass your_strong_password
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: always

volumes:
  redis-data:
```

### Configuring Your Application

Once you have your Redis instance set up, update your application's environment variables:

```
REDIS_URL=redis://username:password@your-redis-host:6379
```

### Redis Best Practices

1. **Security**:
   - Use a strong password
   - Enable TLS/SSL for encryption in transit
   - Restrict network access to trusted sources

2. **Performance**:
   - Set appropriate TTL values for cached items
   - Monitor memory usage
   - Use appropriate data structures

3. **Reliability**:
   - Enable persistence (AOF or RDB)
   - Set up replication for high availability
   - Implement proper backup procedures
