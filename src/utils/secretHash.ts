/**
 * Calculate SECRET_HASH for AWS Cognito authentication using Web Crypto API
 * Based on AWS documentation: https://docs.aws.amazon.com/cognito/latest/developerguide/signing-up-users-in-your-app.html
 * 
 * Formula: Base64(HMAC_SHA256(username + client_id, client_secret))
 */
export const calculateSecretHash = async (username: string, clientId: string, clientSecret?: string | null): Promise<string | null> => {
  // If no client secret, return null (public client)
  if (!clientSecret) {
    console.log('🔓 Public client detected - no SECRET_HASH needed');
    return null;
  }

  try {
    // Check if Web Crypto API is available
    if (!window.crypto || !window.crypto.subtle) {
      console.error('❌ Web Crypto API not available');
      return null;
    }

    // Concatenate username and client ID
    const message = username + clientId;
    
    // Convert strings to ArrayBuffer
    const encoder = new TextEncoder();
    const keyData = encoder.encode(clientSecret);
    const messageData = encoder.encode(message);
    
    // Import the key for HMAC
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Create HMAC-SHA256 signature
    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, messageData);
    
    // Convert to base64
    const uint8Array = new Uint8Array(signature);
    const base64String = btoa(String.fromCharCode.apply(null, Array.from(uint8Array) as number[]));
    
    console.log('🔐 SECRET_HASH calculated for user:', username.substring(0, 3) + '***');
    
    return base64String;
  } catch (error) {
    console.error('❌ Failed to calculate SECRET_HASH:', error);
    return null;
  }
};

/**
 * Get client secret from environment or configuration
 * This would typically come from AWS Systems Manager Parameter Store or environment variables
 */
export const getClientSecret = (): string | null => {
  // In a real application, this would come from secure storage
  // For testing, we can use environment variable or test value
  const clientSecret = process.env.REACT_APP_CLIENT_SECRET || null;
  
  // For debugging: uncomment the line below to test with a fake secret
  // const clientSecret = 'test-secret-for-debugging';
  
  if (clientSecret) {
    console.log('🔑 Client secret found in environment');
  } else {
    console.log('🔓 No client secret configured (public client)');
  }
  
  return clientSecret;
};

/**
 * Prepare authentication parameters with SECRET_HASH if needed
 */
export const prepareAuthParams = async (username: string, clientId: string): Promise<{ username: string; clientId: string; secretHash?: string }> => {
  const clientSecret = getClientSecret();
  const secretHash = await calculateSecretHash(username, clientId, clientSecret);
  
  const params: any = {
    username,
    clientId
  };
  
  // Only add SECRET_HASH if we have a client secret
  if (secretHash) {
    params.secretHash = secretHash;
  }
  
  console.log('🔧 Auth params prepared:', {
    username: username.substring(0, 3) + '***',
    clientId,
    hasSecretHash: !!secretHash
  });
  
  return params;
};