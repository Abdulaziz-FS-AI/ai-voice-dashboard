import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand, PutSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const secretsClient = new SecretsManagerClient({ region: process.env.REGION });

const JWT_SECRET = process.env.JWT_SECRET || 'voice-matrix-secret-key';
const USERS_TABLE = process.env.USERS_TABLE!;
const USER_SETTINGS_TABLE = process.env.USER_SETTINGS_TABLE!;

interface UserSettings {
  userId: string;
  preferences: {
    notifications: {
      email: boolean;
      sms: boolean;
      callAlerts: boolean;
      weeklyReports: boolean;
      systemUpdates: boolean;
    };
    dashboard: {
      theme: 'light' | 'dark' | 'auto';
      timezone: string;
      language: string;
      defaultView: 'overview' | 'analytics' | 'calls';
    };
    calling: {
      recordCalls: boolean;
      maxCallDuration: number; // seconds
      callTimeout: number; // seconds
      enableTranscription: boolean;
    };
  };
  integrations: {
    vapi: {
      configured: boolean;
      apiKeySet: boolean;
      lastSync: string;
    };
    twilio: {
      configured: boolean;
      accountSid?: string;
      lastSync?: string;
    };
    slack: {
      configured: boolean;
      webhookUrl?: string;
      channels?: string[];
    };
    email: {
      provider: 'sendgrid' | 'aws-ses' | 'custom';
      configured: boolean;
      fromEmail?: string;
    };
  };
  billing: {
    plan: 'free' | 'basic' | 'pro' | 'enterprise';
    usage: {
      calls: number;
      minutes: number;
      assistants: number;
    };
    limits: {
      calls: number;
      minutes: number;
      assistants: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Settings handler called:', JSON.stringify(event, null, 2));

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Verify JWT token
    const authResult = await verifyToken(event);
    if (authResult.statusCode !== 200) {
      return authResult;
    }

    const { userId, role } = JSON.parse(authResult.body);
    const path = event.pathParameters?.proxy || '';
    const method = event.httpMethod;

    switch (`${method}:${path}`) {
      case 'GET:':
      case 'GET:profile':
        return await handleGetUserProfile(userId);
      case 'PUT:profile':
        return await handleUpdateUserProfile(event, userId);
      case 'GET:preferences':
        return await handleGetUserPreferences(userId);
      case 'PUT:preferences':
        return await handleUpdateUserPreferences(event, userId);
      case 'GET:integrations':
        return await handleGetIntegrations(userId);
      case 'PUT:integrations/vapi':
        return await handleUpdateVapiIntegration(event, userId);
      case 'PUT:integrations/twilio':
        return await handleUpdateTwilioIntegration(event, userId);
      case 'PUT:integrations/slack':
        return await handleUpdateSlackIntegration(event, userId);
      case 'POST:change-password':
        return await handleChangePassword(event, userId);
      case 'GET:billing':
        return await handleGetBillingInfo(userId);
      case 'POST:test-integration':
        return await handleTestIntegration(event, userId);
      default:
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Settings endpoint not found' })
        };
    }
  } catch (error) {
    console.error('Settings handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function verifyToken(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Authorization header is required' })
    };
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      })
    };
  } catch (error) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }
}

async function handleGetUserProfile(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }));

    const user = result.Item;
    if (!user) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    // Remove sensitive information
    const { passwordHash, ...profileData } = user;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        profile: profileData
      })
    };
  } catch (error) {
    console.error('Error getting user profile:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get user profile' })
    };
  }
}

async function handleUpdateUserProfile(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { firstName, lastName, company, phone, email } = JSON.parse(event.body);

    const updateExpressions = ['updatedAt = :updatedAt'];
    const expressionValues: any = {
      ':updatedAt': new Date().toISOString()
    };

    if (firstName !== undefined) {
      updateExpressions.push('profile.firstName = :firstName');
      expressionValues[':firstName'] = firstName;
    }

    if (lastName !== undefined) {
      updateExpressions.push('profile.lastName = :lastName');
      expressionValues[':lastName'] = lastName;
    }

    if (company !== undefined) {
      updateExpressions.push('profile.company = :company');
      expressionValues[':company'] = company;
    }

    if (phone !== undefined) {
      updateExpressions.push('profile.phone = :phone');
      expressionValues[':phone'] = phone;
    }

    if (email !== undefined) {
      updateExpressions.push('email = :email');
      expressionValues[':email'] = email;
    }

    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionValues
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Profile updated successfully'
      })
    };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update profile' })
    };
  }
}

async function handleGetUserPreferences(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: USER_SETTINGS_TABLE,
      Key: { userId }
    }));

    let settings = result.Item as UserSettings;
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = await createDefaultSettings(userId);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        preferences: settings.preferences,
        integrations: settings.integrations,
        billing: settings.billing
      })
    };
  } catch (error) {
    console.error('Error getting user preferences:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get preferences' })
    };
  }
}

async function handleUpdateUserPreferences(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const preferences = JSON.parse(event.body);

    await docClient.send(new UpdateCommand({
      TableName: USER_SETTINGS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET preferences = :preferences, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':preferences': preferences,
        ':updatedAt': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Preferences updated successfully'
      })
    };
  } catch (error) {
    console.error('Error updating preferences:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update preferences' })
    };
  }
}

async function handleGetIntegrations(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: USER_SETTINGS_TABLE,
      Key: { userId }
    }));

    const settings = result.Item as UserSettings;
    const integrations = settings?.integrations || await getDefaultIntegrations();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        integrations
      })
    };
  } catch (error) {
    console.error('Error getting integrations:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get integrations' })
    };
  }
}

async function handleUpdateVapiIntegration(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { apiKey } = JSON.parse(event.body);

    if (!apiKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'VAPI API key is required' })
      };
    }

    // Store API key in Secrets Manager
    const secretName = `voice-matrix/users/${userId}/vapi-api-key`;
    await secretsClient.send(new PutSecretValueCommand({
      SecretId: secretName,
      SecretString: apiKey
    }));

    // Update integration status
    await docClient.send(new UpdateCommand({
      TableName: USER_SETTINGS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET integrations.vapi = :vapi, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':vapi': {
          configured: true,
          apiKeySet: true,
          lastSync: new Date().toISOString()
        },
        ':updatedAt': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'VAPI integration configured successfully'
      })
    };
  } catch (error) {
    console.error('Error updating VAPI integration:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update VAPI integration' })
    };
  }
}

async function handleChangePassword(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { currentPassword, newPassword } = JSON.parse(event.body);

    if (!currentPassword || !newPassword) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Current password and new password are required' })
      };
    }

    // Get user
    const result = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }));

    const user = result.Item;
    if (!user) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Current password is incorrect' })
      };
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET passwordHash = :passwordHash, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':passwordHash': newPasswordHash,
        ':updatedAt': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Password changed successfully'
      })
    };
  } catch (error) {
    console.error('Error changing password:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to change password' })
    };
  }
}

async function handleGetBillingInfo(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: USER_SETTINGS_TABLE,
      Key: { userId }
    }));

    const settings = result.Item as UserSettings;
    const billing = settings?.billing || {
      plan: 'free',
      usage: { calls: 0, minutes: 0, assistants: 0 },
      limits: { calls: 100, minutes: 500, assistants: 1 }
    };

    // Mock billing data for MVP
    const billingInfo = {
      ...billing,
      currentPeriod: {
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
      },
      nextBilling: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
      paymentMethod: {
        type: 'card',
        last4: '4242',
        brand: 'visa'
      },
      invoices: [
        {
          id: 'inv_001',
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          amount: 2500, // $25.00
          status: 'paid'
        }
      ]
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        billing: billingInfo
      })
    };
  } catch (error) {
    console.error('Error getting billing info:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get billing info' })
    };
  }
}

// Helper functions
async function createDefaultSettings(userId: string): Promise<UserSettings> {
  const defaultSettings: UserSettings = {
    userId,
    preferences: {
      notifications: {
        email: true,
        sms: false,
        callAlerts: true,
        weeklyReports: true,
        systemUpdates: true
      },
      dashboard: {
        theme: 'light',
        timezone: 'America/New_York',
        language: 'en',
        defaultView: 'overview'
      },
      calling: {
        recordCalls: true,
        maxCallDuration: 600, // 10 minutes
        callTimeout: 30, // 30 seconds
        enableTranscription: true
      }
    },
    integrations: await getDefaultIntegrations(),
    billing: {
      plan: 'free',
      usage: {
        calls: 0,
        minutes: 0,
        assistants: 0
      },
      limits: {
        calls: 100,
        minutes: 500,
        assistants: 1
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await docClient.send(new PutCommand({
    TableName: USER_SETTINGS_TABLE,
    Item: defaultSettings
  }));

  return defaultSettings;
}

async function getDefaultIntegrations() {
  return {
    vapi: {
      configured: false,
      apiKeySet: false,
      lastSync: ''
    },
    twilio: {
      configured: false,
      lastSync: ''
    },
    slack: {
      configured: false
    },
    email: {
      provider: 'aws-ses' as const,
      configured: false
    }
  };
}

async function handleUpdateTwilioIntegration(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  // Implementation for Twilio integration
  return {
    statusCode: 501,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Twilio integration not implemented yet' })
  };
}

async function handleUpdateSlackIntegration(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  // Implementation for Slack integration
  return {
    statusCode: 501,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Slack integration not implemented yet' })
  };
}

async function handleTestIntegration(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  // Implementation for testing integrations
  return {
    statusCode: 501,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Test integration not implemented yet' })
  };
}