/**
 * VAPI Webhook Handler for Voice Matrix
 * Processes incoming webhooks from VAPI with call data:
 * - Call duration, transcript, summary, call status (as requested)
 * - Real-time analytics processing
 * - Business intelligence data collection
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const eventBridgeClient = new EventBridgeClient({ region: process.env.REGION });

// Environment variables
const CALL_LOGS_TABLE = process.env.CALL_LOGS_TABLE!;
const USER_ASSISTANTS_TABLE = process.env.USER_ASSISTANTS_TABLE!;
const TEMPLATE_ANALYTICS_TABLE = process.env.TEMPLATE_ANALYTICS_TABLE!;
const WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET || 'voice-matrix-webhook-secret';

// VAPI Webhook Event Types
enum VAPIEventType {
  CALL_START = 'call.started',
  CALL_END = 'call.ended',
  FUNCTION_CALL = 'function-call',
  TRANSFER = 'transfer',
  ESCALATION = 'escalation'
}

// Webhook payload interfaces
interface VAPICallStartedPayload {
  type: VAPIEventType.CALL_START;
  callId: string;
  assistantId: string;
  customer?: {
    number: string;
    name?: string;
  };
  timestamp: string;
  metadata?: Record<string, any>;
}

interface VAPICallEndedPayload {
  type: VAPIEventType.CALL_END;
  callId: string;
  assistantId: string;
  customer?: {
    number: string;
    name?: string;
  };
  call: {
    id: string;
    orgId: string;
    createdAt: string;
    updatedAt: string;
    type: 'inbound' | 'outbound';
    status: 'completed' | 'failed' | 'abandoned' | 'transferred';
    startedAt: string;
    endedAt: string;
    cost: number;
    costBreakdown: {
      model: number;
      voice: number;
      vapi: number;
      total: number;
    };
  };
  artifact?: {
    recordingUrl?: string;
    transcript: string;
    summary?: string;
    messagesOpenAIFormatted: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp?: string;
    }>;
  };
  analysis?: {
    summary: string;
    structuredData?: Record<string, any>;
    successEvaluation?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    sentimentScore?: number;
  };
  timestamp: string;
  metadata?: Record<string, any>;
}

interface VAPIFunctionCallPayload {
  type: VAPIEventType.FUNCTION_CALL;
  callId: string;
  assistantId: string;
  functionCall: {
    name: string;
    parameters: Record<string, any>;
    result?: any;
  };
  timestamp: string;
}

type VAPIWebhookPayload = VAPICallStartedPayload | VAPICallEndedPayload | VAPIFunctionCallPayload;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-VAPI-Signature',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('VAPI Webhook received:', JSON.stringify(event, null, 2));

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Verify webhook signature (security)
    const isValidSignature = await verifyWebhookSignature(event);
    if (!isValidSignature) {
      console.error('Invalid webhook signature');
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid signature' })
      };
    }

    // Parse webhook payload
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }

    const payload: VAPIWebhookPayload = JSON.parse(event.body);
    console.log('Processing VAPI webhook:', payload.type, payload.callId);

    // Route to appropriate handler based on event type
    switch (payload.type) {
      case VAPIEventType.CALL_START:
        return await handleCallStarted(payload as VAPICallStartedPayload);
      
      case VAPIEventType.CALL_END:
        return await handleCallEnded(payload as VAPICallEndedPayload);
      
      case VAPIEventType.FUNCTION_CALL:
        return await handleFunctionCall(payload as VAPIFunctionCallPayload);
      
      default:
        console.log('Unhandled webhook type:', (payload as any).type);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Webhook received but not processed',
            type: (payload as any).type 
          })
        };
    }

  } catch (error) {
    console.error('VAPI webhook processing error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Handles call started events
 */
async function handleCallStarted(payload: VAPICallStartedPayload): Promise<APIGatewayProxyResult> {
  console.log('Processing call started:', payload.callId);

  try {
    // Find the assistant by VAPI assistant ID
    const assistant = await findAssistantByVapiId(payload.assistantId);
    if (!assistant) {
      console.warn('Assistant not found for VAPI ID:', payload.assistantId);
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Assistant not found' })
      };
    }

    // Create initial call log entry
    const callLog = {
      callId: payload.callId,
      assistantId: assistant.assistantId,
      userId: assistant.userId,
      templateId: assistant.templateId,
      startTime: payload.timestamp,
      duration: 0, // Will be updated when call ends
      phoneNumber: payload.customer?.number,
      direction: 'inbound' as const, // Assuming inbound for now
      callStatus: 'in_progress' as const,
      transcript: '',
      summary: '',
      sentiment: 'neutral' as const,
      sentimentScore: 0,
      objectivesAchieved: [],
      responseTime: 0,
      interruptions: 0,
      escalationTriggered: false,
      conversationFlow: JSON.stringify({ started: payload.timestamp }),
      keywordsMentioned: [],
      topicsDiscussed: [],
      callQualityScore: 0,
      agentPerformance: 0,
      nextSteps: [],
      processedAt: new Date().toISOString(),
      processingVersion: '1.0.0',
      consentGiven: true, // Assuming consent for now
      yearMonth: new Date(payload.timestamp).toISOString().slice(0, 7),
      dayOfYear: Math.floor((new Date(payload.timestamp).getTime() - new Date(new Date(payload.timestamp).getFullYear(), 0, 0).getTime()) / 86400000),
      dataRetentionDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year retention
    };

    await docClient.send(new PutCommand({
      TableName: CALL_LOGS_TABLE,
      Item: callLog
    }));

    console.log('Call started recorded successfully:', payload.callId);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: 'Call started processed successfully',
        callId: payload.callId 
      })
    };

  } catch (error) {
    console.error('Error processing call started:', error);
    throw error;
  }
}

/**
 * Handles call ended events - THE CORE WEBHOOK USER REQUESTED
 * Processes: call duration, transcript, summary, call status
 */
async function handleCallEnded(payload: VAPICallEndedPayload): Promise<APIGatewayProxyResult> {
  console.log('Processing call ended:', payload.callId);
  console.log('Call data:', {
    duration: payload.call ? (new Date(payload.call.endedAt).getTime() - new Date(payload.call.startedAt).getTime()) / 1000 : 0,
    status: payload.call?.status,
    hasTranscript: !!payload.artifact?.transcript,
    hasSummary: !!payload.artifact?.summary || !!payload.analysis?.summary
  });

  try {
    // Find the assistant
    const assistant = await findAssistantByVapiId(payload.assistantId);
    if (!assistant) {
      console.warn('Assistant not found for VAPI ID:', payload.assistantId);
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Assistant not found' })
      };
    }

    // Calculate call duration in seconds
    const duration = payload.call ? 
      Math.round((new Date(payload.call.endedAt).getTime() - new Date(payload.call.startedAt).getTime()) / 1000) : 0;

    // Extract transcript and summary
    const transcript = payload.artifact?.transcript || '';
    const summary = payload.artifact?.summary || payload.analysis?.summary || '';
    const callStatus = payload.call?.status || 'completed';

    // Analyze conversation for business intelligence
    const analysis = await analyzeConversation(transcript, summary, assistant);

    // Update call log with complete data
    const callLogUpdate = {
      endTime: payload.timestamp,
      duration: duration,
      callStatus: callStatus,
      transcript: transcript,
      summary: summary,
      sentiment: payload.analysis?.sentiment || analysis.sentiment,
      sentimentScore: payload.analysis?.sentimentScore || analysis.sentimentScore,
      objectivesAchieved: analysis.objectivesAchieved,
      leadScore: analysis.leadScore,
      npsScore: analysis.npsScore,
      issuesIdentified: analysis.issuesIdentified,
      responseTime: analysis.averageResponseTime,
      interruptions: analysis.interruptions,
      escalationTriggered: analysis.escalationTriggered,
      escalationReason: analysis.escalationReason,
      conversationFlow: JSON.stringify(analysis.conversationFlow),
      keywordsMentioned: analysis.keywordsMentioned,
      topicsDiscussed: analysis.topicsDiscussed,
      callQualityScore: analysis.callQualityScore,
      customerSatisfaction: analysis.customerSatisfaction,
      agentPerformance: analysis.agentPerformance,
      nextSteps: analysis.nextSteps,
      followUpScheduled: analysis.followUpScheduled,
      recordingUrl: payload.artifact?.recordingUrl,
      processedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Update call log
    await docClient.send(new UpdateCommand({
      TableName: CALL_LOGS_TABLE,
      Key: { callId: payload.callId },
      UpdateExpression: `SET 
        endTime = :endTime,
        duration = :duration,
        callStatus = :callStatus,
        transcript = :transcript,
        summary = :summary,
        sentiment = :sentiment,
        sentimentScore = :sentimentScore,
        objectivesAchieved = :objectivesAchieved,
        leadScore = :leadScore,
        npsScore = :npsScore,
        issuesIdentified = :issuesIdentified,
        responseTime = :responseTime,
        interruptions = :interruptions,
        escalationTriggered = :escalationTriggered,
        escalationReason = :escalationReason,
        conversationFlow = :conversationFlow,
        keywordsMentioned = :keywordsMentioned,
        topicsDiscussed = :topicsDiscussed,
        callQualityScore = :callQualityScore,
        customerSatisfaction = :customerSatisfaction,
        agentPerformance = :agentPerformance,
        nextSteps = :nextSteps,
        followUpScheduled = :followUpScheduled,
        recordingUrl = :recordingUrl,
        processedAt = :processedAt,
        updatedAt = :updatedAt`,
      ExpressionAttributeValues: callLogUpdate
    }));

    // Update assistant statistics
    await updateAssistantStats(assistant.assistantId, {
      totalCalls: 1,
      successfulCalls: callStatus === 'completed' ? 1 : 0,
      averageCallDuration: duration,
      lastCallAt: payload.timestamp
    });

    // Update template analytics
    await updateTemplateAnalytics(assistant.templateId, {
      totalCalls: 1,
      successfulCalls: callStatus === 'completed' ? 1 : 0,
      averageCallDuration: duration,
      averageCallQuality: analysis.callQualityScore,
      objectivesAchieved: analysis.objectivesAchieved
    });

    // Publish analytics event for real-time processing
    await publishAnalyticsEvent({
      eventType: 'call_completed',
      callId: payload.callId,
      assistantId: assistant.assistantId,
      templateId: assistant.templateId,
      userId: assistant.userId,
      duration: duration,
      status: callStatus,
      qualityScore: analysis.callQualityScore,
      objectivesAchieved: analysis.objectivesAchieved,
      timestamp: payload.timestamp
    });

    console.log('Call ended processed successfully:', {
      callId: payload.callId,
      duration: duration,
      status: callStatus,
      qualityScore: analysis.callQualityScore
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: 'Call ended processed successfully',
        callId: payload.callId,
        duration: duration,
        status: callStatus,
        summary: summary.substring(0, 100) + '...' // Truncated for response
      })
    };

  } catch (error) {
    console.error('Error processing call ended:', error);
    throw error;
  }
}

/**
 * Handles function call events (escalations, etc.)
 */
async function handleFunctionCall(payload: VAPIFunctionCallPayload): Promise<APIGatewayProxyResult> {
  console.log('Processing function call:', payload.functionCall.name);

  try {
    // Handle escalation triggers
    if (payload.functionCall.name.startsWith('escalate_')) {
      await handleEscalation(payload);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: 'Function call processed',
        function: payload.functionCall.name
      })
    };

  } catch (error) {
    console.error('Error processing function call:', error);
    throw error;
  }
}

/**
 * Verifies webhook signature for security
 */
async function verifyWebhookSignature(event: APIGatewayProxyEvent): Promise<boolean> {
  // In production, implement proper HMAC signature verification
  // For now, check for presence of signature header
  const signature = event.headers['X-VAPI-Signature'] || event.headers['x-vapi-signature'];
  return !!signature || process.env.NODE_ENV === 'development';
}

/**
 * Finds assistant by VAPI assistant ID
 */
async function findAssistantByVapiId(vapiAssistantId: string): Promise<any> {
  // In production, implement GSI query
  // For now, simple approach - this should be optimized with a GSI
  const result = await docClient.send({
    TableName: USER_ASSISTANTS_TABLE,
    FilterExpression: 'vapiAssistantId = :vapiId',
    ExpressionAttributeValues: {
      ':vapiId': vapiAssistantId
    }
  } as any);

  return result.Items?.[0];
}

/**
 * Analyzes conversation for business intelligence
 */
async function analyzeConversation(transcript: string, summary: string, assistant: any): Promise<any> {
  // Advanced conversation analysis
  const analysis = {
    sentiment: 'neutral' as const,
    sentimentScore: 0,
    objectivesAchieved: [],
    leadScore: 0,
    npsScore: undefined,
    issuesIdentified: [],
    averageResponseTime: 0,
    interruptions: 0,
    escalationTriggered: false,
    escalationReason: undefined,
    conversationFlow: {},
    keywordsMentioned: [],
    topicsDiscussed: [],
    callQualityScore: 0,
    customerSatisfaction: undefined,
    agentPerformance: 0,
    nextSteps: [],
    followUpScheduled: undefined
  };

  if (!transcript || transcript.length === 0) {
    return analysis;
  }

  // Basic sentiment analysis
  const positiveWords = ['great', 'excellent', 'satisfied', 'happy', 'good', 'perfect', 'amazing'];
  const negativeWords = ['bad', 'terrible', 'unsatisfied', 'angry', 'frustrated', 'awful', 'horrible'];
  
  const transcriptLower = transcript.toLowerCase();
  const positiveCount = positiveWords.reduce((count, word) => count + (transcriptLower.includes(word) ? 1 : 0), 0);
  const negativeCount = negativeWords.reduce((count, word) => count + (transcriptLower.includes(word) ? 1 : 0), 0);

  if (positiveCount > negativeCount) {
    analysis.sentiment = 'positive';
    analysis.sentimentScore = Math.min(0.8, 0.5 + (positiveCount - negativeCount) * 0.1);
  } else if (negativeCount > positiveCount) {
    analysis.sentiment = 'negative';
    analysis.sentimentScore = Math.max(-0.8, -0.5 - (negativeCount - positiveCount) * 0.1);
  }

  // Analyze objectives based on template type
  if (assistant.templateId === 'lead-qualification-specialist') {
    if (transcriptLower.includes('budget') || transcriptLower.includes('price')) {
      analysis.objectivesAchieved.push('budget_discussed');
    }
    if (transcriptLower.includes('decision') || transcriptLower.includes('authority')) {
      analysis.objectivesAchieved.push('authority_identified');
    }
    if (transcriptLower.includes('need') || transcriptLower.includes('problem')) {
      analysis.objectivesAchieved.push('need_identified');
    }
    if (transcriptLower.includes('timeline') || transcriptLower.includes('when')) {
      analysis.objectivesAchieved.push('timeline_established');
    }
    
    analysis.leadScore = analysis.objectivesAchieved.length * 25; // BANT scoring
  }

  // Extract keywords and topics
  const words = transcript.toLowerCase().split(/\s+/);
  const businessKeywords = ['budget', 'timeline', 'decision', 'authority', 'need', 'problem', 'solution', 'price', 'cost'];
  analysis.keywordsMentioned = businessKeywords.filter(keyword => words.includes(keyword));

  // Calculate quality score
  analysis.callQualityScore = Math.min(5, Math.max(1, 
    3 + analysis.sentimentScore * 2 + (analysis.objectivesAchieved.length * 0.5)
  ));

  // Agent performance based on conversation quality
  analysis.agentPerformance = analysis.callQualityScore;

  // Determine next steps
  if (analysis.objectivesAchieved.length > 2) {
    analysis.nextSteps.push('schedule_follow_up');
  }
  if (transcriptLower.includes('interested') || transcriptLower.includes('want to know more')) {
    analysis.nextSteps.push('send_proposal');
  }

  return analysis;
}

/**
 * Updates assistant statistics
 */
async function updateAssistantStats(assistantId: string, stats: any): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: USER_ASSISTANTS_TABLE,
    Key: { assistantId },
    UpdateExpression: `ADD 
      totalCalls :totalCalls,
      successfulCalls :successfulCalls
      SET lastCallAt = :lastCallAt,
      updatedAt = :updatedAt`,
    ExpressionAttributeValues: {
      ':totalCalls': stats.totalCalls,
      ':successfulCalls': stats.successfulCalls,
      ':lastCallAt': stats.lastCallAt,
      ':updatedAt': new Date().toISOString()
    }
  }));
}

/**
 * Updates template analytics
 */
async function updateTemplateAnalytics(templateId: string, analytics: any): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const analyticsId = `${templateId}#${currentMonth}`;

  await docClient.send(new UpdateCommand({
    TableName: TEMPLATE_ANALYTICS_TABLE,
    Key: { analyticsId },
    UpdateExpression: `ADD 
      totalCalls :totalCalls,
      successfulCalls :successfulCalls
      SET computedAt = :computedAt`,
    ExpressionAttributeValues: {
      ':totalCalls': analytics.totalCalls,
      ':successfulCalls': analytics.successfulCalls,
      ':computedAt': new Date().toISOString()
    }
  }));
}

/**
 * Publishes analytics event for real-time processing
 */
async function publishAnalyticsEvent(event: any): Promise<void> {
  try {
    await eventBridgeClient.send(new PutEventsCommand({
      Entries: [
        {
          Source: 'voice-matrix.vapi-webhooks',
          DetailType: 'Call Analytics Event',
          Detail: JSON.stringify(event),
          EventBusName: 'default'
        }
      ]
    }));
  } catch (error) {
    console.warn('Failed to publish analytics event:', error);
    // Don't fail the webhook if analytics event fails
  }
}

/**
 * Handles escalation events
 */
async function handleEscalation(payload: VAPIFunctionCallPayload): Promise<void> {
  console.log('Processing escalation:', payload.functionCall.parameters);
  
  // Update call log to mark escalation
  await docClient.send(new UpdateCommand({
    TableName: CALL_LOGS_TABLE,
    Key: { callId: payload.callId },
    UpdateExpression: 'SET escalationTriggered = :true, escalationReason = :reason',
    ExpressionAttributeValues: {
      ':true': true,
      ':reason': payload.functionCall.parameters.reason || 'User requested escalation'
    }
  }));

  // In production, trigger actual escalation workflow (SMS, email, CRM integration)
}