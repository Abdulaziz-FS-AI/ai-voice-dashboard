import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import * as jwt from 'jsonwebtoken';

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'voice-matrix-secret-key';
const CALL_LOGS_TABLE = process.env.CALL_LOGS_TABLE!;
const ASSISTANTS_TABLE = process.env.ASSISTANTS_TABLE!;

interface CallLog {
  id: string;
  userId: string;
  assistantId: string;
  callerNumber: string;
  startTime: string;
  endTime: string;
  duration: number; // seconds
  transcript: any[];
  summary: string;
  outcome: 'completed' | 'transferred' | 'hung_up' | 'failed';
  sentiment: 'positive' | 'neutral' | 'negative';
  cost: number; // in cents
  vapiCallId: string;
}

interface AnalyticsMetrics {
  totalCalls: number;
  totalDuration: number; // seconds
  averageDuration: number;
  successRate: number; // percentage
  transferRate: number; // percentage
  costTotal: number; // in cents
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  callsBy: {
    hour: Record<string, number>;
    day: Record<string, number>;
    week: Record<string, number>;
  };
  topPerformers: {
    assistantId: string;
    assistantName: string;
    callCount: number;
    successRate: number;
    avgDuration: number;
  }[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Analytics handler called:', JSON.stringify(event, null, 2));

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
        return await handleGetAnalyticsOverview(userId, event.queryStringParameters);
      case 'GET:calls':
        return await handleGetCallLogs(userId, event.queryStringParameters);
      case 'GET:performance':
        return await handleGetPerformanceMetrics(userId, event.queryStringParameters);
      case 'GET:trends':
        return await handleGetTrends(userId, event.queryStringParameters);
      case 'GET:assistant-comparison':
        return await handleGetAssistantComparison(userId);
      case 'GET:real-time':
        return await handleGetRealTimeMetrics(userId);
      default:
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Analytics endpoint not found' })
        };
    }
  } catch (error) {
    console.error('Analytics handler error:', error);
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

async function handleGetAnalyticsOverview(userId: string, queryParams: any): Promise<APIGatewayProxyResult> {
  try {
    const timeframe = queryParams?.timeframe || '30d'; // 7d, 30d, 90d, all
    const startDate = getStartDateFromTimeframe(timeframe);

    // For MVP, return mock data with realistic patterns
    const mockMetrics: AnalyticsMetrics = {
      totalCalls: Math.floor(Math.random() * 500) + 100,
      totalDuration: Math.floor(Math.random() * 50000) + 10000, // seconds
      averageDuration: Math.floor(Math.random() * 300) + 120, // 2-7 minutes
      successRate: Math.floor(Math.random() * 20) + 80, // 80-100%
      transferRate: Math.floor(Math.random() * 15) + 5, // 5-20%
      costTotal: Math.floor(Math.random() * 50000) + 5000, // cents
      sentimentDistribution: {
        positive: Math.floor(Math.random() * 30) + 60, // 60-90%
        neutral: Math.floor(Math.random() * 20) + 10, // 10-30%
        negative: Math.floor(Math.random() * 10) + 0 // 0-10%
      },
      callsBy: {
        hour: generateHourlyDistribution(),
        day: generateDailyDistribution(timeframe),
        week: generateWeeklyDistribution(timeframe)
      },
      topPerformers: [
        {
          assistantId: 'assistant-1',
          assistantName: 'Customer Service Bot',
          callCount: Math.floor(Math.random() * 200) + 50,
          successRate: Math.floor(Math.random() * 10) + 90,
          avgDuration: Math.floor(Math.random() * 60) + 180
        },
        {
          assistantId: 'assistant-2',
          assistantName: 'Sales Assistant',
          callCount: Math.floor(Math.random() * 150) + 30,
          successRate: Math.floor(Math.random() * 15) + 85,
          avgDuration: Math.floor(Math.random() * 120) + 240
        }
      ]
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        metrics: mockMetrics,
        timeframe,
        generatedAt: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error getting analytics overview:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get analytics overview' })
    };
  }
}

async function handleGetCallLogs(userId: string, queryParams: any): Promise<APIGatewayProxyResult> {
  try {
    const limit = parseInt(queryParams?.limit || '50');
    const offset = parseInt(queryParams?.offset || '0');
    const assistantId = queryParams?.assistantId;
    const outcome = queryParams?.outcome;

    // Mock call logs for MVP
    const mockCallLogs: CallLog[] = Array.from({ length: limit }, (_, i) => {
      const callId = `call-${Date.now()}-${i}`;
      const startTime = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      const duration = Math.floor(Math.random() * 600) + 30; // 30 seconds to 10 minutes
      const endTime = new Date(startTime.getTime() + duration * 1000);
      
      const outcomes: Array<'completed' | 'transferred' | 'hung_up' | 'failed'> = ['completed', 'transferred', 'hung_up', 'failed'];
      const sentiments: Array<'positive' | 'neutral' | 'negative'> = ['positive', 'neutral', 'negative'];
      
      return {
        id: callId,
        userId,
        assistantId: assistantId || `assistant-${Math.floor(Math.random() * 3) + 1}`,
        callerNumber: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration,
        transcript: [
          { role: 'assistant', content: 'Hello! How can I help you today?', timestamp: startTime.toISOString() },
          { role: 'user', content: 'Hi, I have a question about your services.', timestamp: new Date(startTime.getTime() + 2000).toISOString() },
          { role: 'assistant', content: 'I\'d be happy to help! What would you like to know?', timestamp: new Date(startTime.getTime() + 4000).toISOString() }
        ],
        summary: 'Customer inquiry about services, provided information and contact details.',
        outcome: outcome || outcomes[Math.floor(Math.random() * outcomes.length)],
        sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
        cost: Math.floor(Math.random() * 500) + 50, // 50-550 cents
        vapiCallId: `vapi-${callId}`
      };
    });

    const totalCalls = Math.floor(Math.random() * 1000) + 200;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        calls: mockCallLogs,
        pagination: {
          total: totalCalls,
          limit,
          offset,
          hasMore: offset + limit < totalCalls
        },
        filters: {
          assistantId,
          outcome
        }
      })
    };
  } catch (error) {
    console.error('Error getting call logs:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get call logs' })
    };
  }
}

async function handleGetPerformanceMetrics(userId: string, queryParams: any): Promise<APIGatewayProxyResult> {
  try {
    const timeframe = queryParams?.timeframe || '30d';
    const assistantId = queryParams?.assistantId;

    // Mock performance data
    const performanceData = {
      callVolume: generateTimeSeriesData(timeframe, 'calls'),
      successRate: generateTimeSeriesData(timeframe, 'percentage'),
      averageDuration: generateTimeSeriesData(timeframe, 'duration'),
      customerSatisfaction: generateTimeSeriesData(timeframe, 'rating'),
      costEfficiency: generateTimeSeriesData(timeframe, 'cost'),
      responseTime: generateTimeSeriesData(timeframe, 'milliseconds'),
      transferRate: generateTimeSeriesData(timeframe, 'percentage'),
      assistantComparison: assistantId ? null : [
        {
          assistantId: 'assistant-1',
          name: 'Customer Service',
          metrics: {
            calls: 245,
            successRate: 94.2,
            avgDuration: 180,
            satisfaction: 4.6
          }
        },
        {
          assistantId: 'assistant-2', 
          name: 'Sales Assistant',
          metrics: {
            calls: 156,
            successRate: 87.3,
            avgDuration: 240,
            satisfaction: 4.3
          }
        }
      ]
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        performance: performanceData,
        timeframe,
        assistantId
      })
    };
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get performance metrics' })
    };
  }
}

async function handleGetTrends(userId: string, queryParams: any): Promise<APIGatewayProxyResult> {
  try {
    const timeframe = queryParams?.timeframe || '30d';
    
    const trends = {
      callVolumeGrowth: {
        current: Math.floor(Math.random() * 500) + 200,
        previous: Math.floor(Math.random() * 400) + 150,
        change: Math.floor(Math.random() * 40) - 20 // -20% to +20%
      },
      successRateChange: {
        current: Math.floor(Math.random() * 10) + 90,
        previous: Math.floor(Math.random() * 10) + 85,
        change: Math.floor(Math.random() * 10) - 5
      },
      costOptimization: {
        currentCost: Math.floor(Math.random() * 10000) + 5000,
        previousCost: Math.floor(Math.random() * 12000) + 6000,
        savings: Math.floor(Math.random() * 2000) + 500
      },
      peakHours: [
        { hour: '09:00', calls: Math.floor(Math.random() * 50) + 20 },
        { hour: '14:00', calls: Math.floor(Math.random() * 60) + 30 },
        { hour: '16:00', calls: Math.floor(Math.random() * 40) + 25 }
      ],
      topIssues: [
        { category: 'Billing Questions', count: Math.floor(Math.random() * 100) + 50 },
        { category: 'Technical Support', count: Math.floor(Math.random() * 80) + 40 },
        { category: 'General Inquiry', count: Math.floor(Math.random() * 120) + 60 }
      ]
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        trends,
        timeframe,
        generatedAt: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error getting trends:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get trends' })
    };
  }
}

async function handleGetAssistantComparison(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const comparison = [
      {
        assistantId: 'assistant-1',
        name: 'Customer Service Bot',
        metrics: {
          totalCalls: 487,
          successRate: 94.2,
          avgDuration: 185,
          transferRate: 8.3,
          satisfaction: 4.6,
          cost: 2450 // cents
        },
        strengths: ['High success rate', 'Quick resolution', 'Positive feedback'],
        improvements: ['Reduce transfer rate', 'Optimize for cost']
      },
      {
        assistantId: 'assistant-2',
        name: 'Sales Assistant', 
        metrics: {
          totalCalls: 234,
          successRate: 87.3,
          avgDuration: 312,
          transferRate: 12.1,
          satisfaction: 4.3,
          cost: 1876
        },
        strengths: ['Good lead qualification', 'Detailed conversations'],
        improvements: ['Improve success rate', 'Reduce call duration']
      },
      {
        assistantId: 'assistant-3',
        name: 'Appointment Booking',
        metrics: {
          totalCalls: 156,
          successRate: 96.8,
          avgDuration: 142,
          transferRate: 3.2,
          satisfaction: 4.8,
          cost: 890
        },
        strengths: ['Excellent success rate', 'Efficient booking', 'Low transfer rate'],
        improvements: ['Scale volume', 'Maintain quality']
      }
    ];

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        comparison,
        generatedAt: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error getting assistant comparison:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get assistant comparison' })
    };
  }
}

async function handleGetRealTimeMetrics(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const realTimeData = {
      activeCalls: Math.floor(Math.random() * 10),
      callsToday: Math.floor(Math.random() * 50) + 20,
      callsThisHour: Math.floor(Math.random() * 10) + 2,
      currentSuccessRate: Math.floor(Math.random() * 10) + 90,
      avgWaitTime: Math.floor(Math.random() * 30) + 10, // seconds
      assistantStatus: [
        {
          assistantId: 'assistant-1',
          name: 'Customer Service',
          status: 'active',
          activeCalls: Math.floor(Math.random() * 3),
          lastCall: new Date(Date.now() - Math.random() * 3600000).toISOString()
        },
        {
          assistantId: 'assistant-2',
          name: 'Sales Assistant',
          status: 'active',
          activeCalls: Math.floor(Math.random() * 2),
          lastCall: new Date(Date.now() - Math.random() * 3600000).toISOString()
        }
      ],
      recentActivity: Array.from({ length: 5 }, (_, i) => ({
        id: `activity-${i}`,
        type: ['call_started', 'call_completed', 'call_transferred'][Math.floor(Math.random() * 3)],
        assistantName: ['Customer Service', 'Sales Assistant'][Math.floor(Math.random() * 2)],
        timestamp: new Date(Date.now() - Math.random() * 300000).toISOString(),
        duration: Math.floor(Math.random() * 300) + 30
      }))
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        realTime: realTimeData,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error getting real-time metrics:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get real-time metrics' })
    };
  }
}

// Helper functions
function getStartDateFromTimeframe(timeframe: string): Date {
  const now = new Date();
  switch (timeframe) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function generateHourlyDistribution(): Record<string, number> {
  const hours: Record<string, number> = {};
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, '0');
    // Simulate realistic business hour patterns
    let callCount = 0;
    if (i >= 9 && i <= 17) { // Business hours
      callCount = Math.floor(Math.random() * 40) + 10;
    } else if (i >= 18 && i <= 21) { // Evening
      callCount = Math.floor(Math.random() * 20) + 5;
    } else { // Night/early morning
      callCount = Math.floor(Math.random() * 5);
    }
    hours[hour] = callCount;
  }
  return hours;
}

function generateDailyDistribution(timeframe: string): Record<string, number> {
  const days: Record<string, number> = {};
  const numDays = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
  
  for (let i = 0; i < numDays; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    days[dateStr] = Math.floor(Math.random() * 50) + 10;
  }
  return days;
}

function generateWeeklyDistribution(timeframe: string): Record<string, number> {
  const weeks: Record<string, number> = {};
  const numWeeks = timeframe === '7d' ? 1 : timeframe === '30d' ? 4 : 12;
  
  for (let i = 0; i < numWeeks; i++) {
    const weekStart = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
    const weekStr = `Week of ${weekStart.toISOString().split('T')[0]}`;
    weeks[weekStr] = Math.floor(Math.random() * 300) + 100;
  }
  return weeks;
}

function generateTimeSeriesData(timeframe: string, dataType: string): Array<{date: string, value: number}> {
  const numPoints = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
  const data = [];
  
  for (let i = numPoints - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    let value = 0;
    
    switch (dataType) {
      case 'calls':
        value = Math.floor(Math.random() * 50) + 10;
        break;
      case 'percentage':
        value = Math.floor(Math.random() * 20) + 80;
        break;
      case 'duration':
        value = Math.floor(Math.random() * 120) + 120;
        break;
      case 'rating':
        value = parseFloat((Math.random() * 1.5 + 3.5).toFixed(1));
        break;
      case 'cost':
        value = Math.floor(Math.random() * 1000) + 500;
        break;
      case 'milliseconds':
        value = Math.floor(Math.random() * 2000) + 500;
        break;
    }
    
    data.push({
      date: date.toISOString().split('T')[0],
      value
    });
  }
  
  return data;
}