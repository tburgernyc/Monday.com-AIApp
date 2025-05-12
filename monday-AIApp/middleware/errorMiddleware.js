/**
 * Error handling middleware for Monday.com Claude Integration App
 * Provides consistent error response structure and logging
 */

const { v4: uuidv4 } = require('uuid');
const { Logger } = require('@mondaycom/apps-sdk');

const logger = new Logger('error-middleware');

/**
 * Format error response in a consistent structure
 * 
 * @param {Error} error - The error object
 * @param {Object} req - Express request object
 * @returns {Object} - Formatted error response
 */
function formatErrorResponse(error, req) {
  const errorId = uuidv4();
  
  // Log detailed error information
  logger.error('Error processing request', { 
    errorId, 
    requestId: req.id,
    path: req.path,
    method: req.method,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    }
  });
  
  // Standard error response structure
  const errorResponse = {
    error: {
      id: errorId,
      type: 'processing_error',
      message: 'An unexpected error occurred while processing your request.',
      userAction: 'Please try again later or contact support if the issue persists.'
    }
  };
  
  // Customize based on error type
  if (error.name === 'ValidationError' || error.type === 'VALIDATION') {
    errorResponse.error.type = 'validation_error';
    errorResponse.error.message = 'Your request contains invalid data.';
    errorResponse.error.details = error.details || [];
    errorResponse.error.userAction = 'Please check your inputs and try again.';
  } else if (error.name === 'AuthenticationError' || error.type === 'AUTHENTICATION') {
    errorResponse.error.type = 'authentication_error';
    errorResponse.error.message = 'Authentication failed.';
    errorResponse.error.userAction = 'Please log out and log back in to refresh your session.';
  } else if (error.name === 'RateLimitError' || error.type === 'RATE_LIMIT') {
    errorResponse.error.type = 'rate_limit_error';
    errorResponse.error.message = 'You have exceeded the allowed request rate.';
    errorResponse.error.userAction = 'Please wait a few minutes and try again.';
  } else if (error.name === 'PermissionError' || error.type === 'PERMISSION') {
    errorResponse.error.type = 'permission_error';
    errorResponse.error.message = 'You do not have permission to perform this action.';
    errorResponse.error.userAction = 'Please contact your administrator to request access.';
  } else if (error.name === 'NotFoundError' || error.type === 'NOT_FOUND') {
    errorResponse.error.type = 'not_found_error';
    errorResponse.error.message = 'The requested resource was not found.';
    errorResponse.error.userAction = 'Please check that the resource exists and try again.';
  } else if (error.response) {
    // Handle API response errors
    if (error.response.status === 429) {
      errorResponse.error.type = 'rate_limit_error';
      errorResponse.error.message = 'The service is experiencing high demand.';
      errorResponse.error.userAction = 'Please wait a few minutes and try again.';
    } else if (error.response.status >= 500) {
      errorResponse.error.type = 'service_error';
      errorResponse.error.message = 'An external service is currently unavailable.';
      errorResponse.error.userAction = 'Please try again later.';
    } else if (error.response.status === 401) {
      errorResponse.error.type = 'authentication_error';
      errorResponse.error.message = 'Authentication failed with an external service.';
      errorResponse.error.userAction = 'Please check your credentials and try again.';
    } else if (error.response.status === 403) {
      errorResponse.error.type = 'permission_error';
      errorResponse.error.message = 'You do not have permission to access this resource.';
      errorResponse.error.userAction = 'Please contact your administrator to request access.';
    } else if (error.response.status === 404) {
      errorResponse.error.type = 'not_found_error';
      errorResponse.error.message = 'The requested resource was not found.';
      errorResponse.error.userAction = 'Please check that the resource exists and try again.';
    }
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
    errorResponse.error.type = 'connection_error';
    errorResponse.error.message = 'Unable to connect to required services.';
    errorResponse.error.userAction = 'Please check your internet connection and try again later.';
  }
  
  return errorResponse;
}

/**
 * Error handling middleware
 * 
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
  const errorResponse = formatErrorResponse(err, req);
  
  // Set appropriate status code based on error type
  let statusCode = 500;
  
  switch (errorResponse.error.type) {
    case 'validation_error':
      statusCode = 400;
      break;
    case 'authentication_error':
      statusCode = 401;
      break;
    case 'permission_error':
      statusCode = 403;
      break;
    case 'not_found_error':
      statusCode = 404;
      break;
    case 'rate_limit_error':
      statusCode = 429;
      break;
    case 'service_error':
    case 'connection_error':
      statusCode = 503;
      break;
    default:
      statusCode = 500;
  }
  
  res.status(statusCode).json(errorResponse);
}

module.exports = {
  formatErrorResponse,
  errorHandler
};
