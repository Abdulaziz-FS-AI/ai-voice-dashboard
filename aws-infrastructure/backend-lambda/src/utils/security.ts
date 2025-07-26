import { APIGatewayProxyEvent } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './logger';

const JWT_SECRET = process.env.JWT_SECRET || 'voice-matrix-secret-key';
const RATE_LIMIT_TABLE = process.env.RATE_LIMIT_TABLE || 'auth-rate-limits';

export interface AuthContext {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  tenantId?: string;
}

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  blocked: boolean;
}

export class SecurityUtils {
  private docClient: DynamoDBDocumentClient;

  constructor(docClient: DynamoDBDocumentClient) {
    this.docClient = docClient;
  }

  // JWT token verification
  public async verifyToken(event: APIGatewayProxyEvent): Promise<AuthContext> {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Authorization header is required');
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Validate token structure
      if (!decoded.userId || !decoded.email || !decoded.role) {
        throw new Error('Invalid token structure');
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        tenantId: decoded.tenantId
      };
    } catch (error) {
      logger.logSecurityEvent('INVALID_TOKEN_ATTEMPT', {
        error: error.message,
        ip: event.requestContext.identity.sourceIp,
        userAgent: event.headers['User-Agent']
      });
      throw new Error('Invalid token');
    }
  }

  // Role-based access control
  public checkPermissions(userRole: string, requiredRole: string): boolean {
    const roleHierarchy = {
      'user': 0,
      'admin': 1
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  // Rate limiting implementation
  public async checkRateLimit(
    identifier: string, 
    action: string, 
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = `${identifier}:${action}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Get current rate limit data
      const result = await this.docClient.send(new GetCommand({
        TableName: RATE_LIMIT_TABLE,
        Key: { key }
      }));

      const currentData = result.Item || {
        key,
        attempts: 0,
        windowStart: now,
        blocked: false,
        blockUntil: 0
      };

      // Check if currently blocked
      if (currentData.blocked && now < currentData.blockUntil) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: currentData.blockUntil,
          blocked: true
        };
      }

      // Reset window if needed
      if (now - currentData.windowStart > config.windowMs) {
        currentData.attempts = 0;
        currentData.windowStart = now;
        currentData.blocked = false;
        currentData.blockUntil = 0;
      }

      // Check if limit exceeded
      if (currentData.attempts >= config.maxAttempts) {
        const blockUntil = now + (config.blockDurationMs || config.windowMs);
        
        await this.docClient.send(new PutCommand({
          TableName: RATE_LIMIT_TABLE,
          Item: {
            ...currentData,
            blocked: true,
            blockUntil,
            updatedAt: now
          }
        }));

        logger.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
          identifier,
          action,
          attempts: currentData.attempts,
          maxAttempts: config.maxAttempts
        });

        return {
          allowed: false,
          remaining: 0,
          resetTime: blockUntil,
          blocked: true
        };
      }

      return {
        allowed: true,
        remaining: config.maxAttempts - currentData.attempts,
        resetTime: currentData.windowStart + config.windowMs,
        blocked: false
      };
    } catch (error) {
      logger.error('Rate limit check failed', { error: error.message });
      // Fail open to prevent service disruption
      return {
        allowed: true,
        remaining: config.maxAttempts,
        resetTime: now + config.windowMs,
        blocked: false
      };
    }
  }

  // Update rate limit counter
  public async updateRateLimit(identifier: string, action: string): Promise<void> {
    const key = `${identifier}:${action}`;
    const now = Date.now();

    try {
      await this.docClient.send(new UpdateCommand({
        TableName: RATE_LIMIT_TABLE,
        Key: { key },
        UpdateExpression: 'ADD attempts :inc SET updatedAt = :now',
        ExpressionAttributeValues: {
          ':inc': 1,
          ':now': now
        }
      }));
    } catch (error) {
      logger.error('Failed to update rate limit', { error: error.message });
    }
  }

  // IP address validation and extraction
  public getClientIp(event: APIGatewayProxyEvent): string {
    // Check for IP in various headers (for load balancers, proxies)
    const xForwardedFor = event.headers['X-Forwarded-For'] || event.headers['x-forwarded-for'];
    const xRealIp = event.headers['X-Real-IP'] || event.headers['x-real-ip'];
    const cfConnectingIp = event.headers['CF-Connecting-IP'] || event.headers['cf-connecting-ip'];
    
    if (xForwardedFor) {
      // X-Forwarded-For can contain multiple IPs, use the first one
      return xForwardedFor.split(',')[0].trim();
    }
    
    if (cfConnectingIp) {
      return cfConnectingIp;
    }
    
    if (xRealIp) {
      return xRealIp;
    }
    
    return event.requestContext.identity.sourceIp;
  }

  // Generate secure random tokens
  public generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash sensitive data
  public hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Validate request signature (for webhooks)
  public validateSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  // Security headers for responses
  public getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
  }

  // Detect suspicious activity patterns
  public detectSuspiciousActivity(event: APIGatewayProxyEvent): boolean {
    const userAgent = event.headers['User-Agent'] || '';
    const ip = this.getClientIp(event);
    
    // Basic bot detection
    const suspiciousUserAgents = [
      'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python-requests'
    ];
    
    const isSuspiciousUserAgent = suspiciousUserAgents.some(
      pattern => userAgent.toLowerCase().includes(pattern)
    );
    
    // Check for common attack patterns in headers
    const suspiciousHeaders = [
      'sqlmap', 'nmap', 'nikto', 'burp', 'owasp'
    ];
    
    const headerValues = Object.values(event.headers).join(' ').toLowerCase();
    const hasSuspiciousHeaders = suspiciousHeaders.some(
      pattern => headerValues.includes(pattern)
    );
    
    if (isSuspiciousUserAgent || hasSuspiciousHeaders) {
      logger.logSecurityEvent('SUSPICIOUS_ACTIVITY_DETECTED', {
        ip,
        userAgent,
        headers: event.headers,
        path: event.path,
        method: event.httpMethod
      });
      return true;
    }
    
    return false;
  }

  // Log security events
  public logSecurityEvent(event: string, context: any = {}) {
    logger.logSecurityEvent(event, context);
  }
}

// Pre-configured rate limit configurations
export const RATE_LIMITS = {
  LOGIN: { maxAttempts: 5, windowMs: 15 * 60 * 1000, blockDurationMs: 30 * 60 * 1000 },
  REGISTER: { maxAttempts: 3, windowMs: 60 * 60 * 1000, blockDurationMs: 60 * 60 * 1000 },
  FORGOT_PASSWORD: { maxAttempts: 3, windowMs: 60 * 60 * 1000, blockDurationMs: 60 * 60 * 1000 },
  API_GENERAL: { maxAttempts: 100, windowMs: 60 * 1000, blockDurationMs: 5 * 60 * 1000 },
  API_STRICT: { maxAttempts: 10, windowMs: 60 * 1000, blockDurationMs: 5 * 60 * 1000 }
};

// Password strength validation
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else feedback.push('Password must be at least 8 characters long');

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Password must contain at least one lowercase letter');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Password must contain at least one uppercase letter');

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('Password must contain at least one number');

  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else feedback.push('Password must contain at least one special character');

  if (password.length >= 12) score += 1;

  // Check for common patterns
  const commonPatterns = [
    /123456/, /password/, /qwerty/, /abc123/, /admin/, /letmein/
  ];
  
  const hasCommonPattern = commonPatterns.some(pattern => 
    pattern.test(password.toLowerCase())
  );
  
  if (hasCommonPattern) {
    score -= 2;
    feedback.push('Password contains common patterns');
  }

  return {
    isValid: score >= 5,
    score: Math.max(0, score),
    feedback
  };
}