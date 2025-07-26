import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const secretsClient = new SecretsManagerClient({ region: process.env.REGION });

const JWT_SECRET = process.env.JWT_SECRET || 'voice-matrix-secret-key';
const PHONE_NUMBERS_TABLE = process.env.PHONE_NUMBERS_TABLE!;
const ASSISTANTS_TABLE = process.env.ASSISTANTS_TABLE!;
const VAPI_SECRET_NAME = process.env.VAPI_SECRET_NAME!;

interface PhoneNumber {
  id: string;
  userId: string;
  number: string;
  provider: 'vapi' | 'twilio' | 'custom';
  status: 'active' | 'inactive' | 'pending' | 'error';
  assignedAssistantId?: string;
  assignedAssistantName?: string;
  country: string;
  area: string;
  capabilities: string[]; // ['voice', 'sms', 'mms']
  monthlyPrice: number; // in cents
  vapiPhoneNumberId?: string;
  twilioSid?: string;
  forwardingNumber?: string;
  businessHours?: {
    enabled: boolean;
    timezone: string;
    hours: {
      monday: { start: string; end: string; enabled: boolean };
      tuesday: { start: string; end: string; enabled: boolean };
      wednesday: { start: string; end: string; enabled: boolean };
      thursday: { start: string; end: string; enabled: boolean };
      friday: { start: string; end: string; enabled: boolean };
      saturday: { start: string; end: string; enabled: boolean };
      sunday: { start: string; end: string; enabled: boolean };
    };
  };
  createdAt: string;
  updatedAt: string;
}

interface AvailableNumber {
  number: string;
  country: string;
  area: string;
  city?: string;
  price: number; // monthly price in cents
  capabilities: string[];
  provider: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Phone Numbers handler called:', JSON.stringify(event, null, 2));

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
      case 'GET:list':
        return await handleGetUserPhoneNumbers(userId);
      case 'GET:available':
        return await handleGetAvailableNumbers(event.queryStringParameters);
      case 'POST:provision':
        return await handleProvisionNumber(event, userId);
      case 'PUT:update':
        return await handleUpdatePhoneNumber(event, userId);
      case 'POST:assign':
        return await handleAssignToAssistant(event, userId);
      case 'POST:unassign':
        return await handleUnassignFromAssistant(event, userId);
      case 'DELETE:release':
        return await handleReleaseNumber(event, userId);
      case 'GET:usage':
        return await handleGetUsageStats(userId, event.queryStringParameters);
      default:
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Phone numbers endpoint not found' })
        };
    }
  } catch (error) {
    console.error('Phone Numbers handler error:', error);
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

async function handleGetUserPhoneNumbers(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: PHONE_NUMBERS_TABLE,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ScanIndexForward: false // Most recent first
    }));

    const phoneNumbers = result.Items as PhoneNumber[] || [];

    // Enrich with current usage stats
    const enrichedNumbers = await Promise.all(phoneNumbers.map(async (number) => {
      const usageStats = await getPhoneNumberUsage(number.id);
      return {
        ...number,
        usage: usageStats
      };
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        phoneNumbers: enrichedNumbers,
        total: enrichedNumbers.length,
        summary: {
          active: enrichedNumbers.filter(n => n.status === 'active').length,
          assigned: enrichedNumbers.filter(n => n.assignedAssistantId).length,
          monthlyCosting: enrichedNumbers.reduce((sum, n) => sum + (n.monthlyPrice || 0), 0)
        }
      })
    };
  } catch (error) {
    console.error('Error getting user phone numbers:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get phone numbers' })
    };
  }
}

async function handleGetAvailableNumbers(queryParams: any): Promise<APIGatewayProxyResult> {
  try {
    const country = queryParams?.country || 'US';
    const areaCode = queryParams?.areaCode;
    const city = queryParams?.city;
    const capabilities = queryParams?.capabilities?.split(',') || ['voice'];

    // For MVP, return mock available numbers
    const mockNumbers: AvailableNumber[] = [
      {
        number: '+1-555-0123',
        country: 'US',
        area: '555',
        city: 'New York',
        price: 100, // $1.00/month
        capabilities: ['voice', 'sms'],
        provider: 'vapi'
      },
      {
        number: '+1-555-0124',
        country: 'US',
        area: '555',
        city: 'New York',
        price: 100,
        capabilities: ['voice', 'sms'],
        provider: 'vapi'
      },
      {
        number: '+1-415-0123',
        country: 'US',
        area: '415',
        city: 'San Francisco',
        price: 120, // $1.20/month
        capabilities: ['voice', 'sms', 'mms'],
        provider: 'vapi'
      },
      {
        number: '+1-212-0123',
        country: 'US',
        area: '212',
        city: 'New York',
        price: 150, // $1.50/month (premium area code)
        capabilities: ['voice', 'sms'],
        provider: 'vapi'
      },
      {
        number: '+1-310-0123',
        country: 'US',
        area: '310',
        city: 'Los Angeles',
        price: 130,
        capabilities: ['voice', 'sms', 'mms'],
        provider: 'vapi'
      }
    ];

    // Filter based on search criteria
    let filteredNumbers = mockNumbers.filter(n => n.country === country);
    
    if (areaCode) {
      filteredNumbers = filteredNumbers.filter(n => n.area === areaCode);
    }
    
    if (city) {
      filteredNumbers = filteredNumbers.filter(n => 
        n.city?.toLowerCase().includes(city.toLowerCase())
      );
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        availableNumbers: filteredNumbers,
        total: filteredNumbers.length,
        searchCriteria: {
          country,
          areaCode,
          city,
          capabilities
        }
      })
    };
  } catch (error) {
    console.error('Error getting available numbers:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get available numbers' })
    };
  }
}

async function handleProvisionNumber(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { number, provider = 'vapi', forwardingNumber, businessHours } = JSON.parse(event.body);

    if (!number) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Phone number is required' })
      };
    }

    // Check if number is already provisioned
    const existingResult = await docClient.send(new QueryCommand({
      TableName: PHONE_NUMBERS_TABLE,
      IndexName: 'NumberIndex',
      KeyConditionExpression: '#number = :number',
      ExpressionAttributeNames: {
        '#number': 'number'
      },
      ExpressionAttributeValues: {
        ':number': number
      }
    }));

    if (existingResult.Items && existingResult.Items.length > 0) {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Phone number already provisioned' })
      };
    }

    // Provision number with VAPI
    const vapiApiKey = await getVapiApiKey();
    const vapiResponse = await provisionVapiNumber(number, vapiApiKey);

    // Create phone number record
    const phoneNumberId = uuidv4();
    const phoneNumber: PhoneNumber = {
      id: phoneNumberId,
      userId,
      number,
      provider,
      status: 'active',
      country: number.startsWith('+1') ? 'US' : 'Unknown',
      area: extractAreaCode(number),
      capabilities: ['voice'],
      monthlyPrice: 100, // Default $1.00/month
      vapiPhoneNumberId: vapiResponse.id,
      forwardingNumber,
      businessHours: businessHours || {
        enabled: false,
        timezone: 'America/New_York',
        hours: {
          monday: { start: '09:00', end: '17:00', enabled: true },
          tuesday: { start: '09:00', end: '17:00', enabled: true },
          wednesday: { start: '09:00', end: '17:00', enabled: true },
          thursday: { start: '09:00', end: '17:00', enabled: true },
          friday: { start: '09:00', end: '17:00', enabled: true },
          saturday: { start: '10:00', end: '16:00', enabled: false },
          sunday: { start: '10:00', end: '16:00', enabled: false }
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await docClient.send(new PutCommand({
      TableName: PHONE_NUMBERS_TABLE,
      Item: phoneNumber
    }));

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        phoneNumber,
        message: 'Phone number provisioned successfully'
      })
    };
  } catch (error) {
    console.error('Error provisioning phone number:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to provision phone number' })
    };
  }
}

async function handleAssignToAssistant(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { phoneNumberId, assistantId } = JSON.parse(event.body);

    if (!phoneNumberId || !assistantId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Phone number ID and assistant ID are required' })
      };
    }

    // Get phone number
    const phoneResult = await docClient.send(new GetCommand({
      TableName: PHONE_NUMBERS_TABLE,
      Key: { id: phoneNumberId }
    }));

    const phoneNumber = phoneResult.Item as PhoneNumber;
    if (!phoneNumber || phoneNumber.userId !== userId) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Phone number not found' })
      };
    }

    // Get assistant
    const assistantResult = await docClient.send(new GetCommand({
      TableName: ASSISTANTS_TABLE,
      Key: { id: assistantId }
    }));

    const assistant = assistantResult.Item;
    if (!assistant || assistant.userId !== userId) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Assistant not found' })
      };
    }

    // Update phone number assignment
    await docClient.send(new UpdateCommand({
      TableName: PHONE_NUMBERS_TABLE,
      Key: { id: phoneNumberId },
      UpdateExpression: 'SET assignedAssistantId = :assistantId, assignedAssistantName = :assistantName, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':assistantId': assistantId,
        ':assistantName': assistant.name,
        ':updatedAt': new Date().toISOString()
      }
    }));

    // Update assistant with phone number
    await docClient.send(new UpdateCommand({
      TableName: ASSISTANTS_TABLE,
      Key: { id: assistantId },
      UpdateExpression: 'SET phoneNumber = :phoneNumber, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':phoneNumber': phoneNumber.number,
        ':updatedAt': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: `Phone number ${phoneNumber.number} assigned to assistant ${assistant.name}`
      })
    };
  } catch (error) {
    console.error('Error assigning phone number to assistant:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to assign phone number' })
    };
  }
}

async function handleUpdatePhoneNumber(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { phoneNumberId, forwardingNumber, businessHours, status } = JSON.parse(event.body);

    if (!phoneNumberId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Phone number ID is required' })
      };
    }

    // Build update expression
    const updateExpressions = ['updatedAt = :updatedAt'];
    const expressionValues: any = {
      ':updatedAt': new Date().toISOString()
    };

    if (forwardingNumber !== undefined) {
      updateExpressions.push('forwardingNumber = :forwardingNumber');
      expressionValues[':forwardingNumber'] = forwardingNumber;
    }

    if (businessHours !== undefined) {
      updateExpressions.push('businessHours = :businessHours');
      expressionValues[':businessHours'] = businessHours;
    }

    if (status !== undefined) {
      updateExpressions.push('#status = :status');
      expressionValues[':status'] = status;
    }

    await docClient.send(new UpdateCommand({
      TableName: PHONE_NUMBERS_TABLE,
      Key: { id: phoneNumberId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: status !== undefined ? { '#status': 'status' } : undefined,
      ExpressionAttributeValues: expressionValues,
      ConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ...expressionValues,
        ':userId': userId
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Phone number updated successfully'
      })
    };
  } catch (error) {
    console.error('Error updating phone number:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update phone number' })
    };
  }
}

async function handleGetUsageStats(userId: string, queryParams: any): Promise<APIGatewayProxyResult> {
  try {
    const timeframe = queryParams?.timeframe || '30d';
    const phoneNumberId = queryParams?.phoneNumberId;

    // Mock usage statistics
    const usageStats = {
      totalMinutes: Math.floor(Math.random() * 5000) + 1000,
      totalCalls: Math.floor(Math.random() * 500) + 100,
      totalCost: Math.floor(Math.random() * 10000) + 2000, // cents
      averageCallDuration: Math.floor(Math.random() * 300) + 120, // seconds
      peakUsageDays: [
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          minutes: Math.floor(Math.random() * 200) + 50,
          calls: Math.floor(Math.random() * 30) + 10
        },
        {
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          minutes: Math.floor(Math.random() * 180) + 40,
          calls: Math.floor(Math.random() * 25) + 8
        }
      ],
      byPhoneNumber: phoneNumberId ? null : [
        {
          phoneNumberId: 'phone-1',
          number: '+1-555-0123',
          minutes: Math.floor(Math.random() * 1000) + 200,
          calls: Math.floor(Math.random() * 100) + 20,
          cost: Math.floor(Math.random() * 2000) + 400
        },
        {
          phoneNumberId: 'phone-2',
          number: '+1-415-0123',
          minutes: Math.floor(Math.random() * 800) + 150,
          calls: Math.floor(Math.random() * 80) + 15,
          cost: Math.floor(Math.random() * 1500) + 300
        }
      ]
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        usage: usageStats,
        timeframe,
        phoneNumberId
      })
    };
  } catch (error) {
    console.error('Error getting usage stats:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get usage stats' })
    };
  }
}

// Helper functions
async function getVapiApiKey(): Promise<string> {
  try {
    const result = await secretsClient.send(new GetSecretValueCommand({
      SecretId: VAPI_SECRET_NAME
    }));
    
    return result.SecretString || process.env.ADMIN_VAPI_API_KEY || '';
  } catch (error) {
    console.warn('Could not retrieve VAPI API key from Secrets Manager, using env var');
    return process.env.ADMIN_VAPI_API_KEY || '';
  }
}

async function provisionVapiNumber(number: string, apiKey: string) {
  // Mock VAPI response for MVP
  return {
    id: `vapi-phone-${uuidv4()}`,
    number,
    status: 'active',
    capabilities: ['voice']
  };
}

async function getPhoneNumberUsage(phoneNumberId: string) {
  // Mock usage data for MVP
  return {
    callsToday: Math.floor(Math.random() * 20),
    callsThisWeek: Math.floor(Math.random() * 100) + 20,
    callsThisMonth: Math.floor(Math.random() * 300) + 80,
    minutesToday: Math.floor(Math.random() * 200) + 10,
    minutesThisMonth: Math.floor(Math.random() * 2000) + 200,
    lastCall: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString()
  };
}

function extractAreaCode(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, '');
  if (cleaned.length >= 10) {
    return cleaned.substring(cleaned.length - 10, cleaned.length - 7);
  }
  return '';
}

async function handleUnassignFromAssistant(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  // Implementation for unassigning phone number from assistant
  return {
    statusCode: 501,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Unassign from assistant not implemented yet' })
  };
}

async function handleReleaseNumber(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  // Implementation for releasing phone number
  return {
    statusCode: 501,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Release number not implemented yet' })
  };
}