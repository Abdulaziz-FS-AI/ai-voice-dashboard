import { CognitoIdentityProviderClient, InitiateAuthCommand, SignUpCommand, ConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { calculateSecretHash, getClientSecret } from './secretHash';

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({ 
  region: 'eu-north-1'  // Your user pool region
});

const CLIENT_ID = '2rusigajolp05bnl2hmgb34ku9';

/**
 * Alternative sign-in method that manually handles SECRET_HASH
 * This bypasses Amplify and uses AWS SDK directly
 */
export const cognitoSignIn = async (username: string, password: string) => {
  console.log('🔐 Starting manual Cognito sign-in...');
  
  try {
    const clientSecret = getClientSecret();
    let authParameters: any = {
      USERNAME: username,
      PASSWORD: password
    };

    // Add SECRET_HASH if client has a secret
    if (clientSecret) {
      const secretHash = await calculateSecretHash(username, CLIENT_ID, clientSecret);
      if (secretHash) {
        authParameters.SECRET_HASH = secretHash;
        console.log('🔐 Added SECRET_HASH to auth parameters');
      }
    } else {
      console.log('🔓 Public client - no SECRET_HASH needed');
    }

    const command = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH', // or USER_SRP_AUTH
      AuthParameters: authParameters
    });

    console.log('📡 Sending authentication request...');
    const response = await cognitoClient.send(command);
    
    console.log('✅ Manual Cognito sign-in successful:', {
      challengeName: response.ChallengeName,
      hasAccessToken: !!response.AuthenticationResult?.AccessToken
    });

    return response;
  } catch (error: any) {
    console.error('❌ Manual Cognito sign-in failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.Code || error.$metadata?.httpStatusCode
    });
    throw error;
  }
};

/**
 * Alternative sign-up method that manually handles SECRET_HASH
 */
export const cognitoSignUp = async (username: string, password: string, email: string, name?: string) => {
  console.log('📝 Starting manual Cognito sign-up...');
  
  try {
    const clientSecret = getClientSecret();
    let secretHash: string | undefined;

    // Add SECRET_HASH if client has a secret
    if (clientSecret) {
      const hash = await calculateSecretHash(username, CLIENT_ID, clientSecret);
      if (hash) {
        secretHash = hash;
        console.log('🔐 Added SECRET_HASH to sign-up parameters');
      }
    } else {
      console.log('🔓 Public client - no SECRET_HASH needed for sign-up');
    }

    const userAttributes = [
      {
        Name: 'email',
        Value: email
      }
    ];

    // Add name attribute if provided
    if (name && name.trim()) {
      userAttributes.push({
        Name: 'name',
        Value: name.trim()
      });
    }

    const command = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: username,
      Password: password,
      UserAttributes: userAttributes,
      ...(secretHash && { SecretHash: secretHash })
    });

    console.log('📡 Sending sign-up request...');
    const response = await cognitoClient.send(command);
    
    console.log('✅ Manual Cognito sign-up successful:', {
      userSub: response.UserSub,
      codeDelivery: response.CodeDeliveryDetails?.DeliveryMedium
    });

    return response;
  } catch (error: any) {
    console.error('❌ Manual Cognito sign-up failed:', error);
    throw error;
  }
};

/**
 * Confirm sign-up with manual SECRET_HASH handling
 */
export const cognitoConfirmSignUp = async (username: string, confirmationCode: string) => {
  console.log('✅ Starting manual Cognito confirm sign-up...');
  
  try {
    const clientSecret = getClientSecret();
    let secretHash: string | undefined;

    // Add SECRET_HASH if client has a secret
    if (clientSecret) {
      const hash = await calculateSecretHash(username, CLIENT_ID, clientSecret);
      if (hash) {
        secretHash = hash;
        console.log('🔐 Added SECRET_HASH to confirmation parameters');
      }
    }

    const command = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: username,
      ConfirmationCode: confirmationCode,
      ...(secretHash && { SecretHash: secretHash })
    });

    console.log('📡 Sending confirmation request...');
    const response = await cognitoClient.send(command);
    
    console.log('✅ Manual Cognito confirmation successful');
    return response;
    
  } catch (error: any) {
    console.error('❌ Manual Cognito confirmation failed:', error);
    throw error;
  }
};