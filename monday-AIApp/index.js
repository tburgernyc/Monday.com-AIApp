/**
 * Simple Express server for Monday.com Claude Integration App
 */

// Load environment variables from .env file
require('dotenv').config();

// Import the centralized config module
const config = require('./config');

const express = require('express');
const app = express();

// Use port from config (3001 instead of hardcoded 3000)
const port = config.PORT;

// Basic route for health check
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    region: config.REGION,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Start the server with proper port release handling
const server = app.listen(port, () => {
  console.log(`Simple server listening on port ${port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
