// Error handling utility to prevent information disclosure
// and provide consistent error responses

export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  timestamp: number;
  context?: string;
}

// Error codes for different types of errors
export const ERROR_CODES = {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  
  // Validation errors
  VALIDATION_INVALID_INPUT: 'VALIDATION_INVALID_INPUT',
  VALIDATION_MISSING_FIELD: 'VALIDATION_MISSING_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  
  // Server errors
  SERVER_ERROR: 'SERVER_ERROR',
  SERVER_UNAVAILABLE: 'SERVER_UNAVAILABLE',
  SERVER_MAINTENANCE: 'SERVER_MAINTENANCE',
  
  // Client errors
  CLIENT_ERROR: 'CLIENT_ERROR',
  CLIENT_STORAGE_ERROR: 'CLIENT_STORAGE_ERROR',
  CLIENT_VALIDATION_ERROR: 'CLIENT_VALIDATION_ERROR',
  
  // Unknown errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

// User-friendly error messages
const USER_MESSAGES: Record<string, string> = {
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password. Please try again.',
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ERROR_CODES.AUTH_UNAUTHORIZED]: 'You are not authorized to perform this action.',
  [ERROR_CODES.AUTH_FORBIDDEN]: 'Access denied. Please contact your administrator.',
  
  [ERROR_CODES.VALIDATION_INVALID_INPUT]: 'Please check your input and try again.',
  [ERROR_CODES.VALIDATION_MISSING_FIELD]: 'Please fill in all required fields.',
  [ERROR_CODES.VALIDATION_INVALID_FORMAT]: 'Please check the format of your input.',
  
  [ERROR_CODES.NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
  [ERROR_CODES.NETWORK_TIMEOUT]: 'Request timed out. Please try again.',
  [ERROR_CODES.NETWORK_UNAVAILABLE]: 'Service is currently unavailable. Please try again later.',
  
  [ERROR_CODES.SERVER_ERROR]: 'Something went wrong on our end. Please try again later.',
  [ERROR_CODES.SERVER_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',
  [ERROR_CODES.SERVER_MAINTENANCE]: 'Service is under maintenance. Please try again later.',
  
  [ERROR_CODES.CLIENT_ERROR]: 'Something went wrong. Please refresh the page and try again.',
  [ERROR_CODES.CLIENT_STORAGE_ERROR]: 'Unable to save data locally. Please try again.',
  [ERROR_CODES.CLIENT_VALIDATION_ERROR]: 'Please check your input and try again.',
  
  [ERROR_CODES.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
};

// Create a standardized error
export const createError = (
  code: string,
  message: string,
  context?: string
): AppError => {
  return {
    code,
    message,
    userMessage: USER_MESSAGES[code] || USER_MESSAGES[ERROR_CODES.UNKNOWN_ERROR],
    timestamp: Date.now(),
    context
  };
};

// Handle API errors
export const handleApiError = (error: any, context?: string): AppError => {
  console.error('API Error:', error);
  
  // Network errors
  if (!navigator.onLine) {
    return createError(ERROR_CODES.NETWORK_UNAVAILABLE, 'No internet connection', context);
  }
  
  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    return createError(ERROR_CODES.NETWORK_TIMEOUT, 'Request timeout', context);
  }
  
  // HTTP status code errors
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    
    switch (status) {
      case 400:
        return createError(ERROR_CODES.VALIDATION_INVALID_INPUT, data?.message || 'Invalid request', context);
      case 401:
        return createError(ERROR_CODES.AUTH_UNAUTHORIZED, 'Unauthorized access', context);
      case 403:
        return createError(ERROR_CODES.AUTH_FORBIDDEN, 'Access forbidden', context);
      case 404:
        return createError(ERROR_CODES.SERVER_ERROR, 'Resource not found', context);
      case 408:
        return createError(ERROR_CODES.NETWORK_TIMEOUT, 'Request timeout', context);
      case 429:
        return createError(ERROR_CODES.SERVER_ERROR, 'Too many requests. Please try again later.', context);
      case 500:
        return createError(ERROR_CODES.SERVER_ERROR, 'Internal server error', context);
      case 502:
      case 503:
      case 504:
        return createError(ERROR_CODES.SERVER_UNAVAILABLE, 'Service unavailable', context);
      default:
        return createError(ERROR_CODES.SERVER_ERROR, `Server error (${status})`, context);
    }
  }
  
  // Network errors
  if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
    return createError(ERROR_CODES.NETWORK_ERROR, 'Network error', context);
  }
  
  // Unknown errors
  return createError(ERROR_CODES.UNKNOWN_ERROR, error.message || 'Unknown error', context);
};

// Handle client-side errors
export const handleClientError = (error: any, context?: string): AppError => {
  console.error('Client Error:', error);
  
  if (error.name === 'ValidationError') {
    return createError(ERROR_CODES.CLIENT_VALIDATION_ERROR, error.message, context);
  }
  
  if (error.name === 'StorageError') {
    return createError(ERROR_CODES.CLIENT_STORAGE_ERROR, 'Storage error', context);
  }
  
  return createError(ERROR_CODES.CLIENT_ERROR, error.message || 'Client error', context);
};

// Sanitize error messages for logging (remove sensitive information)
export const sanitizeErrorForLogging = (error: any): any => {
  if (!error) return error;
  
  const sanitized = { ...error };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'authorization', 'cookie', 'session'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  // Sanitize nested objects
  if (sanitized.response?.data) {
    sanitized.response.data = sanitizeErrorForLogging(sanitized.response.data);
  }
  
  if (sanitized.config?.headers) {
    const headers = { ...sanitized.config.headers };
    Object.keys(headers).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        headers[key] = '[REDACTED]';
      }
    });
    sanitized.config.headers = headers;
  }
  
  return sanitized;
};

// Log error securely
export const logError = (error: AppError, originalError?: any) => {
  const sanitizedOriginal = originalError ? sanitizeErrorForLogging(originalError) : null;
  
  console.error('Application Error:', {
    code: error.code,
    message: error.message,
    userMessage: error.userMessage,
    context: error.context,
    timestamp: error.timestamp,
    originalError: sanitizedOriginal
  });
  
  // In production, you might want to send this to an error tracking service
  // like Sentry, LogRocket, or your own logging service
  if (process.env.NODE_ENV === 'production') {
    // Example: sendToErrorTracking(error, sanitizedOriginal);
  }
};

// Error boundary helper
export const getErrorBoundaryFallback = (error: AppError) => {
  return {
    title: 'Something went wrong',
    message: error.userMessage,
    action: 'Please refresh the page and try again.'
  };
};

// Validation error helper
export const createValidationError = (field: string, message: string): AppError => {
  return createError(
    ERROR_CODES.VALIDATION_INVALID_INPUT,
    `Validation error for field '${field}': ${message}`,
    'validation'
  );
};

// Authentication error helper
export const createAuthError = (message: string): AppError => {
  return createError(ERROR_CODES.AUTH_UNAUTHORIZED, message, 'authentication');
};

// Network error helper
export const createNetworkError = (message: string): AppError => {
  return createError(ERROR_CODES.NETWORK_ERROR, message, 'network');
};

const errorHandler = {
  createError,
  handleApiError,
  handleClientError,
  sanitizeErrorForLogging,
  logError,
  getErrorBoundaryFallback,
  createValidationError,
  createAuthError,
  createNetworkError,
  ERROR_CODES
};

export default errorHandler;
