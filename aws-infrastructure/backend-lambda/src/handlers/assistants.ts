import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { 
  EnhancedPromptTemplate, 
  TemplateCreationRequest,
  TemplateSearchFilters 
} from '../types/enhanced-templates';
import { createTemplateManagementService } from '../services/template-management';
import { STRATEGIC_TEMPLATES } from '../templates/strategic-templates';
import { STRATEGIC_TEMPLATES_CONTINUED } from '../templates/strategic-templates-continued';

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
const PROMPT_TEMPLATES_TABLE = process.env.PROMPT_TEMPLATES_TABLE || 'VoiceMatrix-PromptTemplates';
const TEMPLATE_ANALYTICS_TABLE = process.env.TEMPLATE_ANALYTICS_TABLE || 'VoiceMatrix-TemplateAnalytics';
const VAPI_SECRET_NAME = process.env.VAPI_SECRET_NAME!;

// Initialize template management service
const templateService = createTemplateManagementService(
  docClient,
  PROMPT_TEMPLATES_TABLE,
  TEMPLATE_ANALYTICS_TABLE
);

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
      case 'POST:templates/search':
        return await handleSearchTemplates(event);
      case 'GET:templates/popular':
        return await handleGetPopularTemplates();
      case 'POST:templates/validate':
        return await handleValidateTemplate(event);
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
    console.log('Getting prompt templates using enhanced system');
    
    // Get strategic templates (predefined enhanced templates)
    const strategicTemplates = [...STRATEGIC_TEMPLATES, ...STRATEGIC_TEMPLATES_CONTINUED];
    
    // Try to get templates from database first, fall back to strategic templates
    let templates;
    try {
      templates = await templateService.getActiveTemplates();
      console.log(`Retrieved ${templates.length} templates from database`);
      
      // If no templates in database, use strategic templates
      if (templates.length === 0) {
        console.log('No templates in database, using strategic templates');
        templates = strategicTemplates.map(template => ({
          templateId: template.id,
          name: template.name,
          version: template.version,
          status: template.status,
          templateType: 'predefined' as const,
          category: template.category.primary,
          industry: template.industry,
          complexity: template.complexity,
          templateData: JSON.stringify(template),
          usageCount: template.metadata.usage.timesUsed,
          averageRating: template.metadata.usage.averageRating,
          lastUsed: template.metadata.usage.lastUsed,
          createdAt: template.metadata.createdAt,
          updatedAt: template.metadata.updatedAt,
          createdBy: template.metadata.createdBy,
          tags: template.metadata.tags,
          keywords: template.documentation.description.toLowerCase(),
          isLatestVersion: true,
          visibility: 'public' as const
        }));
      }
    } catch (dbError) {
      console.warn('Database error, falling back to strategic templates:', dbError);
      templates = strategicTemplates.map(template => ({
        templateId: template.id,
        name: template.name,
        version: template.version,
        status: template.status,
        templateType: 'predefined' as const,
        category: template.category.primary,
        industry: template.industry,
        complexity: template.complexity,
        templateData: JSON.stringify(template),
        usageCount: template.metadata.usage.timesUsed,
        averageRating: template.metadata.usage.averageRating,
        lastUsed: template.metadata.usage.lastUsed,
        createdAt: template.metadata.createdAt,
        updatedAt: template.metadata.updatedAt,
        createdBy: template.metadata.createdBy,
        tags: template.metadata.tags,
        keywords: template.documentation.description.toLowerCase(),
        isLatestVersion: true,
        visibility: 'public' as const
      }));
    }

    // Transform for frontend compatibility
    const frontendTemplates = templates.map(template => {
      let templateData: EnhancedPromptTemplate;
      try {
        templateData = JSON.parse(template.templateData);
      } catch (parseError) {
        console.error('Error parsing template data:', parseError);
        // Return a basic template structure if parsing fails
        return {
          id: template.templateId,
          name: template.name,
          category: template.category,
          description: 'Enhanced template - see documentation',
          complexity: template.complexity,
          industry: template.industry,
          segments: [],
          voiceDefaults: {
            provider: 'elevenlabs',
            voiceId: 'ErXwobaYiN019PkySvjV',
            speed: 1.0,
            stability: 0.7
          },
          createdAt: template.createdAt,
          usageCount: template.usageCount,
          averageRating: template.averageRating
        };
      }

      return {
        id: template.templateId,
        name: template.name,
        category: template.category,
        description: templateData.documentation?.description || 'Enhanced business template',
        complexity: template.complexity,
        industry: template.industry,
        businessObjectives: templateData.businessObjectives?.map(obj => obj.name) || [],
        useCase: templateData.useCase?.title || '',
        estimatedSetupTime: templateData.userExperience?.estimatedSetupTime || 10,
        segments: templateData.segments?.map(segment => ({
          id: segment.id,
          type: segment.editable ? 'dynamic' : 'original',
          label: segment.label,
          content: segment.content,
          editable: segment.editable,
          placeholder: segment.placeholder,
          required: segment.validation?.type === 'required',
          helpText: segment.helpText,
          businessPurpose: segment.businessPurpose
        })) || [],
        voiceDefaults: {
          provider: templateData.vapiConfiguration?.voice?.provider || 'elevenlabs',
          voiceId: templateData.vapiConfiguration?.voice?.voiceId || 'ErXwobaYiN019PkySvjV',
          speed: templateData.vapiConfiguration?.voice?.speed || 1.0,
          stability: templateData.vapiConfiguration?.voice?.stability || 0.7
        },
        createdAt: template.createdAt,
        usageCount: template.usageCount,
        averageRating: template.averageRating,
        tags: template.tags
      };
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        templates: frontendTemplates,
        total: frontendTemplates.length,
        enhanced: true
      })
    };
  } catch (error) {
    console.error('Error getting prompt templates:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to get prompt templates',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
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
    console.log('Creating assistant with enhanced template system:', { name, templateId, userId });

    if (!name || !templateId || !dynamicSegments) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Name, templateId, and dynamicSegments are required' })
      };
    }

    // Get the enhanced template
    let template;
    try {
      const dbTemplate = await templateService.getTemplate(templateId);
      template = JSON.parse(dbTemplate.templateData) as EnhancedPromptTemplate;
      console.log('Retrieved enhanced template from database:', template.name);
    } catch (dbError) {
      console.warn('Template not found in database, checking strategic templates:', dbError);
      // Fall back to strategic templates
      const strategicTemplates = [...STRATEGIC_TEMPLATES, ...STRATEGIC_TEMPLATES_CONTINUED];
      template = strategicTemplates.find(t => t.id === templateId);
      
      if (!template) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Prompt template not found' })
        };
      }
      console.log('Using strategic template:', template.name);
    }

    // Assemble the complete prompt using enhanced template structure
    const assembledPrompt = assembleEnhancedPrompt(template, dynamicSegments);

    // Create enhanced assistant record
    const assistantId = uuidv4();
    const assistant: AssistantConfig = {
      id: assistantId,
      userId,
      name,
      templateId,
      dynamicSegments,
      assembledPrompt,
      voiceSettings: voiceSettings || {
        provider: template.vapiConfiguration.voice.provider,
        voiceId: template.vapiConfiguration.voice.voiceId,
        speed: template.vapiConfiguration.voice.speed,
        stability: template.vapiConfiguration.voice.stability
      },
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await docClient.send(new PutCommand({
      TableName: ASSISTANTS_TABLE,
      Item: {
        assistantId: assistantId,
        ...assistant,
        // Add enhanced fields
        templateVersion: template.version,
        businessObjectives: JSON.stringify(template.businessObjectives),
        industry: template.industry,
        complexity: template.complexity
      }
    }));

    console.log('Enhanced assistant created successfully:', assistantId);

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        assistant: {
          ...assistant,
          templateVersion: template.version,
          businessObjectives: template.businessObjectives,
          industry: template.industry,
          complexity: template.complexity
        },
        message: 'Enhanced assistant created successfully'
      })
    };
  } catch (error) {
    console.error('Error creating enhanced assistant:', error);
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
    console.log('Deploying assistant:', assistantId, 'for user:', userId);

    // Get assistant from database
    const result = await docClient.send(new GetCommand({
      TableName: ASSISTANTS_TABLE,
      Key: { assistantId: assistantId }
    }));

    const assistant = result.Item as AssistantConfig;
    if (!assistant || assistant.userId !== userId) {
      console.error('Assistant not found or unauthorized:', { assistantId, userId, found: !!assistant });
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Assistant not found' })
      };
    }

    console.log('Found assistant for deployment:', {
      id: assistant.id,
      name: assistant.name,
      status: assistant.status
    });

    // Get VAPI API key
    const vapiApiKey = await getVapiApiKey();
    if (!vapiApiKey) {
      console.error('No VAPI API key available');
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'VAPI API key not configured',
          details: 'Please configure VAPI API key in environment variables or AWS Secrets Manager'
        })
      };
    }

    console.log('VAPI API key retrieved, length:', vapiApiKey.length);

    // Get enhanced template for VAPI configuration
    let enhancedTemplate;
    try {
      const dbTemplate = await templateService.getTemplate(assistant.templateId);
      enhancedTemplate = JSON.parse(dbTemplate.templateData) as EnhancedPromptTemplate;
      console.log('Using enhanced template for VAPI deployment:', enhancedTemplate.name);
    } catch (templateError) {
      console.warn('Could not load enhanced template, using fallback config:', templateError);
      // Try strategic templates as fallback
      const strategicTemplates = [...STRATEGIC_TEMPLATES, ...STRATEGIC_TEMPLATES_CONTINUED];
      enhancedTemplate = strategicTemplates.find(t => t.id === assistant.templateId);
    }

    // Create assistant in VAPI with enhanced configuration
    const vapiResponse = await createVapiAssistant(assistant, vapiApiKey, enhancedTemplate);
    console.log('VAPI enhanced assistant created successfully:', vapiResponse.id);

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
        ':phone': vapiResponse.phoneNumber || 'pending',
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
          phoneNumber: vapiResponse.phoneNumber || 'pending',
          status: 'active'
        },
        message: 'Assistant deployed successfully to VAPI'
      })
    };
  } catch (error) {
    console.error('Error deploying assistant:', error);
    
    // Check if it's a VAPI-specific error
    if (error.message?.includes('VAPI')) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'VAPI deployment failed',
          details: error.message,
          suggestion: 'Please check your VAPI API key and try again'
        })
      };
    }
    
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

function assembleEnhancedPrompt(template: EnhancedPromptTemplate, dynamicSegments: Record<string, string>): string {
  console.log('Assembling enhanced prompt for template:', template.name);
  
  const assembledSegments = template.segments.map(segment => {
    if (!segment.editable) {
      // Non-editable segments use their content directly
      return segment.content;
    } else {
      // Dynamic segments use user input or fallback to placeholder
      const value = dynamicSegments[segment.id];
      if (segment.validation?.type === 'required' && !value) {
        throw new Error(`Required field '${segment.label}' is missing`);
      }
      return value || segment.placeholder || segment.content || '';
    }
  }).filter(content => content && content.trim().length > 0);

  // Add business context to the prompt
  const businessContext = template.businessObjectives
    .map(obj => `Objective: ${obj.name} - ${obj.description}`)
    .join('\n');

  // Include conversation objectives and industry context
  const contextualInfo = [
    `Industry: ${template.industry.join(', ')}`,
    `Use Case: ${template.useCase.title}`,
    `Business Objectives:\n${businessContext}`,
    `Expected Outcomes: ${template.useCase.expectedOutcomes.join(', ')}`
  ].join('\n\n');

  // Combine everything into a comprehensive prompt
  const fullPrompt = [
    contextualInfo,
    '--- CONVERSATION GUIDELINES ---',
    ...assembledSegments,
    '--- PERFORMANCE EXPECTATIONS ---',
    `Target Call Duration: ${template.useCase.avgCallDuration} seconds`,
    `Success Rate Target: ${template.useCase.successRate}%`,
    template.vapiConfiguration.conversationSettings.firstMessage ? 
      `Opening Message: ${template.vapiConfiguration.conversationSettings.firstMessage}` : '',
    template.vapiConfiguration.conversationSettings.endCallMessage ? 
      `Closing Message: ${template.vapiConfiguration.conversationSettings.endCallMessage}` : ''
  ].filter(content => content && content.trim().length > 0).join('\n\n');

  console.log('Enhanced prompt assembled, length:', fullPrompt.length);
  return fullPrompt;
}

async function getVapiApiKey(): Promise<string> {
  console.log('Getting VAPI API key, secret name:', VAPI_SECRET_NAME);
  console.log('Environment variables available:', {
    ADMIN_VAPI_API_KEY: !!process.env.ADMIN_VAPI_API_KEY,
    VAPI_API_KEY: !!process.env.VAPI_API_KEY
  });
  
  try {
    const result = await secretsClient.send(new GetSecretValueCommand({
      SecretId: VAPI_SECRET_NAME
    }));
    
    console.log('Secrets Manager response:', {
      hasSecretString: !!result.SecretString,
      arn: result.ARN
    });
    
    if (result.SecretString) {
      const secretData = JSON.parse(result.SecretString);
      console.log('Secret data keys:', Object.keys(secretData));
      const apiKey = secretData.apiKey || secretData.adminApiKey || '';
      console.log('Retrieved API key length:', apiKey.length);
      return apiKey;
    }
    
    console.log('No secret string found, falling back to env vars');
    return process.env.ADMIN_VAPI_API_KEY || process.env.VAPI_API_KEY || '';
  } catch (error) {
    console.error('Error retrieving VAPI API key from Secrets Manager:', error);
    console.log('Falling back to environment variables');
    return process.env.ADMIN_VAPI_API_KEY || process.env.VAPI_API_KEY || '';
  }
}

async function createVapiAssistant(assistant: AssistantConfig, apiKey: string, enhancedTemplate?: EnhancedPromptTemplate) {
  console.log('Creating VAPI assistant with enhanced config:', {
    name: assistant.name,
    apiKeyPresent: !!apiKey,
    voiceSettings: assistant.voiceSettings,
    hasEnhancedTemplate: !!enhancedTemplate
  });

  // Build VAPI configuration using enhanced template if available
  let vapiConfig;
  
  if (enhancedTemplate?.vapiConfiguration) {
    console.log('Using enhanced VAPI configuration from template');
    const enhancedConfig = enhancedTemplate.vapiConfiguration;
    
    vapiConfig = {
      name: assistant.name,
      model: {
        provider: enhancedConfig.model.provider,
        model: enhancedConfig.model.modelName,
        messages: [
          {
            role: 'system',
            content: assistant.assembledPrompt
          }
        ],
        maxTokens: enhancedConfig.model.maxTokens,
        temperature: enhancedConfig.model.temperature
      },
      voice: {
        provider: enhancedConfig.voice.provider,
        voiceId: enhancedConfig.voice.voiceId,
        model: enhancedConfig.voice.provider === 'elevenlabs' ? 'eleven_turbo_v2' : undefined,
        stability: enhancedConfig.voice.stability,
        similarityBoost: enhancedConfig.voice.clarity,
        style: enhancedConfig.voice.style,
        useSpeakerBoost: enhancedConfig.voice.useSpeakerBoost
      },
      firstMessage: enhancedConfig.conversationSettings.firstMessage,
      endCallMessage: enhancedConfig.conversationSettings.endCallMessage,
      transferMessage: enhancedConfig.conversationSettings.transferMessage,
      recordingEnabled: enhancedConfig.conversationSettings.recordingEnabled,
      maxDurationSeconds: enhancedConfig.conversationSettings.maxDurationSeconds,
      silenceTimeoutSeconds: enhancedConfig.conversationSettings.silenceTimeoutSeconds,
      responseDelaySeconds: enhancedConfig.conversationSettings.responseDelaySeconds,
      numWordsToInterruptAssistant: enhancedConfig.conversationSettings.numWordsToInterruptAssistant
    };

    // Add webhook configuration if present
    if (enhancedConfig.webhookSettings?.url) {
      vapiConfig.serverUrl = enhancedConfig.webhookSettings.url;
      vapiConfig.serverUrlSecret = 'webhook-secret'; // Should be from environment
    }

    // Add escalation triggers as functions (simplified)
    if (enhancedConfig.businessRules?.escalationTriggers) {
      vapiConfig.functions = enhancedConfig.businessRules.escalationTriggers.map(trigger => ({
        name: `escalate_${trigger.trigger}`,
        description: `Escalate call when ${trigger.condition}`,
        parameters: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Reason for escalation' }
          }
        }
      }));
    }
  } else {
    console.log('Using fallback VAPI configuration');
    // Fallback to basic configuration
    vapiConfig = {
      name: assistant.name,
      model: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: assistant.assembledPrompt
          }
        ],
        maxTokens: 250,
        temperature: 0.7
      },
      voice: {
        provider: 'elevenlabs',
        voiceId: assistant.voiceSettings.voiceId || 'ErXwobaYiN019PkySvjV',
        model: 'eleven_turbo_v2',
        stability: assistant.voiceSettings.stability || 0.5,
        similarityBoost: 0.75,
        style: 0.0,
        useSpeakerBoost: true
      },
      firstMessage: 'Hello! How can I help you today?',
      endCallMessage: 'Thank you for calling. Have a great day!',
      recordingEnabled: true,
      maxDurationSeconds: 600,
      silenceTimeoutSeconds: 30,
      responseDelaySeconds: 0.4,
      numWordsToInterruptAssistant: 2
    };
  }

  console.log('Sending enhanced request to VAPI:', JSON.stringify(vapiConfig, null, 2));

  try {
    const response = await axios.post('https://api.vapi.ai/assistant', vapiConfig, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('VAPI enhanced assistant created:', response.status, response.data);
    return response.data;
  } catch (error) {
    console.error('VAPI Enhanced API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      configSent: vapiConfig,
      message: error.message
    });
    
    if (error.response?.status === 401) {
      throw new Error('VAPI API authentication failed. Please check your API key.');
    } else if (error.response?.status === 400) {
      throw new Error(`VAPI API validation error: ${JSON.stringify(error.response.data)}`);
    } else if (error.response?.status === 429) {
      throw new Error('VAPI API rate limit exceeded. Please try again later.');
    } else {
      throw new Error(`VAPI Enhanced API error: ${error.message}`);
    }
  }
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

async function handleSearchTemplates(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { filters = {}, page = 1, limit = 20 } = body;

    console.log('Searching templates with filters:', filters);

    const searchResult = await templateService.searchTemplates(filters, page, limit);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: searchResult,
        pagination: {
          page: searchResult.page,
          limit: searchResult.limit,
          total: searchResult.total,
          pages: Math.ceil(searchResult.total / searchResult.limit)
        }
      })
    };
  } catch (error) {
    console.error('Error searching templates:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to search templates',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

async function handleGetPopularTemplates(): Promise<APIGatewayProxyResult> {
  try {
    const popularTemplates = await templateService.getPopularTemplates(10);

    const formattedTemplates = popularTemplates.map(template => {
      let templateData: EnhancedPromptTemplate;
      try {
        templateData = JSON.parse(template.templateData);
      } catch (parseError) {
        // Return basic info if parsing fails
        return {
          id: template.templateId,
          name: template.name,
          category: template.category,
          description: 'Popular template',
          usageCount: template.usageCount,
          averageRating: template.averageRating
        };
      }

      return {
        id: template.templateId,
        name: template.name,
        category: template.category,
        description: templateData.documentation?.description || 'Popular business template',
        complexity: template.complexity,
        industry: template.industry,
        usageCount: template.usageCount,
        averageRating: template.averageRating,
        tags: template.tags,
        businessObjectives: templateData.businessObjectives?.map(obj => obj.name) || []
      };
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        templates: formattedTemplates,
        total: formattedTemplates.length
      })
    };
  } catch (error) {
    console.error('Error getting popular templates:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to get popular templates',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

async function handleValidateTemplate(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Template data is required' })
      };
    }

    const templateData = JSON.parse(event.body) as EnhancedPromptTemplate;
    console.log('Validating template:', templateData.name);

    const validation = await templateService.validateTemplate(templateData);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        validation,
        isValid: validation.isValid,
        score: validation.score.overall,
        recommendations: validation.suggestions.filter(s => s.expectedImpact === 'high')
      })
    };
  } catch (error) {
    console.error('Error validating template:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to validate template',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}