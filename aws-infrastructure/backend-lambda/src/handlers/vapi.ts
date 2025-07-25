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
      case 'GET:phone-numbers':
        return await handleGetPhoneNumbers(userId);
      case 'POST:phone-numbers':
        return await handleCreatePhoneNumber(userId, event);
      case 'GET:calls':
        return await handleGetCalls(userId, event);
      case 'POST:calls':
        return await handleCreateCall(userId, event);
      case 'GET:templates':
        return await handleGetTemplates(userId);
      case 'POST:webhook':
        return await handleWebhook(event);
      case 'POST:assistants/link-phone':
        return await handleLinkPhoneToAssistant(userId, event);
      case 'GET:account':
        return await handleGetAccount(userId);
      case 'POST:assistants/test':
        return await handleTestAssistant(userId, event);
      default:
        // Handle dynamic routes like /assistants/{id}
        if (path.startsWith('assistants/') && method === 'PUT') {
          return await handleUpdateSpecificAssistant(userId, event);
        }
        if (path.startsWith('assistants/') && method === 'DELETE') {
          return await handleDeleteSpecificAssistant(userId, event);
        }
        if (path.startsWith('assistants/') && path.includes('/link-phone') && method === 'POST') {
          return await handleLinkPhoneToSpecificAssistant(userId, event);
        }
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
      // Return empty array for demo purposes if no API key
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify([])
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
    // Return empty array on error for better UX
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify([])
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
    const assistantData = JSON.parse(event.body);

    if (!apiKey) {
      // Create demo assistant if no API key
      const demoAssistant = {
        id: `demo-${Date.now()}`,
        name: assistantData.name || 'Demo Assistant',
        model: assistantData.model || {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          messages: assistantData.model?.messages || [
            {
              role: 'system',
              content: 'You are a helpful AI assistant.'
            }
          ]
        },
        voice: assistantData.voice || {
          provider: 'azure',
          voiceId: 'andrew'
        },
        firstMessage: assistantData.firstMessage || 'Hello! How can I help you today?',
        recordingEnabled: assistantData.recordingEnabled || false,
        endCallMessage: assistantData.endCallMessage || 'Thank you for calling. Have a great day!',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(demoAssistant)
      };
    }

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

async function handleGetPhoneNumbers(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const apiKey = await getVapiApiKey(userId);
    if (!apiKey) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify([])
      };
    }

    const response = await axios.get('https://api.vapi.ai/phone-number', {
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
    console.error('Error getting phone numbers:', error);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify([])
    };
  }
}

async function handleCreatePhoneNumber(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const apiKey = await getVapiApiKey(userId);
    const phoneData = JSON.parse(event.body);

    if (!apiKey) {
      // Create demo phone number
      const demoPhone = {
        id: `demo-phone-${Date.now()}`,
        number: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
        assistantId: phoneData.assistantId,
        createdAt: new Date().toISOString()
      };

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(demoPhone)
      };
    }

    const response = await axios.post('https://api.vapi.ai/phone-number', phoneData, {
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
    console.error('Error creating phone number:', error);
    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.response?.data?.message || 'Failed to create phone number'
      })
    };
  }
}

async function handleGetCalls(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const apiKey = await getVapiApiKey(userId);
    if (!apiKey) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify([])
      };
    }

    // Get query parameters for pagination
    const { limit = '50', offset = '0' } = event.queryStringParameters || {};

    const response = await axios.get(`https://api.vapi.ai/call?limit=${limit}&offset=${offset}`, {
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
    console.error('Error getting calls:', error);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify([])
    };
  }
}

async function handleCreateCall(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const apiKey = await getVapiApiKey(userId);
    const callData = JSON.parse(event.body);

    if (!apiKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'VAPI API key required to make calls' })
      };
    }

    const response = await axios.post('https://api.vapi.ai/call', callData, {
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
    console.error('Error creating call:', error);
    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.response?.data?.message || 'Failed to create call'
      })
    };
  }
}

async function handleGetTemplates(userId: string): Promise<APIGatewayProxyResult> {
  try {
    // Return predefined templates for assistants
    const templates = [
      {
        id: 'customer-service',
        name: 'Customer Service',
        description: 'A helpful customer service assistant',
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful customer service representative. Be polite, professional, and aim to resolve customer issues efficiently.'
            }
          ]
        },
        voice: {
          provider: 'azure',
          voiceId: 'andrew'
        },
        firstMessage: 'Hello! Thank you for calling. How can I assist you today?'
      },
      {
        id: 'sales-assistant',
        name: 'Sales Assistant',
        description: 'A friendly sales assistant',
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a friendly sales assistant. Help customers understand our products and guide them through the sales process.'
            }
          ]
        },
        voice: {
          provider: 'azure',
          voiceId: 'jenny'
        },
        firstMessage: 'Hi there! I am here to help you find the perfect solution for your needs. What can I tell you about our products?'
      },
      {
        id: 'appointment-booking',
        name: 'Appointment Booking',
        description: 'An assistant for booking appointments',
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an appointment booking assistant. Help customers schedule appointments and provide available time slots.'
            }
          ]
        },
        voice: {
          provider: 'azure',
          voiceId: 'aria'
        },
        firstMessage: 'Hello! I can help you schedule an appointment. What date and time would work best for you?'
      }
    ];

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(templates)
    };
  } catch (error) {
    console.error('Error getting templates:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get templates' })
    };
  }
}

async function handleWebhook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const webhookData = JSON.parse(event.body || '{}');
    console.log('VAPI Webhook received:', webhookData);

    // Process webhook data (call events, transcripts, etc.)
    // In a real implementation, you would store this data and trigger appropriate actions

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ received: true })
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to process webhook' })
    };
  }
}

async function handleLinkPhoneToAssistant(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { assistantId, phoneNumberId } = JSON.parse(event.body);
    const apiKey = await getVapiApiKey(userId);

    if (!apiKey) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Phone linked to assistant (demo mode)',
          assistantId,
          phoneNumberId
        })
      };
    }

    // Update phone number with assistant
    const response = await axios.patch(`https://api.vapi.ai/phone-number/${phoneNumberId}`, {
      assistantId
    }, {
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
    console.error('Error linking phone to assistant:', error);
    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.response?.data?.message || 'Failed to link phone to assistant'
      })
    };
  }
}

async function handleUpdateSpecificAssistant(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParts = (event.pathParameters?.proxy || '').split('/');
  const assistantId = pathParts[1];

  if (!assistantId || !event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Assistant ID and request body are required' })
    };
  }

  try {
    const apiKey = await getVapiApiKey(userId);
    const updateData = JSON.parse(event.body);

    if (!apiKey) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          ...updateData,
          id: assistantId,
          updatedAt: new Date().toISOString()
        })
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

async function handleDeleteSpecificAssistant(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParts = (event.pathParameters?.proxy || '').split('/');
  const assistantId = pathParts[1];

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
        statusCode: 204,
        headers: corsHeaders,
        body: ''
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

async function handleLinkPhoneToSpecificAssistant(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParts = (event.pathParameters?.proxy || '').split('/');
  const assistantId = pathParts[1];

  if (!assistantId || !event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Assistant ID and request body are required' })
    };
  }

  try {
    const { phoneNumberId } = JSON.parse(event.body);
    const apiKey = await getVapiApiKey(userId);

    if (!apiKey) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Phone linked to assistant (demo mode)',
          assistantId,
          phoneNumberId
        })
      };
    }

    const response = await axios.patch(`https://api.vapi.ai/phone-number/${phoneNumberId}`, {
      assistantId
    }, {
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
    console.error('Error linking phone to assistant:', error);
    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.response?.data?.message || 'Failed to link phone to assistant'
      })
    };
  }
}

async function handleTestAssistant(userId: string, event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { assistantId, phoneNumber } = JSON.parse(event.body);
    const apiKey = await getVapiApiKey(userId);

    if (!apiKey) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          callId: `demo-call-${Date.now()}`,
          status: 'initiated',
          message: 'Test call initiated (demo mode)'
        })
      };
    }

    const response = await axios.post('https://api.vapi.ai/call', {
      assistantId,
      customer: {
        number: phoneNumber
      }
    }, {
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
    console.error('Error testing assistant:', error);
    return {
      statusCode: error.response?.status || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.response?.data?.message || 'Failed to test assistant'
      })
    };
  }
}

async function handleGetAccount(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const apiKey = await getVapiApiKey(userId);
    if (!apiKey) {
      // Return demo account data if no API key
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          id: 'demo-account',
          name: 'Demo Account',
          credits: 100,
          subscription: 'trial'
        })
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
    // Return demo data on error
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        id: 'demo-account',
        name: 'Demo Account',
        credits: 100,
        subscription: 'trial'
      })
    };
  }
}