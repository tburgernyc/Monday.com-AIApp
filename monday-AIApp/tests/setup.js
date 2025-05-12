/**
 * Global Jest test setup and teardown
 */

// Set a timeout for all tests to prevent hanging
jest.setTimeout(60000);

// Mock timers for consistent testing
jest.useFakeTimers();

// Global setup - runs once before all tests
beforeAll(() => {
  console.log('Starting test suite');

  // Create a global array to track all resources that need cleanup
  global.__TEST_RESOURCES__ = {
    servers: [],
    connections: [],
    timers: [],
    intervals: []
  };

  // Override setTimeout to track timers
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = function(callback, delay, ...args) {
    const timer = originalSetTimeout(callback, delay, ...args);
    global.__TEST_RESOURCES__.timers.push(timer);
    return timer;
  };

  // Override setInterval to track intervals
  const originalSetInterval = global.setInterval;
  global.setInterval = function(callback, delay, ...args) {
    const interval = originalSetInterval(callback, delay, ...args);
    global.__TEST_RESOURCES__.intervals.push(interval);
    return interval;
  };
});

// Global teardown - runs once after all tests
afterAll(async () => {
  console.log('Test suite completed');

  // Force cleanup of any remaining handles
  const handleCleanup = async () => {
    // Clear all tracked timers
    if (global.__TEST_RESOURCES__.timers.length > 0) {
      console.log(`Clearing ${global.__TEST_RESOURCES__.timers.length} timers`);
      global.__TEST_RESOURCES__.timers.forEach(timer => {
        clearTimeout(timer);
      });
    }

    // Clear all tracked intervals
    if (global.__TEST_RESOURCES__.intervals.length > 0) {
      console.log(`Clearing ${global.__TEST_RESOURCES__.intervals.length} intervals`);
      global.__TEST_RESOURCES__.intervals.forEach(interval => {
        clearInterval(interval);
      });
    }

    // Close all tracked connections
    if (global.__TEST_RESOURCES__.connections.length > 0) {
      console.log(`Closing ${global.__TEST_RESOURCES__.connections.length} connections`);
      global.__TEST_RESOURCES__.connections.forEach(connection => {
        if (connection && typeof connection.destroy === 'function') {
          connection.destroy();
        }
      });
    }

    // Close all tracked servers
    if (global.__TEST_RESOURCES__.servers.length > 0) {
      console.log(`Closing ${global.__TEST_RESOURCES__.servers.length} servers`);
      const closePromises = global.__TEST_RESOURCES__.servers.map(server => {
        return new Promise(resolve => {
          if (server && typeof server.close === 'function') {
            server.close(resolve);
          } else {
            resolve();
          }
        });
      });

      await Promise.all(closePromises);
    }

    // Get all remaining active handles
    const handles = process._getActiveHandles();

    if (handles.length > 0) {
      console.log(`Cleaning up ${handles.length} remaining handles`);

      // Close any open servers and sockets
      const closePromises = handles.map(handle => {
        return new Promise(resolve => {
          if (handle.constructor.name === 'Server' && typeof handle.close === 'function') {
            handle.close(resolve);
          } else if (handle.constructor.name === 'Socket' && typeof handle.destroy === 'function') {
            handle.destroy();
            resolve();
          } else {
            resolve();
          }
        });
      });

      await Promise.all(closePromises);
    }

    // Reset the global tracking object
    global.__TEST_RESOURCES__ = {
      servers: [],
      connections: [],
      timers: [],
      intervals: []
    };
  };

  // Use a promise with a timeout to ensure we don't hang
  await Promise.race([
    handleCleanup(),
    new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
  ]);
});
