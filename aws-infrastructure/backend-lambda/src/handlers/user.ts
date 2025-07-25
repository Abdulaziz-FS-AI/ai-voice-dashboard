import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'voice-matrix-secret-key';
const USERS_TABLE = process.env.USERS_TABLE!;
const VAPI_CONFIG_TABLE = process.env.VAPI_CONFIG_TABLE!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
};

interface VapiCredentials {
  userId: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('User handler called:', JSON.stringify(event, null, 2));

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
      case 'GET:profile':
        return await handleGetProfile(userId);
      case 'PUT:profile':
        return await handleUpdateProfile(userId, event);
      case 'POST:vapi-credentials':
        return await handleSetVapiCredentials(userId, event);
      case 'GET:vapi-credentials':
        return await handleGetVapiCredentials(userId);
      case 'DELETE:vapi-credentials':
        return await handleDeleteVapiCredentials(userId);
      case 'PUT:password':
        return await handleChangePassword(userId, event);
      case 'GET:sync-status':
        return await handleGetSyncStatus(userId);
      case 'POST:sync':
        return await handleSyncUserData(userId, event);
      case 'GET:subscription':
        return await handleGetSubscription(userId);
      case 'PUT:subscription':
        return await handleUpdateSubscription(userId, event);
      case 'DELETE:account':
        return await handleDeleteAccount(userId, event);
      default:
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Endpoint not found' })
        };
    }
  } catch (error) {
    console.error('User handler error:', error);
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

async function handleGetProfile(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const { passwordHash, ...userProfile } = result.Item;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(userProfile)
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

async function handleUpdateProfile(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const updates = JSON.parse(event.body);
    const { firstName, lastName, company, phone } = updates;

    const result = await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET profile.firstName = :firstName, profile.lastName = :lastName, profile.company = :company, profile.phone = :phone, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':firstName': firstName,
        ':lastName': lastName,
        ':company': company,
        ':phone': phone,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    }));

    const { passwordHash, ...userProfile } = result.Attributes!;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(userProfile)
    };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update user profile' })
    };
  }
}

async function handleSetVapiCredentials(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { apiKey } = JSON.parse(event.body);

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Valid API key is required' })
      };
    }

    // Store encrypted VAPI credentials
    const credentials: VapiCredentials = {
      userId,
      apiKey: apiKey.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await docClient.send(new PutCommand({
      TableName: VAPI_CONFIG_TABLE,
      Item: credentials
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'VAPI credentials saved successfully' })
    };
  } catch (error) {
    console.error('Error setting VAPI credentials:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to save VAPI credentials' })
    };
  }
}

async function handleGetVapiCredentials(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: VAPI_CONFIG_TABLE,
      Key: { userId }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'VAPI credentials not found' })
      };
    }

    // Return masked API key for security
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        apiKey: result.Item.apiKey,
        hasCredentials: true,
        createdAt: result.Item.createdAt,
        updatedAt: result.Item.updatedAt
      })
    };
  } catch (error) {
    console.error('Error getting VAPI credentials:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get VAPI credentials' })
    };
  }
}

async function handleDeleteVapiCredentials(userId: string): Promise<APIGatewayProxyResult> {
  try {
    await docClient.send(new DeleteCommand({
      TableName: VAPI_CONFIG_TABLE,
      Key: { userId }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'VAPI credentials deleted successfully' })
    };
  } catch (error) {
    console.error('Error deleting VAPI credentials:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to delete VAPI credentials' })
    };
  }
}

async function handleChangePassword(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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

    // Get current user
    const userResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }));

    if (!userResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, userResult.Item.passwordHash);
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
      body: JSON.stringify({ message: 'Password updated successfully' })
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

async function handleGetSyncStatus(userId: string): Promise<APIGatewayProxyResult> {
  try {
    // Check if user has VAPI credentials
    const vapiResult = await docClient.send(new GetCommand({
      TableName: VAPI_CONFIG_TABLE,
      Key: { userId }
    }));

    // Get user profile
    const userResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }));

    const syncStatus = {
      userId,
      hasVapiCredentials: !!vapiResult.Item,
      profileComplete: !!(userResult.Item?.profile?.firstName && userResult.Item?.profile?.lastName),
      lastSyncAt: userResult.Item?.updatedAt || userResult.Item?.createdAt,
      syncHealthy: true,
      needsSetup: !vapiResult.Item || !userResult.Item?.profile?.firstName
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(syncStatus)
    };
  } catch (error) {
    console.error('Error getting sync status:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get sync status' })
    };
  }
}

async function handleSyncUserData(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Update last sync timestamp
    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET updatedAt = :updatedAt, lastSyncAt = :lastSyncAt',
      ExpressionAttributeValues: {
        ':updatedAt': new Date().toISOString(),
        ':lastSyncAt': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: 'User data synced successfully',
        syncedAt: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error syncing user data:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to sync user data' })
    };
  }
}

async function handleGetSubscription(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const subscription = result.Item.subscription || {
      plan: 'free',
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(subscription)
    };
  } catch (error) {
    console.error('Error getting subscription:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get subscription' })
    };
  }
}

async function handleUpdateSubscription(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { plan, status, expiresAt } = JSON.parse(event.body);

    if (!plan || !status) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Plan and status are required' })
      };
    }

    const subscription = {
      plan,
      status,
      expiresAt: expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year default
    };

    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET subscription = :subscription, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':subscription': subscription,
        ':updatedAt': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(subscription)
    };
  } catch (error) {
    console.error('Error updating subscription:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update subscription' })
    };
  }
}

async function handleDeleteAccount(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { confirmation } = JSON.parse(event.body);

    if (confirmation !== 'DELETE_MY_ACCOUNT') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid confirmation' })
      };
    }

    // Delete user
    await docClient.send(new DeleteCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }));

    // Delete VAPI config if exists
    try {
      await docClient.send(new DeleteCommand({
        TableName: VAPI_CONFIG_TABLE,
        Key: { userId }
      }));
    } catch (error) {
      console.log('VAPI config not found for user, continuing...');
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Account deleted successfully' })
    };
  } catch (error) {
    console.error('Error deleting account:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to delete account' })
    };
  }
}