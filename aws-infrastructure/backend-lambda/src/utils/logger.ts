export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: string;
  stack?: string;
  [key: string]: any;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;

  private constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private log(level: LogLevel, message: string, context: LogContext = {}) {
    if (!this.shouldLog(level)) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: 'voice-matrix-api',
      version: process.env.VERSION || '1.0.0',
      environment: process.env.STAGE || 'development',
      ...context
    };

    // In production, this would go to CloudWatch Logs
    console.log(JSON.stringify(logEntry));
  }

  public debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, context?: LogContext) {
    this.log(LogLevel.ERROR, message, context);
  }

  // Security-specific logging methods
  public logSecurityEvent(event: string, context: LogContext) {
    this.warn(`SECURITY_EVENT: ${event}`, {
      ...context,
      security: true,
      alert: true
    });
  }

  public logAuthEvent(event: string, context: LogContext) {
    this.info(`AUTH_EVENT: ${event}`, {
      ...context,
      category: 'authentication'
    });
  }

  public logApiRequest(context: LogContext) {
    this.info('API_REQUEST', {
      ...context,
      category: 'api'
    });
  }

  public logApiResponse(context: LogContext) {
    this.info('API_RESPONSE', {
      ...context,
      category: 'api'
    });
  }
}

// Singleton instance
export const logger = Logger.getInstance();

// Performance monitoring
export class PerformanceMonitor {
  private startTime: number;
  private requestId: string;

  constructor(requestId: string) {
    this.startTime = Date.now();
    this.requestId = requestId;
  }

  public end(additionalContext: LogContext = {}) {
    const duration = Date.now() - this.startTime;
    logger.logApiResponse({
      requestId: this.requestId,
      duration,
      ...additionalContext
    });
  }
}

// Error tracking
export function trackError(error: Error, context: LogContext = {}) {
  logger.error(error.message, {
    ...context,
    error: error.message,
    stack: error.stack,
    errorType: error.constructor.name
  });
}

// Audit logging for sensitive operations
export function auditLog(action: string, context: LogContext) {
  logger.info(`AUDIT: ${action}`, {
    ...context,
    audit: true,
    timestamp: new Date().toISOString()
  });
}