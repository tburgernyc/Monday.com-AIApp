# Setting Up Redis for Production

This guide will walk you through setting up Redis for your Monday.com Claude Integration App in a production environment.

## Why Redis?

Redis is used in this application for:
- Distributed caching of API responses
- Rate limiting coordination
- Session storage (if enabled)

Using Redis improves performance and enables horizontal scaling of your application across multiple instances.

## Option 1: Managed Redis Service (Recommended)

Using a managed Redis service is the easiest and most reliable option for production.

### AWS ElastiCache

1. **Create an ElastiCache cluster**:
   - Go to AWS Console → ElastiCache
   - Click "Create"
   - Select Redis
   - Choose Redis (cluster mode disabled)
   - Configure settings:
     - Name: `monday-claude-cache`
     - Node type: Start with `cache.t3.small` (scale as needed)
     - Number of replicas: At least 1 for high availability
     - Multi-AZ: Enabled
     - Subnet group: Select or create one
     - Security group: Create one that allows access from your application servers
   - Enable encryption in transit and at rest
   - Create the cluster

2. **Get the connection information**:
   - After the cluster is created, note the endpoint URL
   - The connection string will be in the format:
     ```
     redis://username:password@endpoint:6379
     ```

### Azure Cache for Redis

1. **Create an Azure Cache for Redis**:
   - Go to Azure Portal
   - Click "Create a resource" → "Databases" → "Azure Cache for Redis"
   - Configure settings:
     - Resource group: Select or create one
     - DNS name: `monday-claude-cache`
     - Location: Choose the region closest to your application
     - Pricing tier: Start with Basic or Standard
   - Create the cache

2. **Get the connection information**:
   - After the cache is created, go to "Access keys"
   - Note the primary connection string

### Redis Cloud

1. **Sign up for Redis Cloud**:
   - Go to https://redis.com/try-free/
   - Create an account and sign in

2. **Create a subscription**:
   - Select a cloud provider and region
   - Choose a plan (start with the free tier for testing)
   - Create the subscription

3. **Create a database**:
   - Click "Create Database"
   - Configure settings:
     - Name: `monday-claude-cache`
     - Protocol: Redis
     - Memory limit: Start with 100MB (adjust as needed)
   - Create the database

4. **Get the connection information**:
   - After the database is created, note the endpoint and password
   - The connection string will be in the format:
     ```
     redis://default:password@endpoint:port
     ```

### Upstash (Serverless Redis)

1. **Sign up for Upstash**:
   - Go to https://upstash.com/
   - Create an account and sign in

2. **Create a database**:
   - Click "Create Database"
   - Configure settings:
     - Name: `monday-claude-cache`
     - Region: Choose the region closest to your application
     - TLS: Enabled
   - Create the database

3. **Get the connection information**:
   - After the database is created, go to "Details"
   - Copy the Redis URL

## Option 2: Self-Hosted Redis

If you prefer to host Redis yourself, follow these steps:

### On Linux

1. **Install Redis**:
   ```bash
   sudo apt update
   sudo apt install redis-server
   ```

2. **Configure Redis**:
   - Edit the Redis configuration file:
     ```bash
     sudo nano /etc/redis/redis.conf
     ```
   - Make the following changes:
     - Set a strong password: `requirepass your_strong_password`
     - Bind to private network interface: `bind 10.0.0.5 127.0.0.1` (replace with your server's private IP)
     - Enable AOF persistence: `appendonly yes`
     - Set memory limit: `maxmemory 1gb` (adjust as needed)
     - Set eviction policy: `maxmemory-policy allkeys-lru`

3. **Restart Redis**:
   ```bash
   sudo systemctl restart redis
   ```

4. **Configure firewall**:
   ```bash
   sudo ufw allow from your_app_server_ip to any port 6379
   ```

5. **Get the connection information**:
   - The connection string will be in the format:
     ```
     redis://default:your_strong_password@your_redis_server_ip:6379
     ```

### Using Docker

1. **Create a Docker Compose file**:
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

2. **Start Redis**:
   ```bash
   docker-compose up -d
   ```

3. **Get the connection information**:
   - The connection string will be in the format:
     ```
     redis://default:your_strong_password@localhost:6379
     ```

## Configuring Your Application

Once you have your Redis instance set up, update your application's environment variables:

1. **Update your `.env` file**:
   ```
   REDIS_URL=redis://username:password@your-redis-host:6379
   ```

2. **Update your GitHub Secrets** for CI/CD:
   - Add `REDIS_URL_STAGING` and `REDIS_URL_PROD` with the appropriate connection strings

## Testing the Redis Connection

To verify that your application can connect to Redis:

1. **Start your application**:
   ```bash
   npm start
   ```

2. **Check the logs** for Redis connection messages:
   - You should see "Connected to Redis successfully" if the connection is working
   - If there's an error, you'll see "Failed to initialize Redis" with error details

3. **Test caching functionality**:
   - Make a request to an endpoint that uses caching (e.g., `/api/workflow-templates`)
   - Make the same request again and check for the `X-Cache: HIT` header

## Redis Best Practices

1. **Security**:
   - Use a strong password
   - Enable TLS/SSL for encryption in transit
   - Restrict network access to trusted sources
   - Regularly rotate credentials

2. **Performance**:
   - Set appropriate TTL (Time To Live) values for cached items
   - Monitor memory usage and adjust maxmemory setting as needed
   - Use appropriate data structures for your use case

3. **Reliability**:
   - Enable persistence (AOF or RDB)
   - Set up replication for high availability
   - Implement proper backup procedures
   - Monitor Redis health and performance

4. **Scaling**:
   - Start small and scale as needed
   - Consider Redis Cluster for very high throughput requirements
   - Implement proper connection pooling

## Monitoring Redis

Monitor your Redis instance using:

1. **Redis CLI**:
   ```bash
   redis-cli -h your-redis-host -p 6379 -a your-password info
   ```

2. **Prometheus and Grafana** (using redis_exporter)

3. **Cloud provider monitoring tools**:
   - AWS CloudWatch
   - Azure Monitor
   - Redis Cloud monitoring

## Troubleshooting

If you encounter issues with Redis:

1. **Connection problems**:
   - Verify the connection string is correct
   - Check network connectivity and firewall rules
   - Ensure Redis is running

2. **Authentication issues**:
   - Verify the password is correct
   - Check that authentication is enabled on the Redis server

3. **Performance issues**:
   - Monitor Redis memory usage
   - Check for slow commands using `SLOWLOG GET`
   - Consider increasing resources or optimizing cache usage
