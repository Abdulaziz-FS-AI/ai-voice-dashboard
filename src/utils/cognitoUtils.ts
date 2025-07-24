import CryptoJS from 'crypto-js';

/**
 * Calculate SECRET_HASH for Cognito authentication
 * Required when the app client has a client secret configured
 */
export const calculateSecretHash = (username: string, clientId: string, clientSecret: string): string => {
  const message = username + clientId;
  const hash = CryptoJS.HmacSHA256(message, clientSecret);
  return CryptoJS.enc.Base64.stringify(hash);
};

/**
 * Get Cognito client secret from environment
 * This should be set in your environment variables
 */
export const getClientSecret = (): string => {
  return process.env.REACT_APP_USER_POOL_CLIENT_SECRET || '';
};

/**
 * Get Cognito client ID from environment
 */
export const getClientId = (): string => {
  return process.env.REACT_APP_USER_POOL_WEB_CLIENT_ID || '74d2vmmqkhkaeqva03duv4h8r0';
};