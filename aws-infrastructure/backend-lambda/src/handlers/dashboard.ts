import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import * as jwt from 'jsonwebtoken';

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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Dashboard handler called:', JSON.stringify(event, null, 2));

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
      case 'GET:overview':
        return await handleGetDashboardOverview(userId);
      case 'GET:stats':
        return await handleGetDashboardStats(userId);
      case 'GET:recent-activity':
        return await handleGetRecentActivity(userId);
      case 'GET:quick-actions':
        return await handleGetQuickActions(userId);
      default:
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Dashboard endpoint not found' })
        };
    }
  } catch (error) {
    console.error('Dashboard handler error:', error);
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

async function handleGetDashboardOverview(userId: string): Promise<APIGatewayProxyResult> {
  try {
    // Get user profile
    const userResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }));

    // Get VAPI config status
    const vapiResult = await docClient.send(new GetCommand({
      TableName: VAPI_CONFIG_TABLE,
      Key: { userId }
    }));

    const user = userResult.Item;
    const hasVapiConfig = !!vapiResult.Item;

    // Mock call data (in production, fetch from calls table)
    const mockCallData = {
      totalCalls: hasVapiConfig ? Math.floor(Math.random() * 100) + 10 : 0,
      successfulCalls: hasVapiConfig ? Math.floor(Math.random() * 80) + 8 : 0,
      averageDuration: hasVapiConfig ? '2:34' : '0:00',
      satisfactionScore: hasVapiConfig ? (Math.random() * 2 + 3).toFixed(1) : '0.0'
    };

    const overview = {
      user: {
        name: `${user?.profile?.firstName || ''} ${user?.profile?.lastName || ''}`.trim() || user?.email || 'User',
        email: user?.email,
        subscription: user?.subscription || { plan: 'free', status: 'active' },
        joinedAt: user?.createdAt
      },
      setup: {
        profileComplete: !!(user?.profile?.firstName && user?.profile?.lastName),
        vapiConfigured: hasVapiConfig,
        assistantsCreated: hasVapiConfig ? Math.floor(Math.random() * 5) + 1 : 0,
        phoneNumbersLinked: hasVapiConfig ? Math.floor(Math.random() * 3) + 1 : 0
      },
      stats: mockCallData,
      recentActivity: [
        {
          id: '1',
          type: 'call_completed',
          message: 'Call completed successfully',
          timestamp: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: '2',
          type: 'assistant_created',
          message: 'New assistant created',
          timestamp: new Date(Date.now() - 7200000).toISOString()
        }
      ]
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(overview)
    };
  } catch (error) {
    console.error('Error getting dashboard overview:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get dashboard overview' })
    };
  }
}

async function handleGetDashboardStats(userId: string): Promise<APIGatewayProxyResult> {
  try {
    // Check if user has VAPI config
    const vapiResult = await docClient.send(new GetCommand({
      TableName: VAPI_CONFIG_TABLE,
      Key: { userId }
    }));

    const hasVapiConfig = !!vapiResult.Item;

    // Mock statistics (in production, calculate from actual data)
    const stats = {
      totalCalls: hasVapiConfig ? Math.floor(Math.random() * 500) + 50 : 0,
      callsToday: hasVapiConfig ? Math.floor(Math.random() * 20) + 2 : 0,
      callsThisWeek: hasVapiConfig ? Math.floor(Math.random() * 100) + 10 : 0,
      callsThisMonth: hasVapiConfig ? Math.floor(Math.random() * 300) + 30 : 0,
      averageDuration: hasVapiConfig ? Math.floor(Math.random() * 180) + 60 : 0, // seconds
      successRate: hasVapiConfig ? Math.floor(Math.random() * 20) + 80 : 0, // percentage
      topPerformingAssistant: hasVapiConfig ? {
        name: 'Customer Service Bot',
        calls: Math.floor(Math.random() * 100) + 20,
        successRate: Math.floor(Math.random() * 15) + 85
      } : null,
      dailyTrend: hasVapiConfig ? Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        calls: Math.floor(Math.random() * 15) + 2
      })) : []
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(stats)
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get dashboard stats' })
    };
  }
}

async function handleGetRecentActivity(userId: string): Promise<APIGatewayProxyResult> {
  try {
    // Mock recent activity (in production, fetch from activity logs)
    const activities = [
      {
        id: '1',
        type: 'call_completed',
        title: 'Call Completed',
        description: 'Incoming call handled successfully by Customer Service Assistant',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        duration: '3:24',
        outcome: 'success'
      },
      {
        id: '2',
        type: 'assistant_updated',
        title: 'Assistant Updated',
        description: 'Sales Assistant configuration updated',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        outcome: 'info'
      },
      {
        id: '3',
        type: 'call_failed',
        title: 'Call Failed',
        description: 'Call dropped due to network issues',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        duration: '0:15',
        outcome: 'error'
      },
      {
        id: '4',
        type: 'phone_linked',
        title: 'Phone Number Linked',
        description: 'New phone number linked to Support Assistant',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        outcome: 'success'
      },
      {
        id: '5',
        type: 'assistant_created',
        title: 'Assistant Created',
        description: 'New appointment booking assistant created',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        outcome: 'success'
      }
    ];

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        activities,
        total: activities.length
      })
    };
  } catch (error) {
    console.error('Error getting recent activity:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get recent activity' })
    };
  }
}

async function handleGetQuickActions(userId: string): Promise<APIGatewayProxyResult> {
  try {
    // Get user setup status
    const userResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }));

    const vapiResult = await docClient.send(new GetCommand({
      TableName: VAPI_CONFIG_TABLE,
      Key: { userId }
    }));

    const user = userResult.Item;
    const hasVapiConfig = !!vapiResult.Item;
    const profileComplete = !!(user?.profile?.firstName && user?.profile?.lastName);

    const quickActions = [];

    // Conditional quick actions based on setup status
    if (!profileComplete) {
      quickActions.push({
        id: 'complete-profile',
        title: 'Complete Profile',
        description: 'Add your name and company information',
        icon: 'user',
        priority: 'high',
        url: '/profile'
      });
    }

    if (!hasVapiConfig) {
      quickActions.push({
        id: 'setup-vapi',
        title: 'Setup VAPI Integration',
        description: 'Connect your VAPI account to start making calls',
        icon: 'key',
        priority: 'high',
        url: '/settings/vapi'
      });
    }

    // Always available actions
    quickActions.push(
      {
        id: 'create-assistant',
        title: 'Create New Assistant',
        description: 'Build a new AI voice assistant',
        icon: 'plus',
        priority: 'medium',
        url: '/editor'
      },
      {
        id: 'view-calls',
        title: 'View Call Logs',
        description: 'Review recent call activity and performance',
        icon: 'phone',
        priority: 'medium',
        url: '/calls'
      },
      {
        id: 'manage-numbers',
        title: 'Manage Phone Numbers',
        description: 'Add or configure phone numbers',
        icon: 'phone-call',
        priority: 'low',
        url: '/phone-numbers'
      },
      {
        id: 'view-analytics',
        title: 'View Analytics',
        description: 'Analyze call performance and trends',
        icon: 'bar-chart',
        priority: 'low',
        url: '/analytics'
      }
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        actions: quickActions,
        setupProgress: {
          profileComplete,
          vapiConfigured: hasVapiConfig,
          overallProgress: Math.round(((profileComplete ? 1 : 0) + (hasVapiConfig ? 1 : 0)) / 2 * 100)
        }
      })
    };
  } catch (error) {
    console.error('Error getting quick actions:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get quick actions' })
    };
  }
}