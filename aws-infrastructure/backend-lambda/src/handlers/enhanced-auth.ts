import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import * as Joi from 'joi';

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'voice-matrix-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'voice-matrix-refresh-secret';
const USERS_TABLE = process.env.USERS_TABLE!;
const RATE_LIMIT_TABLE = process.env.RATE_LIMIT_TABLE || 'auth-rate-limits';

// Enhanced User interface with security fields
interface User {
  userId: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt?: string;
  isActive: boolean;
  tenantId?: string;
  
  // Security fields
  loginAttempts?: number;
  lockedUntil?: string;
  lastLoginAt?: string;
  emailVerified?: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: string;
  
  // MFA fields
  mfaEnabled?: boolean;
  mfaSecret?: string;
  
  subscription?: {
    plan: 'free' | 'basic' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled';
    expiresAt?: string;
  };
  profile?: {
    firstName?: string;
    lastName?: string;
    company?: string;
    phone?: string;
  };
}

interface RefreshToken {
  tokenId: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  isRevoked: boolean;
}

// Input validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  mfaCode: Joi.string().length(6).optional()
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])'))
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one lowercase, uppercase, number and special character'
    }),
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  company: Joi.string().max(100).optional()
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])'))
    .required()
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
};

// Rate limiting configuration
const RATE_LIMITS = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  register: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
  forgotPassword: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = uuidv4();
  const timestamp = new Date().toISOString();
  
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Auth handler called',
    requestId,
    timestamp,
    method: event.httpMethod,
    path: event.pathParameters?.proxy,
    userAgent: event.headers['User-Agent'],
    ip: event.requestContext.identity.sourceIp
  }));

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    const path = event.pathParameters?.proxy || '';
    const method = event.httpMethod;
    const clientIp = event.requestContext.identity.sourceIp;

    switch (`${method}:${path}`) {
      case 'POST:login':
        return await handleLogin(event, clientIp, requestId);
      case 'POST:register':
        return await handleRegister(event, clientIp, requestId);
      case 'POST:refresh-token':
        return await handleRefreshToken(event, requestId);
      case 'POST:logout':
        return await handleLogout(event, requestId);
      case 'POST:forgot-password':
        return await handleForgotPassword(event, clientIp, requestId);
      case 'POST:reset-password':
        return await handleResetPassword(event, requestId);
      case 'POST:verify-email':
        return await handleVerifyEmail(event, requestId);
      case 'POST:verify-token':
        return await handleVerifyToken(event, requestId);
      default:
        return createErrorResponse(404, 'ENDPOINT_NOT_FOUND', 'Endpoint not found', requestId);
    }
  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Auth handler error',
      requestId,
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    }));
    
    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Internal server error', requestId);
  }
};

async function handleLogin(event: APIGatewayProxyEvent, clientIp: string, requestId: string): Promise<APIGatewayProxyResult> {
  try {
    // Rate limit check
    const rateLimitResult = await checkRateLimit(clientIp, 'login');
    if (!rateLimitResult.allowed) {
      return createErrorResponse(429, 'RATE_LIMIT_EXCEEDED', 'Too many login attempts. Please try again later.', requestId);
    }

    // Input validation
    const { error, value } = loginSchema.validate(JSON.parse(event.body || '{}'));
    if (error) {
      return createErrorResponse(400, 'VALIDATION_ERROR', error.details[0].message, requestId);
    }

    const { email, password, mfaCode } = value;

    // Get user by email
    const user = await getUserByEmail(email);
    if (!user) {
      await updateRateLimit(clientIp, 'login');
      return createErrorResponse(401, 'INVALID_CREDENTIALS', 'Invalid credentials', requestId);
    }

    // Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return createErrorResponse(423, 'ACCOUNT_LOCKED', 'Account is temporarily locked due to multiple failed login attempts', requestId);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      // Increment login attempts
      await incrementLoginAttempts(user.userId);
      await updateRateLimit(clientIp, 'login');
      return createErrorResponse(401, 'INVALID_CREDENTIALS', 'Invalid credentials', requestId);
    }

    // Check if account is active
    if (!user.isActive) {
      return createErrorResponse(401, 'ACCOUNT_DISABLED', 'Account is disabled', requestId);
    }

    // Check email verification
    if (!user.emailVerified) {
      return createErrorResponse(401, 'EMAIL_NOT_VERIFIED', 'Please verify your email address', requestId);
    }

    // Handle MFA if enabled
    if (user.mfaEnabled && !mfaCode) {
      return createErrorResponse(202, 'MFA_REQUIRED', 'MFA code required', requestId);
    }

    if (user.mfaEnabled && mfaCode) {
      const mfaValid = await verifyMFACode(user.mfaSecret!, mfaCode);
      if (!mfaValid) {
        return createErrorResponse(401, 'INVALID_MFA_CODE', 'Invalid MFA code', requestId);
      }
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user);

    // Reset login attempts and update last login
    await resetLoginAttempts(user.userId);

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'User logged in successfully',
      requestId,
      timestamp: new Date().toISOString(),
      userId: user.userId,
      email: user.email
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          accessToken,
          refreshToken,
          user: {
            userId: user.userId,
            email: user.email,
            role: user.role,
            profile: user.profile,
            mfaEnabled: user.mfaEnabled
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId
        }
      })
    };
  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Login error',
      requestId,
      error: error.message
    }));
    return createErrorResponse(500, 'LOGIN_FAILED', 'Login failed', requestId);
  }
}

async function handleRegister(event: APIGatewayProxyEvent, clientIp: string, requestId: string): Promise<APIGatewayProxyResult> {
  try {
    // Rate limit check
    const rateLimitResult = await checkRateLimit(clientIp, 'register');
    if (!rateLimitResult.allowed) {
      return createErrorResponse(429, 'RATE_LIMIT_EXCEEDED', 'Too many registration attempts. Please try again later.', requestId);
    }

    // Input validation
    const { error, value } = registerSchema.validate(JSON.parse(event.body || '{}'));
    if (error) {
      return createErrorResponse(400, 'VALIDATION_ERROR', error.details[0].message, requestId);
    }

    const { email, password, firstName, lastName, company } = value;

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      await updateRateLimit(clientIp, 'register');
      return createErrorResponse(409, 'USER_EXISTS', 'User already exists', requestId);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userId = uuidv4();
    const tenantId = uuidv4();
    const emailVerificationToken = uuidv4();
    
    const user: User = {
      userId,
      email,
      passwordHash,
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      tenantId,
      emailVerified: false,
      emailVerificationToken,
      loginAttempts: 0,
      mfaEnabled: false,
      subscription: {
        plan: 'free',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      profile: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(company && { company })
      }
    };

    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: user,
      ConditionExpression: 'attribute_not_exists(userId)'
    }));

    // TODO: Send email verification email (implement with SES)
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'User registered successfully',
      requestId,
      timestamp: new Date().toISOString(),
      userId: user.userId,
      email: user.email
    }));

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          message: 'Registration successful. Please check your email to verify your account.',
          userId: user.userId
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId
        }
      })
    };
  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Registration error',
      requestId,
      error: error.message
    }));
    return createErrorResponse(500, 'REGISTRATION_FAILED', 'Registration failed', requestId);
  }
}

async function handleRefreshToken(event: APIGatewayProxyEvent, requestId: string): Promise<APIGatewayProxyResult> {
  try {
    const { refreshToken } = JSON.parse(event.body || '{}');
    
    if (!refreshToken) {
      return createErrorResponse(400, 'MISSING_REFRESH_TOKEN', 'Refresh token is required', requestId);
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    
    // Get user
    const user = await getUserById(decoded.userId);
    if (!user || !user.isActive) {
      return createErrorResponse(401, 'INVALID_TOKEN', 'Invalid refresh token', requestId);
    }

    // Generate new tokens
    const tokens = await generateTokens(user);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: tokens,
        meta: {
          timestamp: new Date().toISOString(),
          requestId
        }
      })
    };
  } catch (error) {
    return createErrorResponse(401, 'INVALID_TOKEN', 'Invalid refresh token', requestId);
  }
}

async function handleLogout(event: APIGatewayProxyEvent, requestId: string): Promise<APIGatewayProxyResult> {
  try {
    const { refreshToken } = JSON.parse(event.body || '{}');
    
    if (refreshToken) {
      // TODO: Revoke refresh token in database
      console.log(JSON.stringify({
        level: 'INFO',
        message: 'User logged out',
        requestId,
        timestamp: new Date().toISOString()
      }));
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: { message: 'Logout successful' },
        meta: {
          timestamp: new Date().toISOString(),
          requestId
        }
      })
    };
  } catch (error) {
    return createErrorResponse(500, 'LOGOUT_FAILED', 'Logout failed', requestId);
  }
}

async function handleForgotPassword(event: APIGatewayProxyEvent, clientIp: string, requestId: string): Promise<APIGatewayProxyResult> {
  try {
    // Rate limit check
    const rateLimitResult = await checkRateLimit(clientIp, 'forgotPassword');
    if (!rateLimitResult.allowed) {
      return createErrorResponse(429, 'RATE_LIMIT_EXCEEDED', 'Too many password reset attempts. Please try again later.', requestId);
    }

    // Input validation
    const { error, value } = forgotPasswordSchema.validate(JSON.parse(event.body || '{}'));
    if (error) {
      return createErrorResponse(400, 'VALIDATION_ERROR', error.details[0].message, requestId);
    }

    const { email } = value;
    const user = await getUserByEmail(email);
    
    // Always return success to prevent user enumeration
    if (user) {
      const resetToken = uuidv4();
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      await docClient.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId: user.userId },
        UpdateExpression: 'SET passwordResetToken = :token, passwordResetExpires = :expires, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':token': resetToken,
          ':expires': resetExpires,
          ':updatedAt': new Date().toISOString()
        }
      }));

      // TODO: Send password reset email
      console.log(JSON.stringify({
        level: 'INFO',
        message: 'Password reset requested',
        requestId,
        userId: user.userId,
        email: user.email
      }));
    }

    await updateRateLimit(clientIp, 'forgotPassword');

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: { message: 'If an account with that email exists, a password reset link has been sent.' },
        meta: {
          timestamp: new Date().toISOString(),
          requestId
        }
      })
    };
  } catch (error) {
    return createErrorResponse(500, 'FORGOT_PASSWORD_FAILED', 'Password reset failed', requestId);
  }
}

async function handleResetPassword(event: APIGatewayProxyEvent, requestId: string): Promise<APIGatewayProxyResult> {
  try {
    // Input validation
    const { error, value } = resetPasswordSchema.validate(JSON.parse(event.body || '{}'));
    if (error) {
      return createErrorResponse(400, 'VALIDATION_ERROR', error.details[0].message, requestId);
    }

    const { token, password } = value;

    // Find user by reset token
    const result = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'passwordResetToken = :token AND passwordResetExpires > :now',
      ExpressionAttributeValues: {
        ':token': token,
        ':now': new Date().toISOString()
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      return createErrorResponse(400, 'INVALID_TOKEN', 'Invalid or expired reset token', requestId);
    }

    const user = result.Items[0] as User;

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user
    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId: user.userId },
      UpdateExpression: 'SET passwordHash = :hash, passwordResetToken = :null, passwordResetExpires = :null, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':hash': passwordHash,
        ':null': null,
        ':updatedAt': new Date().toISOString()
      }
    }));

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Password reset successful',
      requestId,
      userId: user.userId
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: { message: 'Password reset successful' },
        meta: {
          timestamp: new Date().toISOString(),
          requestId
        }
      })
    };
  } catch (error) {
    return createErrorResponse(500, 'RESET_PASSWORD_FAILED', 'Password reset failed', requestId);
  }
}

async function handleVerifyEmail(event: APIGatewayProxyEvent, requestId: string): Promise<APIGatewayProxyResult> {
  try {
    const { token } = JSON.parse(event.body || '{}');
    
    if (!token) {
      return createErrorResponse(400, 'MISSING_TOKEN', 'Verification token is required', requestId);
    }

    // Find user by verification token
    const result = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'emailVerificationToken = :token',
      ExpressionAttributeValues: {
        ':token': token
      }
    }));

    if (!result.Items || result.Items.length === 0) {
      return createErrorResponse(400, 'INVALID_TOKEN', 'Invalid verification token', requestId);
    }

    const user = result.Items[0] as User;

    // Update user
    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId: user.userId },
      UpdateExpression: 'SET emailVerified = :verified, emailVerificationToken = :null, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':verified': true,
        ':null': null,
        ':updatedAt': new Date().toISOString()
      }
    }));

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Email verified successfully',
      requestId,
      userId: user.userId
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: { message: 'Email verified successfully' },
        meta: {
          timestamp: new Date().toISOString(),
          requestId
        }
      })
    };
  } catch (error) {
    return createErrorResponse(500, 'EMAIL_VERIFICATION_FAILED', 'Email verification failed', requestId);
  }
}

async function handleVerifyToken(event: APIGatewayProxyEvent, requestId: string): Promise<APIGatewayProxyResult> {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse(401, 'MISSING_TOKEN', 'Authorization header is required', requestId);
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Get fresh user data
    const user = await getUserById(decoded.userId);
    if (!user || !user.isActive) {
      return createErrorResponse(401, 'INVALID_TOKEN', 'Invalid token', requestId);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          valid: true,
          user: {
            userId: user.userId,
            email: user.email,
            role: user.role,
            profile: user.profile
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId
        }
      })
    };
  } catch (error) {
    return createErrorResponse(401, 'INVALID_TOKEN', 'Invalid token', requestId);
  }
}

// Helper functions
async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      },
      Limit: 1
    }));

    return result.Items && result.Items.length > 0 ? result.Items[0] as User : null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
}

async function getUserById(userId: string): Promise<User | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }));

    return result.Item as User || null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

async function generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    {
      userId: user.userId,
      tokenType: 'refresh'
    },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

async function checkRateLimit(identifier: string, action: string): Promise<{ allowed: boolean; remaining: number }> {
  // Simplified rate limiting - in production, use Redis or DynamoDB
  // This is a basic implementation
  try {
    const limit = RATE_LIMITS[action];
    const key = `${identifier}:${action}`;
    const now = Date.now();
    
    // TODO: Implement proper rate limiting with DynamoDB or Redis
    return { allowed: true, remaining: limit.maxAttempts };
  } catch (error) {
    // Allow on error to prevent service disruption
    return { allowed: true, remaining: 1 };
  }
}

async function updateRateLimit(identifier: string, action: string): Promise<void> {
  // TODO: Implement rate limit counter update
}

async function incrementLoginAttempts(userId: string): Promise<void> {
  try {
    const MAX_ATTEMPTS = 5;
    const LOCK_TIME = 30 * 60 * 1000; // 30 minutes

    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'ADD loginAttempts :inc SET updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':updatedAt': new Date().toISOString()
      }
    }));

    // Check if we need to lock the account
    const user = await getUserById(userId);
    if (user && user.loginAttempts >= MAX_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCK_TIME).toISOString();
      await docClient.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: 'SET lockedUntil = :lockUntil',
        ExpressionAttributeValues: {
          ':lockUntil': lockUntil
        }
      }));
    }
  } catch (error) {
    console.error('Error incrementing login attempts:', error);
  }
}

async function resetLoginAttempts(userId: string): Promise<void> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET loginAttempts = :zero, lockedUntil = :null, lastLoginAt = :now, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':null': null,
        ':now': new Date().toISOString(),
        ':updatedAt': new Date().toISOString()
      }
    }));
  } catch (error) {
    console.error('Error resetting login attempts:', error);
  }
}

async function verifyMFACode(secret: string, code: string): Promise<boolean> {
  // TODO: Implement TOTP verification
  // For now, accept any 6-digit code for demo purposes
  return /^\d{6}$/.test(code);
}

function createErrorResponse(statusCode: number, errorCode: string, message: string, requestId: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({
      success: false,
      error: {
        code: errorCode,
        message,
        details: null
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId
      }
    })
  };
}