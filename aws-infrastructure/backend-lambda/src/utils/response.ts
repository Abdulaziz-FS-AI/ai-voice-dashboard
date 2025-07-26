import { APIGatewayProxyResult } from 'aws-lambda';
import { securityHeaders } from './validation';

// Standard CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
  'Content-Type': 'application/json'
};

// Error codes enum
export enum ErrorCode {
  // Authentication & Authorization
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  MFA_REQUIRED = 'MFA_REQUIRED',
  INVALID_MFA_CODE = 'INVALID_MFA_CODE',
  INVALID_TOKEN = 'INVALID_TOKEN',
  MISSING_TOKEN = 'MISSING_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Resource Management
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server Errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // Business Logic
  USER_EXISTS = 'USER_EXISTS',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // Generic
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED'
}

// Response interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface PaginationOptions {
  page: number;
  limit: number;
  total: number;
}

// Response builders
export class ResponseBuilder {
  public static success<T>(
    data: T,
    requestId: string,
    statusCode: number = 200,
    pagination?: PaginationOptions
  ): APIGatewayProxyResult {
    const response: ApiResponse<T> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        ...(pagination && {
          pagination: {
            ...pagination,
            totalPages: Math.ceil(pagination.total / pagination.limit)
          }
        })
      }
    };

    return {
      statusCode,
      headers: { ...corsHeaders, ...securityHeaders },
      body: JSON.stringify(response)
    };
  }

  public static error(
    errorCode: ErrorCode,
    message: string,
    requestId: string,
    statusCode: number = 400,
    details?: any
  ): APIGatewayProxyResult {
    const response: ApiResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        details
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    return {
      statusCode,
      headers: { ...corsHeaders, ...securityHeaders },
      body: JSON.stringify(response)
    };
  }

  public static corsResponse(): APIGatewayProxyResult {
    return {
      statusCode: 200,
      headers: { ...corsHeaders, ...securityHeaders },
      body: ''
    };
  }
}

// Convenience functions for common responses
export function successResponse<T>(
  data: T,
  requestId: string,
  statusCode?: number,
  pagination?: PaginationOptions
): APIGatewayProxyResult {
  return ResponseBuilder.success(data, requestId, statusCode, pagination);
}

export function errorResponse(
  errorCode: ErrorCode,
  message: string,
  requestId: string,
  statusCode?: number,
  details?: any
): APIGatewayProxyResult {
  return ResponseBuilder.error(errorCode, message, requestId, statusCode, details);
}

export function corsResponse(): APIGatewayProxyResult {
  return ResponseBuilder.corsResponse();
}

// Specific error responses for common scenarios
export function validationError(message: string, requestId: string): APIGatewayProxyResult {
  return errorResponse(ErrorCode.VALIDATION_ERROR, message, requestId, 400);
}

export function unauthorizedError(message: string, requestId: string): APIGatewayProxyResult {
  return errorResponse(ErrorCode.INVALID_TOKEN, message, requestId, 401);
}

export function forbiddenError(message: string, requestId: string): APIGatewayProxyResult {
  return errorResponse(ErrorCode.INSUFFICIENT_PERMISSIONS, message, requestId, 403);
}

export function notFoundError(message: string, requestId: string): APIGatewayProxyResult {
  return errorResponse(ErrorCode.RESOURCE_NOT_FOUND, message, requestId, 404);
}

export function rateLimitError(message: string, requestId: string): APIGatewayProxyResult {
  return errorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, message, requestId, 429);
}

export function internalError(message: string, requestId: string): APIGatewayProxyResult {
  return errorResponse(ErrorCode.INTERNAL_SERVER_ERROR, message, requestId, 500);
}

// HTTP status code constants
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;