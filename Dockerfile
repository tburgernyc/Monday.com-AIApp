# Multi-stage build for smaller, more secure Docker image
# Stage 1: Build the React application
FROM node:16-alpine AS client-builder

# Set working directory
WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm ci

# Copy client source code
COPY client/src ./src
COPY client/public ./public

# Build client
RUN npm run build

# Stage 2: Build the server
FROM node:16-alpine AS server-builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Stage 3: Create the production image
FROM node:16-alpine

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy production dependencies from server-builder
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/package*.json ./

# Copy built client from client-builder
COPY --from=client-builder /app/client/build ./client/build

# Copy server source code
COPY server.js ./
COPY monday-claude-utils ./monday-claude-utils
COPY oauth-routes.js ./
COPY monetization-routes.js ./

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Set user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "server.js"]