/**
 * Centralized error handling utilities for Trmx Agent
 */

// Error types for better classification
export enum ErrorType {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  PROVIDER = 'provider',
  SERVER = 'server',
  STORAGE = 'storage',
  UNKNOWN = 'unknown'
}

// Error interface
export interface TrmxError extends Error {
  type: ErrorType;
  statusCode?: number;
  isRetryable: boolean;
  originalError?: any;
}

/**
 * Create a standardized error object with additional context
 */
export function createError(
  message: string,
  type: ErrorType = ErrorType.UNKNOWN,
  originalError?: any,
  statusCode?: number
): TrmxError {
  const isRetryable = determineIfRetryable(type, statusCode);
  
  const error = new Error(message) as TrmxError;
  error.type = type;
  error.statusCode = statusCode;
  error.isRetryable = isRetryable;
  error.originalError = originalError;
  
  return error;
}

/**
 * Determine if an error is retryable based on type and status code
 */
function determineIfRetryable(type: ErrorType, statusCode?: number): boolean {
  // Network errors are generally retryable
  if (type === ErrorType.NETWORK) return true;
  
  // Authentication/authorization errors are not retryable without user intervention
  if (type === ErrorType.AUTHENTICATION || type === ErrorType.AUTHORIZATION) return false;
  
  // Server errors (5xx) are generally retryable
  if (statusCode && statusCode >= 500 && statusCode < 600) return true;
  
  // Rate limiting errors (429) are retryable after a delay
  if (statusCode === 429) return true;
  
  // Default to non-retryable for safety
  return false;
}

/**
 * Format error for display to user
 */
export function formatErrorForUser(error: TrmxError | Error | any): string {
  // If it's our custom error type
  if ('type' in error) {
    const trmxError = error as TrmxError;
    
    switch (trmxError.type) {
      case ErrorType.NETWORK:
        return 'Network error: Unable to connect to the AI provider. Check your internet connection and try again.';
      
      case ErrorType.AUTHENTICATION:
        return 'Authentication failed: Please check your API key and try again.';
      
      case ErrorType.AUTHORIZATION:
        return 'Authorization error: Your API key does not have access to this resource.';
      
      case ErrorType.VALIDATION:
        return `Invalid request: ${trmxError.message}`;
      
      case ErrorType.PROVIDER:
        return `Provider error: ${trmxError.message}`;
      
      case ErrorType.SERVER:
        return 'Server error: The AI provider is experiencing issues. Please try again later.';
      
      case ErrorType.STORAGE:
        return 'Storage error: Unable to save or retrieve data locally.';
      
      default:
        return trmxError.message || 'An unknown error occurred.';
    }
  }
  
  // For standard errors or other objects
  if (error instanceof Error) {
    return error.message;
  }
  
  // For non-Error objects
  return String(error);
}

/**
 * Classify an error based on its properties
 */
export function classifyError(error: any): TrmxError {
  // Default message
  let message = 'An unexpected error occurred';
  let type = ErrorType.UNKNOWN;
  let statusCode: number | undefined = undefined;
  
  // Handle Axios/HTTP errors
  if (error.response) {
    statusCode = error.response.status;
    
    // Handle based on status code
    // @ts-ignore - statusCode is defined above when error.response exists
    if (statusCode === 401) {
      type = ErrorType.AUTHORIZATION;
      message = 'Authentication failed: Invalid API key or credentials';
    } else if (statusCode === 403) {
      type = ErrorType.AUTHORIZATION;
      message = 'Authorization failed: You do not have access to this resource';
    } else if (statusCode === 404) {
      type = ErrorType.VALIDATION;
      message = 'Resource not found';
    } else if (statusCode === 422) {
      type = ErrorType.VALIDATION;
      message = error.response.data?.message || 'Invalid request';
    } else if (statusCode === 429) {
      type = ErrorType.PROVIDER;
      message = 'Rate limit exceeded: Too many requests';
    } else if (statusCode && statusCode >= 500) {
      type = ErrorType.SERVER;
      message = 'Server error: The AI provider service is unavailable';
    }
  } 
  // Handle network errors
  else if (error.request) {
    type = ErrorType.NETWORK;
    message = 'Network error: Unable to connect to the provider';
  }
  // Handle provider-specific errors
  else if (error.message && error.message.includes('API key')) {
    type = ErrorType.AUTHENTICATION;
    message = error.message;
  }
  
  return createError(message, type, error, statusCode);
}

/**
 * Implements retry logic with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
    onRetry?: (attempt: number, delay: number, error: any) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    onRetry = () => {}
  } = options;
  
  let attempt = 0;
  let lastError: any;
  
  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // On last attempt, don't retry
      if (attempt === maxRetries) {
        break;
      }
      
      // Only retry if the error is classified as retryable
      const classifiedError = error.type ? error : classifyError(error);
      if (!classifiedError.isRetryable) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(factor, attempt), maxDelay);
      
      // Call retry callback
      onRetry(attempt, delay, error);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      attempt++;
    }
  }
  
  throw lastError;
} 