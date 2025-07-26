import * as Joi from 'joi';

// Common validation schemas
export const commonSchemas = {
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])'))
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one lowercase, uppercase, number and special character'
    }),
  userId: Joi.string().uuid().required(),
  name: Joi.string().min(2).max(50).trim(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  url: Joi.string().uri().optional()
};

// Input sanitization
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

// Validation middleware
export function validateInput(schema: Joi.ObjectSchema) {
  return (input: any) => {
    const sanitizedInput = sanitizeInput(input);
    const { error, value } = schema.validate(sanitizedInput, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      throw new ValidationError(error.details.map(d => d.message).join(', '));
    }
    
    return value;
  };
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Rate limiting schemas
export const rateLimitSchemas = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  register: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
  forgotPassword: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
  api: { maxAttempts: 100, windowMs: 60 * 1000 }
};

// Security headers
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};