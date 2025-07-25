import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const secretsClient = new SecretsManagerClient({ region: process.env.REGION });

const JWT_SECRET = process.env.JWT_SECRET || 'voice-matrix-secret-key';
const VAPI_CONFIG_TABLE = process.env.VAPI_CONFIG_TABLE!;
const VAPI_SECRET_NAME = process.env.VAPI_SECRET_NAME!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
};

interface VapiConfig {
  userId: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('VAPI handler called:', JSON.stringify(event, null, 2));

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
      case 'GET:assistants':
        return await handleGetAssistants(userId);
      case 'POST:assistants':
        return await handleCreateAssistant(userId, event);
      case 'PUT:assistants':
        return await handleUpdateAssistant(userId, event);
      case 'DELETE:assistants':
        return await handleDeleteAssistant(userId, event);
      case 'GET:account':
        return await handleGetAccount(userId);
      default:
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Endpoint not found' })
        };
    }
  } catch (error) {
    console.error('VAPI handler error:', error);
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

async function getVapiApiKey(userId: string): Promise<string | null> {
  try {
    // First try to get user-specific API key
    const result = await docClient.send(new GetCommand({
      TableName: VAPI_CONFIG_TABLE,
      Key: { userId }
    }));

    if (result.Item?.apiKey) {
      return result.Item.apiKey;
    }

    // Fallback to admin API key from Secrets Manager
    const secret = await secretsClient.send(new GetSecretValueCommand({
      SecretId: VAPI_SECRET_NAME
    }));

    if (secret.SecretString) {
      const secretData = JSON.parse(secret.SecretString);
      return secretData.apiKey;
    }

    return null;
  } catch (error) {
    console.error('Error getting VAPI API key:', error);
    return null;
  }
}

async function handleGetAssistants(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const apiKey = await getVapiApiKey(userId);
    if (!apiKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'VAPI API key not configured' })
      };
    }

    const response = await axios.get('https://api.vapi.ai/assistant', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response.data)
    };
  } catch (error: any) {
    console.error('Error getting assistants:', error);
    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.response?.data?.message || 'Failed to get assistants'
      })
    };
  }
}

async function handleCreateAssistant(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const apiKey = await getVapiApiKey(userId);
    if (!apiKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'VAPI API key not configured' })
      };
    }

    const assistantData = JSON.parse(event.body);

    const response = await axios.post('https://api.vapi.ai/assistant', assistantData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify(response.data)
    };
  } catch (error: any) {
    console.error('Error creating assistant:', error);
    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.response?.data?.message || 'Failed to create assistant'
      })
    };
  }
}

async function handleUpdateAssistant(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const apiKey = await getVapiApiKey(userId);
    if (!apiKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'VAPI API key not configured' })
      };
    }

    const { assistantId, ...updateData } = JSON.parse(event.body);

    if (!assistantId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Assistant ID is required' })
      };
    }

    const response = await axios.patch(`https://api.vapi.ai/assistant/${assistantId}`, updateData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response.data)
    };
  } catch (error: any) {
    console.error('Error updating assistant:', error);
    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.response?.data?.message || 'Failed to update assistant'
      })
    };
  }
}

async function handleDeleteAssistant(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const assistantId = event.queryStringParameters?.id;

  if (!assistantId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Assistant ID is required' })
    };
  }

  try {
    const apiKey = await getVapiApiKey(userId);
    if (!apiKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'VAPI API key not configured' })
      };
    }

    await axios.delete(`https://api.vapi.ai/assistant/${assistantId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  } catch (error: any) {
    console.error('Error deleting assistant:', error);
    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.response?.data?.message || 'Failed to delete assistant'
      })
    };
  }
}

async function handleGetAccount(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const apiKey = await getVapiApiKey(userId);
    if (!apiKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'VAPI API key not configured' })
      };
    }

    const response = await axios.get('https://api.vapi.ai/account', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(response.data)
    };
  } catch (error: any) {
    console.error('Error getting account:', error);
    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.response?.data?.message || 'Failed to get account'
      })
    };
  }
}