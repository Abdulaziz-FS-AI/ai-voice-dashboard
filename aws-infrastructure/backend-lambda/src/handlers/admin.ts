import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import * as jwt from 'jsonwebtoken';

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const JWT_SECRET = process.env.JWT_SECRET || 'voice-matrix-secret-key';
const USERS_TABLE = process.env.USERS_TABLE!;
const VAPI_CONFIG_TABLE = process.env.VAPI_CONFIG_TABLE!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Admin handler called:', JSON.stringify(event, null, 2));

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Verify JWT token and admin role
    const authResult = await verifyAdminToken(event);
    if (authResult.statusCode !== 200) {
      return authResult;
    }

    const { userId, role } = JSON.parse(authResult.body);
    const path = event.pathParameters?.proxy || '';
    const method = event.httpMethod;

    switch (`${method}:${path}`) {
      case 'GET:users':
        return await handleGetUsers();
      case 'GET:analytics':
        return await handleGetAnalytics();
      case 'PUT:users/status':
        return await handleUpdateUserStatus(event);
      case 'DELETE:users':
        return await handleDeleteUser(event);
      case 'GET:system-status':
        return await handleGetSystemStatus();
      default:
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Admin endpoint not found' })
        };
    }
  } catch (error) {
    console.error('Admin handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function verifyAdminToken(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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
    
    if (decoded.role !== 'admin') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Admin access required' })
      };
    }

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

async function handleGetUsers(): Promise<APIGatewayProxyResult> {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      ProjectionExpression: 'userId, email, #role, createdAt, isActive, profile, updatedAt',
      ExpressionAttributeNames: {
        '#role': 'role'
      }
    }));

    const users = result.Items || [];

    // Get VAPI config status for each user
    const usersWithVapiStatus = await Promise.all(
      users.map(async (user) => {
        try {
          const vapiResult = await docClient.send(new GetCommand({
            TableName: VAPI_CONFIG_TABLE,
            Key: { userId: user.userId }
          }));

          return {
            ...user,
            hasVapiConfig: !!vapiResult.Item,
            vapiConfigUpdated: vapiResult.Item?.updatedAt || null
          };
        } catch (error) {
          return {
            ...user,
            hasVapiConfig: false,
            vapiConfigUpdated: null
          };
        }
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        users: usersWithVapiStatus,
        totalUsers: users.length
      })
    };
  } catch (error) {
    console.error('Error getting users:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get users' })
    };
  }
}

async function handleGetAnalytics(): Promise<APIGatewayProxyResult> {
  try {
    // Get all users
    const usersResult = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      ProjectionExpression: 'userId, createdAt, isActive, #role',
      ExpressionAttributeNames: {
        '#role': 'role'
      }
    }));

    // Get all VAPI configs
    const vapiResult = await docClient.send(new ScanCommand({
      TableName: VAPI_CONFIG_TABLE,
      ProjectionExpression: 'userId, createdAt'
    }));

    const users = usersResult.Items || [];
    const vapiConfigs = vapiResult.Items || [];

    // Calculate analytics
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.isActive).length;
    const adminUsers = users.filter(u => u.role === 'admin').length;
    const usersWithVapi = vapiConfigs.length;

    // Calculate registration trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRegistrations = users.filter(u => 
      new Date(u.createdAt) >= thirtyDaysAgo
    ).length;

    // Calculate daily registration data for the last 7 days
    const dailyRegistrations = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = users.filter(u => {
        const userDate = new Date(u.createdAt);
        return userDate >= dayStart && userDate < dayEnd;
      }).length;

      dailyRegistrations.push({
        date: dayStart.toISOString().split('T')[0],
        count
      });
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        overview: {
          totalUsers,
          activeUsers,
          adminUsers,
          usersWithVapi,
          recentRegistrations
        },
        trends: {
          dailyRegistrations
        },
        growth: {
          userGrowthRate: totalUsers > 0 ? (recentRegistrations / totalUsers * 100).toFixed(1) : '0',
          vapiAdoptionRate: totalUsers > 0 ? (usersWithVapi / totalUsers * 100).toFixed(1) : '0'
        }
      })
    };
  } catch (error) {
    console.error('Error getting analytics:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get analytics' })
    };
  }
}

async function handleUpdateUserStatus(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { userId, isActive } = JSON.parse(event.body);

    if (!userId || typeof isActive !== 'boolean') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User ID and isActive status are required' })
      };
    }

    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET isActive = :isActive, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isActive': isActive,
        ':updatedAt': new Date().toISOString()
      },
      ConditionExpression: 'attribute_exists(userId)'
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        userId,
        isActive
      })
    };
  } catch (error: any) {
    console.error('Error updating user status:', error);
    
    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update user status' })
    };
  }
}

async function handleDeleteUser(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;

  if (!userId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'User ID is required' })
    };
  }

  try {
    // Delete user
    await docClient.send(new DeleteCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      ConditionExpression: 'attribute_exists(userId)'
    }));

    // Delete VAPI config if exists
    try {
      await docClient.send(new DeleteCommand({
        TableName: VAPI_CONFIG_TABLE,
        Key: { userId }
      }));
    } catch (error) {
      // Ignore error if VAPI config doesn't exist
      console.log('VAPI config not found for user, continuing...');
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: 'User deleted successfully',
        userId
      })
    };
  } catch (error: any) {
    console.error('Error deleting user:', error);
    
    if (error.name === 'ConditionalCheckFailedException') {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to delete user' })
    };
  }
}

async function handleGetSystemStatus(): Promise<APIGatewayProxyResult> {
  try {
    // Check DynamoDB tables health
    const healthChecks = await Promise.allSettled([
      docClient.send(new ScanCommand({
        TableName: USERS_TABLE,
        Limit: 1
      })),
      docClient.send(new ScanCommand({
        TableName: VAPI_CONFIG_TABLE,
        Limit: 1
      }))
    ]);

    const systemStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        usersDatabase: healthChecks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        vapiConfigDatabase: healthChecks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        lambda: 'healthy' // If we're responding, Lambda is healthy
      },
      version: '1.0.0',
      environment: process.env.STAGE || 'unknown'
    };

    // Overall status is unhealthy if any service is unhealthy
    const allServicesHealthy = Object.values(systemStatus.services).every(status => status === 'healthy');
    if (!allServicesHealthy) {
      systemStatus.status = 'unhealthy';
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(systemStatus)
    };
  } catch (error) {
    console.error('Error getting system status:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Failed to check system status'
      })
    };
  }
}