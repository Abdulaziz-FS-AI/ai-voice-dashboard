import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
const USERS_TABLE = process.env.USERS_TABLE!;
const ASSISTANTS_TABLE = process.env.ASSISTANTS_TABLE!;
const PROMPT_TEMPLATES_TABLE = process.env.PROMPT_TEMPLATES_TABLE!;
const VAPI_SECRET_NAME = process.env.VAPI_SECRET_NAME!;

interface PromptSegment {
  id: string;
  type: 'original' | 'dynamic';
  label: string;
  content: string;
  editable: boolean;
  placeholder?: string;
  required?: boolean;
  validation?: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  segments: PromptSegment[];
  voiceDefaults: {
    provider: string;
    voiceId: string;
    speed: number;
    stability: number;
  };
  createdAt: string;
}

interface AssistantConfig {
  id: string;
  userId: string;
  name: string;
  templateId: string;
  dynamicSegments: Record<string, string>;
  assembledPrompt: string;
  voiceSettings: {
    provider: string;
    voiceId: string;
    speed: number;
    stability: number;
  };
  vapiAssistantId?: string;
  phoneNumber?: string;
  status: 'draft' | 'active' | 'paused' | 'error';
  createdAt: string;
  updatedAt: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Assistants handler called:', JSON.stringify(event, null, 2));

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
      case 'GET:templates':
        return await handleGetPromptTemplates();
      case 'GET:':
      case 'GET:list':
        return await handleGetUserAssistants(userId);
      case 'POST:create':
        return await handleCreateAssistant(event, userId);
      case 'PUT:update':
        return await handleUpdateAssistant(event, userId);
      case 'DELETE:delete':
        return await handleDeleteAssistant(event, userId);
      case 'POST:deploy':
        return await handleDeployAssistant(event, userId);
      case 'POST:test':
        return await handleTestAssistant(event, userId);
      default:
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Assistant endpoint not found' })
        };
    }
  } catch (error) {
    console.error('Assistants handler error:', error);
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

async function handleGetPromptTemplates(): Promise<APIGatewayProxyResult> {
  try {
    // For MVP, return predefined templates (in production, fetch from DynamoDB)
    const templates: PromptTemplate[] = [
      {
        id: 'customer-service',
        name: 'Customer Service Assistant',
        category: 'support',
        description: 'Professional customer service with call routing capabilities',
        segments: [
          {
            id: 'intro',
            type: 'original',
            label: 'Introduction',
            content: 'You are a professional AI customer service assistant. Your primary goal is to help customers efficiently and courteously.',
            editable: false
          },
          {
            id: 'company-name',
            type: 'dynamic',
            label: 'Company Name',
            content: '',
            editable: true,
            placeholder: 'Enter your company name',
            required: true,
            validation: 'min:2,max:50'
          },
          {
            id: 'business-hours',
            type: 'dynamic',
            label: 'Business Hours',
            content: '',
            editable: true,
            placeholder: 'e.g., Monday-Friday 9AM-5PM EST',
            required: true
          },
          {
            id: 'services-offered',
            type: 'dynamic',
            label: 'Services/Products',
            content: '',
            editable: true,
            placeholder: 'List your main services or products',
            required: true
          },
          {
            id: 'transfer-number',
            type: 'dynamic',
            label: 'Transfer Phone Number',
            content: '',
            editable: true,
            placeholder: 'Phone number for live agent transfer',
            required: false,
            validation: 'phone'
          },
          {
            id: 'instructions',
            type: 'original',
            label: 'Core Instructions',
            content: 'Always be polite and professional. If you cannot answer a question or if the customer requests to speak with a human, offer to transfer them to a live agent. Keep responses concise but helpful.',
            editable: false
          }
        ],
        voiceDefaults: {
          provider: 'elevenlabs',
          voiceId: 'ErXwobaYiN019PkySvjV',
          speed: 1.0,
          stability: 0.7
        },
        createdAt: new Date().toISOString()
      },
      {
        id: 'sales-assistant',
        name: 'Sales Assistant',
        category: 'sales',
        description: 'Lead qualification and sales support assistant',
        segments: [
          {
            id: 'intro',
            type: 'original',
            label: 'Introduction',
            content: 'You are an enthusiastic and knowledgeable sales assistant. Your goal is to understand customer needs and guide them toward the best solution.',
            editable: false
          },
          {
            id: 'company-name',
            type: 'dynamic',
            label: 'Company Name',
            content: '',
            editable: true,
            placeholder: 'Enter your company name',
            required: true
          },
          {
            id: 'products-services',
            type: 'dynamic',
            label: 'Products/Services',
            content: '',
            editable: true,
            placeholder: 'Describe your key offerings',
            required: true
          },
          {
            id: 'unique-value',
            type: 'dynamic',
            label: 'Unique Value Proposition',
            content: '',
            editable: true,
            placeholder: 'What makes your company different?',
            required: true
          },
          {
            id: 'pricing-approach',
            type: 'dynamic',
            label: 'Pricing Approach',
            content: '',
            editable: true,
            placeholder: 'How should pricing questions be handled?',
            required: false
          },
          {
            id: 'sales-process',
            type: 'original',
            label: 'Sales Process',
            content: 'Qualify leads by asking about their needs, timeline, and decision-making process. Always aim to schedule a follow-up call or meeting. Be helpful but not pushy.',
            editable: false
          }
        ],
        voiceDefaults: {
          provider: 'elevenlabs',
          voiceId: 'AZnzlk1XvdvUeBnXmlld',
          speed: 1.1,
          stability: 0.8
        },
        createdAt: new Date().toISOString()
      },
      {
        id: 'appointment-booking',
        name: 'Appointment Booking',
        category: 'scheduling',
        description: 'Schedule appointments and manage calendar integration',
        segments: [
          {
            id: 'intro',
            type: 'original',
            label: 'Introduction',
            content: 'You are a helpful appointment booking assistant. Your primary function is to help customers schedule appointments efficiently.',
            editable: false
          },
          {
            id: 'business-name',
            type: 'dynamic',
            label: 'Business Name',
            content: '',
            editable: true,
            placeholder: 'Enter your business name',
            required: true
          },
          {
            id: 'services-list',
            type: 'dynamic',
            label: 'Available Services',
            content: '',
            editable: true,
            placeholder: 'List services that can be booked',
            required: true
          },
          {
            id: 'availability',
            type: 'dynamic',
            label: 'General Availability',
            content: '',
            editable: true,
            placeholder: 'e.g., Monday-Friday 9AM-5PM, weekends by appointment',
            required: true
          },
          {
            id: 'booking-requirements',
            type: 'dynamic',
            label: 'Booking Requirements',
            content: '',
            editable: true,
            placeholder: 'What information do you need from customers?',
            required: false
          },
          {
            id: 'booking-process',
            type: 'original',
            label: 'Booking Process',
            content: 'Always confirm the service, preferred date/time, and contact information. If the requested time is not available, offer alternatives. Be clear about any preparation required.',
            editable: false
          }
        ],
        voiceDefaults: {
          provider: 'elevenlabs',
          voiceId: 'EXAVITQu4vr4xnSDxMaL',
          speed: 1.0,
          stability: 0.6
        },
        createdAt: new Date().toISOString()
      }
    ];

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        templates,
        total: templates.length
      })
    };
  } catch (error) {
    console.error('Error getting prompt templates:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get prompt templates' })
    };
  }
}

async function handleGetUserAssistants(userId: string): Promise<APIGatewayProxyResult> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: ASSISTANTS_TABLE,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ScanIndexForward: false // Most recent first
    }));

    const assistants = result.Items || [];

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        assistants,
        total: assistants.length
      })
    };
  } catch (error) {
    console.error('Error getting user assistants:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get assistants' })
    };
  }
}

async function handleCreateAssistant(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { name, templateId, dynamicSegments, voiceSettings } = JSON.parse(event.body);

    if (!name || !templateId || !dynamicSegments) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Name, templateId, and dynamicSegments are required' })
      };
    }

    // Get the prompt template
    const templates = await getPromptTemplates();
    const template = templates.find(t => t.id === templateId);
    
    if (!template) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Prompt template not found' })
      };
    }

    // Assemble the complete prompt
    const assembledPrompt = assemblePrompt(template, dynamicSegments);

    // Create assistant record
    const assistantId = uuidv4();
    const assistant: AssistantConfig = {
      id: assistantId,
      userId,
      name,
      templateId,
      dynamicSegments,
      assembledPrompt,
      voiceSettings: voiceSettings || template.voiceDefaults,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await docClient.send(new PutCommand({
      TableName: ASSISTANTS_TABLE,
      Item: {
        assistantId: assistantId, // DynamoDB expects assistantId as key
        ...assistant
      }
    }));

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        assistant,
        message: 'Assistant created successfully'
      })
    };
  } catch (error) {
    console.error('Error creating assistant:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to create assistant',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

async function handleDeployAssistant(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  try {
    const { assistantId } = JSON.parse(event.body);

    // Get assistant from database
    const result = await docClient.send(new GetCommand({
      TableName: ASSISTANTS_TABLE,
      Key: { assistantId: assistantId }
    }));

    const assistant = result.Item as AssistantConfig;
    if (!assistant || assistant.userId !== userId) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Assistant not found' })
      };
    }

    // Get VAPI API key
    const vapiApiKey = await getVapiApiKey();

    // Create assistant in VAPI
    const vapiResponse = await createVapiAssistant(assistant, vapiApiKey);

    // Update assistant with VAPI details
    await docClient.send(new UpdateCommand({
      TableName: ASSISTANTS_TABLE,
      Key: { assistantId: assistantId },
      UpdateExpression: 'SET vapiAssistantId = :vapiId, phoneNumber = :phone, #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':vapiId': vapiResponse.id,
        ':phone': vapiResponse.phoneNumber,
        ':status': 'active',
        ':updatedAt': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        assistant: {
          ...assistant,
          vapiAssistantId: vapiResponse.id,
          phoneNumber: vapiResponse.phoneNumber,
          status: 'active'
        },
        message: 'Assistant deployed successfully'
      })
    };
  } catch (error) {
    console.error('Error deploying assistant:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to deploy assistant',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

// Helper functions
async function getPromptTemplates(): Promise<PromptTemplate[]> {
  // Return the same templates as in handleGetPromptTemplates
  // In production, this would fetch from DynamoDB
  return [
    {
      id: 'customer-service',
      name: 'Customer Service Assistant',
      category: 'support',
      description: 'Professional customer service with call routing capabilities',
      segments: [
        {
          id: 'intro',
          type: 'original',
          label: 'Introduction',
          content: 'You are a professional AI customer service assistant. Your primary goal is to help customers efficiently and courteously.',
          editable: false
        },
        {
          id: 'company-name',
          type: 'dynamic',
          label: 'Company Name',
          content: '',
          editable: true,
          placeholder: 'Enter your company name',
          required: true,
          validation: 'min:2,max:50'
        },
        {
          id: 'business-hours',
          type: 'dynamic',
          label: 'Business Hours',
          content: '',
          editable: true,
          placeholder: 'e.g., Monday-Friday 9AM-5PM EST',
          required: true
        },
        {
          id: 'services-offered',
          type: 'dynamic',
          label: 'Services/Products',
          content: '',
          editable: true,
          placeholder: 'List your main services or products',
          required: true
        },
        {
          id: 'transfer-number',
          type: 'dynamic',
          label: 'Transfer Phone Number',
          content: '',
          editable: true,
          placeholder: 'Phone number to transfer calls to',
          required: false
        },
        {
          id: 'closing',
          type: 'original',
          label: 'Closing Instructions',
          content: 'Always be polite and professional. If you cannot answer a question or if the customer requests to speak with a human, offer to transfer them to a live agent. Keep responses concise but helpful.',
          editable: false
        }
      ],
      voiceDefaults: {
        provider: 'elevenlabs',
        voiceId: 'rachel',
        speed: 1.0,
        stability: 0.7
      },
      createdAt: new Date().toISOString()
    }
  ];
}

function assemblePrompt(template: PromptTemplate, dynamicSegments: Record<string, string>): string {
  return template.segments.map(segment => {
    if (segment.type === 'original') {
      return segment.content;
    } else {
      const value = dynamicSegments[segment.id];
      if (segment.required && !value) {
        throw new Error(`Required field '${segment.label}' is missing`);
      }
      return value || segment.placeholder || '';
    }
  }).filter(content => content.trim().length > 0).join('\n\n');
}

async function getVapiApiKey(): Promise<string> {
  try {
    const result = await secretsClient.send(new GetSecretValueCommand({
      SecretId: VAPI_SECRET_NAME
    }));
    
    if (result.SecretString) {
      const secretData = JSON.parse(result.SecretString);
      return secretData.apiKey || secretData.adminApiKey || '';
    }
    
    return process.env.ADMIN_VAPI_API_KEY || '';
  } catch (error) {
    console.warn('Could not retrieve VAPI API key from Secrets Manager, using env var:', error);
    return process.env.ADMIN_VAPI_API_KEY || '';
  }
}

async function createVapiAssistant(assistant: AssistantConfig, apiKey: string) {
  const vapiConfig = {
    name: assistant.name,
    model: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: assistant.assembledPrompt
        }
      ]
    },
    voice: {
      provider: assistant.voiceSettings.provider,
      voiceId: assistant.voiceSettings.voiceId,
      speed: assistant.voiceSettings.speed,
      stability: assistant.voiceSettings.stability
    },
    firstMessage: 'Hello! How can I help you today?',
    endCallMessage: 'Thank you for calling. Have a great day!',
    recordingEnabled: true,
    maxDurationSeconds: 600 // 10 minutes max
  };

  const response = await axios.post('https://api.vapi.ai/assistant', vapiConfig, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

async function handleUpdateAssistant(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  // Implementation for updating assistant
  return {
    statusCode: 501,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Update assistant not implemented yet' })
  };
}

async function handleDeleteAssistant(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  // Implementation for deleting assistant
  return {
    statusCode: 501,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Delete assistant not implemented yet' })
  };
}

async function handleTestAssistant(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
  // Implementation for testing assistant
  return {
    statusCode: 501,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Test assistant not implemented yet' })
  };
}