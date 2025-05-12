# Setting Up Prometheus Monitoring

This guide will walk you through setting up Prometheus to monitor your Monday.com Claude Integration App.

## Overview

Prometheus is an open-source monitoring and alerting toolkit that collects and stores metrics as time series data. We've already implemented a `/metrics` endpoint in the application that exposes metrics in Prometheus format.

## Prerequisites

- A running instance of your Monday.com Claude Integration App
- A server or cloud environment to run Prometheus
- (Optional) A server or cloud environment to run Grafana for visualization

## Step 1: Install Prometheus

### On Linux

```bash
# Download Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz

# Extract the archive
tar xvfz prometheus-2.45.0.linux-amd64.tar.gz
cd prometheus-2.45.0.linux-amd64/

# Test the installation
./prometheus --version
```

### Using Docker (Recommended)

```bash
docker pull prom/prometheus
```

## Step 2: Configure Prometheus

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

## Step 3: Start Prometheus

### On Linux

```bash
./prometheus --config.file=prometheus.yml
```

### Using Docker

```bash
docker run -d \
    --name prometheus \
    -p 9090:9090 \
    -v /path/to/prometheus.yml:/etc/prometheus/prometheus.yml \
    prom/prometheus
```

Prometheus will now be running on port 9090.

## Step 4: Verify Metrics Collection

1. Open a web browser and navigate to `http://localhost:9090` (or the appropriate host)
2. Click on "Status" → "Targets" to verify that your application is being scraped successfully
3. Go to "Graph" and try querying some metrics, such as:
   - `http_request_duration_ms_count`
   - `rate(http_request_duration_ms_count[5m])`
   - `claude_api_request_duration_ms_bucket`

## Step 5: Set Up Grafana (Optional but Recommended)

Grafana provides better visualization for your metrics.

### Install Grafana

#### Using Docker

```bash
docker pull grafana/grafana
docker run -d \
    --name grafana \
    -p 3000:3000 \
    grafana/grafana
```

### Configure Grafana

1. Open Grafana at `http://localhost:3000`
2. Log in with default credentials (admin/admin)
3. Add Prometheus as a data source:
   - Click "Configuration" → "Data Sources" → "Add data source"
   - Select "Prometheus"
   - Set the URL to your Prometheus server (e.g., `http://localhost:9090`)
   - Click "Save & Test"

### Create Dashboards

Create dashboards for key metrics:

1. **API Performance Dashboard**
   - Request duration by endpoint
   - Error rates
   - Request counts

2. **Resource Usage Dashboard**
   - CPU usage
   - Memory usage
   - Node.js event loop lag

3. **Claude API Dashboard**
   - API call durations
   - Rate limit hits
   - Error rates by type

## Key Metrics to Monitor

Your application exposes the following metrics:

### HTTP Metrics
- `http_request_duration_ms` - Duration of HTTP requests
- `errors_total` - Total number of errors

### Claude API Metrics
- `claude_api_request_duration_ms` - Duration of Claude API requests
- `rate_limit_hits_total` - Total number of rate limit hits

### Cache Metrics
- `cache_operations_total` - Total number of cache operations

### Queue Metrics
- `request_queue_size` - Current size of the request queue

## Setting Up Alerts

Configure Prometheus alerts for critical conditions:

1. Create a `rules.yml` file:

```yaml
groups:
- name: monday-claude-integration
  rules:
  - alert: HighErrorRate
    expr: rate(errors_total[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is above 10% for 5 minutes"
      
  - alert: APIRateLimitHit
    expr: rate(rate_limit_hits_total[5m]) > 0
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: "API rate limit hit detected"
      description: "The application is hitting rate limits"
      
  - alert: SlowAPIResponse
    expr: histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m])) > 1000
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Slow API response detected"
      description: "95th percentile of API response time is above 1000ms"
```

2. Update your Prometheus configuration to include the rules:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules.yml"

scrape_configs:
  - job_name: 'monday-claude-integration'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['your-app-hostname:3001']
```

## Next Steps

1. Set up alerting via email, Slack, or other notification channels
2. Create more detailed dashboards in Grafana
3. Implement log aggregation with tools like Loki or ELK stack
4. Consider setting up distributed tracing with Jaeger or Zipkin

## Troubleshooting

If metrics aren't showing up:

1. Check that your application is running and the `/metrics` endpoint is accessible
2. Verify Prometheus is scraping the target (check "Status" → "Targets")
3. Check for any errors in the Prometheus logs
4. Ensure there are no network issues or firewalls blocking the connection
