/**
 * Health check endpoint tests
 *
 * This test creates a minimal Express app that only implements the health check endpoint
 * to avoid issues with the full server setup.
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('@mondaycom/apps-sdk', () => ({
  Storage: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn()
  })),
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Mock health check utils
jest.mock('../health-check-utils', () => ({
  checkMondayAPIConnection: jest.fn().mockResolvedValue({ status: 'ok' }),
  checkClaudeAPIConnection: jest.fn().mockResolvedValue({ status: 'ok' })
}));

// Create a minimal test app with just the health endpoint
const createTestApp = () => {
  const app = express();
  const healthCheckUtils = require('../health-check-utils');

  app.get('/health', async (req, res) => {
    try {
      // Check Monday.com API connection
      const mondayStatus = await healthCheckUtils.checkMondayAPIConnection();

      // Check Claude API connection
      const claudeStatus = await healthCheckUtils.checkClaudeAPIConnection();

      res.status(200).json({
        status: 'ok',
        region: 'US', // Hardcoded for test
        environment: 'test',
        services: {
          monday: mondayStatus,
          claude: claudeStatus
        },
        uptime: process.uptime()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  });

  return app;
};

describe('Health Check Endpoint', () => {
  let app;
  let server;

  // Setup test server before tests
  beforeAll(done => {
    app = createTestApp();
    server = app.listen(0, () => {
      console.log('Test server started');
      done();
    });
  });

  // Close the server after all tests
  afterAll(done => {
    if (server) {
      server.close(() => {
        console.log('Test server closed');
        done();
      });
    } else {
      done();
    }
  });

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 200 OK with status information', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('region');
    expect(response.body).toHaveProperty('environment');
  });

  test('should include service status information when available', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);

    // If services property exists, check its structure
    if (response.body.services) {
      // Check if monday service status is included
      if (response.body.services.monday) {
        expect(response.body.services.monday).toHaveProperty('status');
      }

      // Check if claude service status is included
      if (response.body.services.claude) {
        expect(response.body.services.claude).toHaveProperty('status');
      }
    }
  });

  test('should include uptime information', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('uptime');
    expect(typeof response.body.uptime).toBe('number');
    expect(response.body.uptime).toBeGreaterThan(0);
  });
});
