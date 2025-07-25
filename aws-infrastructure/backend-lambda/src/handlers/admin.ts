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
        return await handleGetUsers(event);
      case 'GET:analytics':
        return await handleGetAnalytics();
      case 'PUT:users/status':
        return await handleUpdateUserStatus(event);
      case 'DELETE:users':
        return await handleDeleteUser(event);
      case 'GET:system-status':
        return await handleGetSystemStatus();
      case 'GET:revenue':
        return await handleGetRevenue(event);
      case 'GET:subscriptions':
        return await handleGetSubscriptions(event);
      case 'PUT:subscriptions':
        return await handleUpdateUserSubscription(event);
      case 'GET:audit-logs':
        return await handleGetAuditLogs(event);
      case 'POST:broadcast':
        return await handleBroadcastMessage(event);
      case 'GET:feature-flags':
        return await handleGetFeatureFlags();
      case 'PUT:feature-flags':
        return await handleUpdateFeatureFlags(event);
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

async function handleGetUsers(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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

async function handleGetRevenue(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { period = '30' } = event.queryStringParameters || {};
    const periodDays = parseInt(period);
    
    // Get all users with subscriptions
    const result = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      ProjectionExpression: 'userId, subscription, createdAt'
    }));

    const users = result.Items || [];
    
    // Calculate revenue metrics
    const currentDate = new Date();
    const periodStart = new Date(currentDate.getTime() - periodDays * 24 * 60 * 60 * 1000);
    
    const planPrices = {
      free: 0,
      basic: 29,
      pro: 99,
      enterprise: 299
    };

    let totalRevenue = 0;
    let activeSubscriptions = 0;
    const revenueByPlan: { [key: string]: number } = {};

    users.forEach(user => {
      if (user.subscription && user.subscription.status === 'active') {
        const planPrice = planPrices[user.subscription.plan as keyof typeof planPrices] || 0;
        totalRevenue += planPrice;
        activeSubscriptions++;
        revenueByPlan[user.subscription.plan] = (revenueByPlan[user.subscription.plan] || 0) + planPrice;
      }
    });

    const recentUsers = users.filter(u => new Date(u.createdAt) >= periodStart);
    const newSubscriptionRevenue = recentUsers
      .filter(u => u.subscription && u.subscription.status === 'active')
      .reduce((sum, u) => sum + (planPrices[u.subscription.plan as keyof typeof planPrices] || 0), 0);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        totalRevenue,
        monthlyRecurringRevenue: totalRevenue,
        activeSubscriptions,
        revenueByPlan,
        newSubscriptionRevenue,
        averageRevenuePerUser: activeSubscriptions > 0 ? totalRevenue / activeSubscriptions : 0,
        period: `${periodDays} days`
      })
    };
  } catch (error) {
    console.error('Error getting revenue:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get revenue data' })
    };
  }
}

async function handleGetSubscriptions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { page = '1', limit = '50' } = event.queryStringParameters || {};
    
    const result = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      ProjectionExpression: 'userId, email, subscription, createdAt, profile'
    }));

    const users = result.Items || [];
    const subscriptions = users
      .filter(u => u.subscription)
      .map(u => ({
        userId: u.userId,
        email: u.email,
        name: `${u.profile?.firstName || ''} ${u.profile?.lastName || ''}`.trim(),
        subscription: u.subscription,
        createdAt: u.createdAt
      }));

    // Simple pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedSubscriptions = subscriptions.slice(startIndex, endIndex);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        subscriptions: paginatedSubscriptions,
        total: subscriptions.length,
        page: pageNum,
        totalPages: Math.ceil(subscriptions.length / limitNum)
      })
    };
  } catch (error) {
    console.error('Error getting subscriptions:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get subscriptions' })
    };
  }
}

async function handleUpdateUserSubscription(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { userId, plan, status, expiresAt } = JSON.parse(event.body);

    if (!userId || !plan || !status) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'userId, plan, and status are required' })
      };
    }

    const subscription = {
      plan,
      status,
      expiresAt: expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    };

    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET subscription = :subscription, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':subscription': subscription,
        ':updatedAt': new Date().toISOString()
      },
      ConditionExpression: 'attribute_exists(userId)'
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Subscription updated successfully',
        userId,
        subscription
      })
    };
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    
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
      body: JSON.stringify({ error: 'Failed to update subscription' })
    };
  }
}

async function handleGetAuditLogs(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // In a real implementation, you'd have a separate audit logs table
    // For now, return mock audit data
    const mockAuditLogs = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        userId: 'admin-demo',
        action: 'USER_STATUS_UPDATED',
        details: 'User account activated',
        ipAddress: '192.168.1.1'
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        userId: 'admin-demo',
        action: 'SUBSCRIPTION_UPDATED',
        details: 'User upgraded to Pro plan',
        ipAddress: '192.168.1.1'
      }
    ];

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        logs: mockAuditLogs,
        total: mockAuditLogs.length
      })
    };
  } catch (error) {
    console.error('Error getting audit logs:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get audit logs' })
    };
  }
}

async function handleBroadcastMessage(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { message, userFilter = 'all' } = JSON.parse(event.body);

    if (!message) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    // In a real implementation, you'd send this via email/SMS/push notifications
    console.log('Broadcasting message:', message, 'to filter:', userFilter);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Broadcast message sent successfully',
        recipientFilter: userFilter,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error broadcasting message:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to broadcast message' })
    };
  }
}

async function handleGetFeatureFlags(): Promise<APIGatewayProxyResult> {
  try {
    // Mock feature flags - in production, store in DynamoDB or feature flag service
    const featureFlags = {
      'new-ui': { enabled: true, description: 'Enable new UI design' },
      'advanced-analytics': { enabled: false, description: 'Advanced analytics dashboard' },
      'beta-features': { enabled: true, description: 'Beta feature access' },
      'maintenance-mode': { enabled: false, description: 'Maintenance mode banner' }
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(featureFlags)
    };
  } catch (error) {
    console.error('Error getting feature flags:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get feature flags' })
    };
  }
}

async function handleUpdateFeatureFlags(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const featureFlags = JSON.parse(event.body);

    // In production, save to DynamoDB or feature flag service
    console.log('Updating feature flags:', featureFlags);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Feature flags updated successfully',
        flags: featureFlags,
        updatedAt: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error updating feature flags:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update feature flags' })
    };
  }
}