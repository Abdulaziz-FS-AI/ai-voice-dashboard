/**
 * Real-time Analytics Processor for Voice Matrix
 * Processes EventBridge events from VAPI webhooks and updates analytics in real-time
 */

import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const snsClient = new SNSClient({ region: process.env.REGION });

// Environment variables
const TEMPLATE_ANALYTICS_TABLE = process.env.TEMPLATE_ANALYTICS_TABLE!;
const USER_ASSISTANTS_TABLE = process.env.USER_ASSISTANTS_TABLE!;
const CALL_LOGS_TABLE = process.env.CALL_LOGS_TABLE!;
const ANALYTICS_ALERTS_TOPIC = process.env.ANALYTICS_ALERTS_TOPIC;

// Event interfaces
interface CallAnalyticsEvent {
  eventType: 'call_completed' | 'call_started' | 'call_failed' | 'escalation_triggered';
  callId: string;
  assistantId: string;
  templateId: string;
  userId: string;
  duration?: number;
  status: string;
  qualityScore?: number;
  objectivesAchieved?: string[];
  timestamp: string;
  metadata?: Record<string, any>;
}

interface TemplateUsageEvent {
  eventType: 'template_used' | 'template_viewed' | 'template_rated';
  templateId: string;
  userId: string;
  rating?: number;
  timestamp: string;
}

interface AssistantPerformanceEvent {
  eventType: 'assistant_created' | 'assistant_deployed' | 'assistant_performance_update';
  assistantId: string;
  templateId: string;
  userId: string;
  performanceMetrics?: Record<string, number>;
  timestamp: string;
}

type AnalyticsEvent = CallAnalyticsEvent | TemplateUsageEvent | AssistantPerformanceEvent;

export const handler = async (event: EventBridgeEvent<string, AnalyticsEvent>): Promise<void> => {
  console.log('Processing analytics event:', JSON.stringify(event, null, 2));

  try {
    const eventData = event.detail;
    
    // Route to appropriate processor based on event type
    switch (eventData.eventType) {
      case 'call_completed':
        await processCallCompleted(eventData as CallAnalyticsEvent);
        break;
      
      case 'call_started':
        await processCallStarted(eventData as CallAnalyticsEvent);
        break;
      
      case 'call_failed':
        await processCallFailed(eventData as CallAnalyticsEvent);
        break;
      
      case 'escalation_triggered':
        await processEscalationTriggered(eventData as CallAnalyticsEvent);
        break;
      
      case 'template_used':
        await processTemplateUsed(eventData as TemplateUsageEvent);
        break;
      
      case 'template_viewed':
        await processTemplateViewed(eventData as TemplateUsageEvent);
        break;
      
      case 'template_rated':
        await processTemplateRated(eventData as TemplateUsageEvent);
        break;
      
      case 'assistant_created':
        await processAssistantCreated(eventData as AssistantPerformanceEvent);
        break;
      
      case 'assistant_deployed':
        await processAssistantDeployed(eventData as AssistantPerformanceEvent);
        break;
      
      case 'assistant_performance_update':
        await processAssistantPerformanceUpdate(eventData as AssistantPerformanceEvent);
        break;
      
      default:
        console.warn('Unknown event type:', (eventData as any).eventType);
    }

    console.log('Analytics event processed successfully');

  } catch (error) {
    console.error('Error processing analytics event:', error);
    
    // Send alert for critical analytics failures
    if (ANALYTICS_ALERTS_TOPIC) {
      await sendAnalyticsAlert(event, error);
    }
    
    throw error; // Re-throw to trigger DLQ
  }
};

/**
 * Processes call completion events - updates template and assistant analytics
 */
async function processCallCompleted(event: CallAnalyticsEvent): Promise<void> {
  console.log('Processing call completed:', event.callId);

  const currentMonth = new Date(event.timestamp).toISOString().slice(0, 7);
  const analyticsId = `${event.templateId}#${currentMonth}`;

  // Update template analytics
  await updateTemplateAnalytics(analyticsId, {
    totalCalls: 1,
    successfulCalls: event.status === 'completed' ? 1 : 0,
    totalDuration: event.duration || 0,
    qualityScoreSum: event.qualityScore || 0,
    qualityScoreCount: event.qualityScore ? 1 : 0,
    objectivesAchievedUpdate: event.objectivesAchieved || []
  });

  // Update assistant performance
  await updateAssistantPerformance(event.assistantId, {
    totalCalls: 1,
    successfulCalls: event.status === 'completed' ? 1 : 0,
    totalDuration: event.duration || 0,
    lastCallAt: event.timestamp
  });

  // Trigger real-time insights if significant patterns detected
  await checkForInsights(event);
}

/**
 * Processes call started events - tracks concurrent calls and load
 */
async function processCallStarted(event: CallAnalyticsEvent): Promise<void> {
  console.log('Processing call started:', event.callId);

  const currentMonth = new Date(event.timestamp).toISOString().slice(0, 7);
  const analyticsId = `${event.templateId}#${currentMonth}`;

  // Update concurrent call metrics
  await updateTemplateAnalytics(analyticsId, {
    concurrentCalls: 1 // Will be decremented when call ends
  });

  // Track peak usage times for capacity planning
  const hourOfDay = new Date(event.timestamp).getHours();
  await updateHourlyUsageMetrics(event.templateId, hourOfDay);
}

/**
 * Processes call failed events - tracks failure patterns
 */
async function processCallFailed(event: CallAnalyticsEvent): Promise<void> {
  console.log('Processing call failed:', event.callId);

  const currentMonth = new Date(event.timestamp).toISOString().slice(0, 7);
  const analyticsId = `${event.templateId}#${currentMonth}`;

  await updateTemplateAnalytics(analyticsId, {
    totalCalls: 1,
    failedCalls: 1,
    failureReasons: [event.metadata?.failureReason || 'unknown']
  });

  // Alert if failure rate exceeds threshold
  await checkFailureRateAlert(event.templateId, currentMonth);
}

/**
 * Processes escalation events - tracks when human intervention is needed
 */
async function processEscalationTriggered(event: CallAnalyticsEvent): Promise<void> {
  console.log('Processing escalation triggered:', event.callId);

  const currentMonth = new Date(event.timestamp).toISOString().slice(0, 7);
  const analyticsId = `${event.templateId}#${currentMonth}`;

  await updateTemplateAnalytics(analyticsId, {
    escalationsTriggered: 1,
    escalationReasons: [event.metadata?.escalationReason || 'unknown']
  });

  // Real-time alert for escalations
  if (ANALYTICS_ALERTS_TOPIC) {
    await snsClient.send(new PublishCommand({
      TopicArn: ANALYTICS_ALERTS_TOPIC,
      Subject: 'Voice Matrix - Call Escalation Triggered',
      Message: `Call ${event.callId} was escalated for assistant ${event.assistantId}. Reason: ${event.metadata?.escalationReason || 'Unknown'}`
    }));
  }
}

/**
 * Processes template usage events
 */
async function processTemplateUsed(event: TemplateUsageEvent): Promise<void> {
  console.log('Processing template used:', event.templateId);

  const currentMonth = new Date(event.timestamp).toISOString().slice(0, 7);
  const analyticsId = `${event.templateId}#${currentMonth}`;

  await updateTemplateAnalytics(analyticsId, {
    totalUsages: 1,
    uniqueUsers: [event.userId] // Will be deduplicated in update logic
  });
}

/**
 * Processes template view events for engagement tracking
 */
async function processTemplateViewed(event: TemplateUsageEvent): Promise<void> {
  console.log('Processing template viewed:', event.templateId);

  const currentMonth = new Date(event.timestamp).toISOString().slice(0, 7);
  const analyticsId = `${event.templateId}#${currentMonth}`;

  await updateTemplateAnalytics(analyticsId, {
    templateViews: 1,
    viewingUsers: [event.userId]
  });
}

/**
 * Processes template rating events
 */
async function processTemplateRated(event: TemplateUsageEvent): Promise<void> {
  console.log('Processing template rated:', event.templateId, 'Rating:', event.rating);

  const currentMonth = new Date(event.timestamp).toISOString().slice(0, 7);
  const analyticsId = `${event.templateId}#${currentMonth}`;

  if (event.rating) {
    await updateTemplateAnalytics(analyticsId, {
      totalRatings: 1,
      ratingSum: event.rating,
      ratingDistribution: [event.rating]
    });
  }
}

/**
 * Processes assistant creation events
 */
async function processAssistantCreated(event: AssistantPerformanceEvent): Promise<void> {
  console.log('Processing assistant created:', event.assistantId);

  const currentMonth = new Date(event.timestamp).toISOString().slice(0, 7);
  const analyticsId = `${event.templateId}#${currentMonth}`;

  await updateTemplateAnalytics(analyticsId, {
    activeAssistants: 1,
    uniqueUsers: [event.userId]
  });
}

/**
 * Processes assistant deployment events
 */
async function processAssistantDeployed(event: AssistantPerformanceEvent): Promise<void> {
  console.log('Processing assistant deployed:', event.assistantId);

  const currentMonth = new Date(event.timestamp).toISOString().slice(0, 7);
  const analyticsId = `${event.templateId}#${currentMonth}`;

  await updateTemplateAnalytics(analyticsId, {
    deployedAssistants: 1
  });
}

/**
 * Processes assistant performance updates
 */
async function processAssistantPerformanceUpdate(event: AssistantPerformanceEvent): Promise<void> {
  console.log('Processing assistant performance update:', event.assistantId);

  if (event.performanceMetrics) {
    await updateAssistantPerformance(event.assistantId, event.performanceMetrics);
  }
}

/**
 * Updates template analytics with atomic operations
 */
async function updateTemplateAnalytics(analyticsId: string, updates: Record<string, any>): Promise<void> {
  const updateExpressions: string[] = [];
  const expressionAttributeValues: Record<string, any> = {};
  const expressionAttributeNames: Record<string, string> = {};

  // Handle different types of updates
  Object.entries(updates).forEach(([key, value]) => {
    switch (key) {
      case 'totalCalls':
      case 'successfulCalls':
      case 'failedCalls':
      case 'totalUsages':
      case 'activeAssistants':
      case 'deployedAssistants':
      case 'templateViews':
      case 'totalRatings':
      case 'escalationsTriggered':
        updateExpressions.push(`ADD ${key} :${key}`);
        expressionAttributeValues[`:${key}`] = value;
        break;
      
      case 'totalDuration':
      case 'qualityScoreSum':
      case 'qualityScoreCount':
      case 'ratingSum':
        updateExpressions.push(`ADD ${key} :${key}`);
        expressionAttributeValues[`:${key}`] = value;
        break;
      
      case 'objectivesAchievedUpdate':
        // Handle objectives as a map
        if (Array.isArray(value)) {
          value.forEach((objective, index) => {
            updateExpressions.push(`ADD objectivesAchieved.#obj${index} :one`);
            expressionAttributeNames[`#obj${index}`] = objective.replace(/[^a-zA-Z0-9]/g, '_');
            expressionAttributeValues[':one'] = 1;
          });
        }
        break;
      
      case 'uniqueUsers':
      case 'viewingUsers':
        // Handle as a string set (will be deduplicated)
        if (Array.isArray(value)) {
          updateExpressions.push(`ADD ${key} :${key}`);
          expressionAttributeValues[`:${key}`] = new Set(value);
        }
        break;
      
      case 'ratingDistribution':
        // Update rating distribution array
        if (Array.isArray(value) && value.length > 0) {
          const rating = value[0];
          const index = rating - 1; // Convert 1-5 rating to 0-4 index
          if (index >= 0 && index < 5) {
            updateExpressions.push(`ADD ratingDistribution[${index}] :one`);
            expressionAttributeValues[':one'] = 1;
          }
        }
        break;
      
      case 'failureReasons':
      case 'escalationReasons':
        // Handle as string set
        if (Array.isArray(value)) {
          updateExpressions.push(`ADD ${key} :${key}`);
          expressionAttributeValues[`:${key}`] = new Set(value);
        }
        break;
    }
  });

  // Always update computed timestamp
  updateExpressions.push('SET computedAt = :computedAt');
  expressionAttributeValues[':computedAt'] = new Date().toISOString();

  if (updateExpressions.length === 0) {
    console.warn('No valid update expressions for analytics update');
    return;
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: TEMPLATE_ANALYTICS_TABLE,
      Key: { analyticsId },
      UpdateExpression: updateExpressions.join(', '),
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ReturnValues: 'NONE'
    }));

    console.log('Template analytics updated successfully:', analyticsId);
  } catch (error) {
    console.error('Error updating template analytics:', error);
    throw error;
  }
}

/**
 * Updates assistant performance metrics
 */
async function updateAssistantPerformance(assistantId: string, updates: Record<string, any>): Promise<void> {
  const updateExpressions: string[] = [];
  const expressionAttributeValues: Record<string, any> = {};

  Object.entries(updates).forEach(([key, value]) => {
    if (key === 'lastCallAt') {
      updateExpressions.push(`SET ${key} = :${key}`);
    } else {
      updateExpressions.push(`ADD ${key} :${key}`);
    }
    expressionAttributeValues[`:${key}`] = value;
  });

  updateExpressions.push('SET updatedAt = :updatedAt');
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  try {
    await docClient.send(new UpdateCommand({
      TableName: USER_ASSISTANTS_TABLE,
      Key: { assistantId },
      UpdateExpression: updateExpressions.join(', '),
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'NONE'
    }));

    console.log('Assistant performance updated successfully:', assistantId);
  } catch (error) {
    console.error('Error updating assistant performance:', error);
    // Don't throw here - assistant updates are secondary to analytics
  }
}

/**
 * Updates hourly usage metrics for capacity planning
 */
async function updateHourlyUsageMetrics(templateId: string, hourOfDay: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const hourlyId = `${templateId}#${today}#${hourOfDay}`;

  try {
    await docClient.send(new UpdateCommand({
      TableName: TEMPLATE_ANALYTICS_TABLE,
      Key: { analyticsId: hourlyId },
      UpdateExpression: 'ADD hourlyUsage :one SET computedAt = :computedAt, hourOfDay = :hour',
      ExpressionAttributeValues: {
        ':one': 1,
        ':computedAt': new Date().toISOString(),
        ':hour': hourOfDay
      },
      ReturnValues: 'NONE'
    }));
  } catch (error) {
    console.warn('Error updating hourly metrics:', error);
    // Non-critical, don't throw
  }
}

/**
 * Checks for real-time insights and patterns
 */
async function checkForInsights(event: CallAnalyticsEvent): Promise<void> {
  // Check for performance anomalies
  if (event.qualityScore && event.qualityScore < 2.0) {
    await sendInsightAlert('quality_degradation', {
      templateId: event.templateId,
      assistantId: event.assistantId,
      qualityScore: event.qualityScore,
      message: 'Call quality score below threshold'
    });
  }

  // Check for high objective achievement
  if (event.objectivesAchieved && event.objectivesAchieved.length > 3) {
    await sendInsightAlert('high_performance', {
      templateId: event.templateId,
      assistantId: event.assistantId,
      objectivesCount: event.objectivesAchieved.length,
      message: 'Exceptional performance - multiple objectives achieved'
    });
  }
}

/**
 * Checks failure rate and sends alerts if threshold exceeded
 */
async function checkFailureRateAlert(templateId: string, period: string): Promise<void> {
  try {
    const analyticsId = `${templateId}#${period}`;
    
    const result = await docClient.send(new GetCommand({
      TableName: TEMPLATE_ANALYTICS_TABLE,
      Key: { analyticsId }
    }));

    if (result.Item) {
      const totalCalls = result.Item.totalCalls || 0;
      const failedCalls = result.Item.failedCalls || 0;
      
      if (totalCalls > 10) { // Only check if we have sufficient data
        const failureRate = failedCalls / totalCalls;
        
        if (failureRate > 0.2) { // 20% failure rate threshold
          await sendInsightAlert('high_failure_rate', {
            templateId,
            period,
            failureRate: Math.round(failureRate * 100),
            totalCalls,
            failedCalls,
            message: `High failure rate detected: ${Math.round(failureRate * 100)}%`
          });
        }
      }
    }
  } catch (error) {
    console.warn('Error checking failure rate:', error);
  }
}

/**
 * Sends real-time insight alerts
 */
async function sendInsightAlert(type: string, data: Record<string, any>): Promise<void> {
  if (!ANALYTICS_ALERTS_TOPIC) return;

  try {
    await snsClient.send(new PublishCommand({
      TopicArn: ANALYTICS_ALERTS_TOPIC,
      Subject: `Voice Matrix - ${type.replace(/_/g, ' ').toUpperCase()}`,
      Message: JSON.stringify({
        alertType: type,
        timestamp: new Date().toISOString(),
        data
      }, null, 2)
    }));
  } catch (error) {
    console.warn('Error sending insight alert:', error);
  }
}

/**
 * Sends analytics processing error alerts
 */
async function sendAnalyticsAlert(event: any, error: any): Promise<void> {
  try {
    await snsClient.send(new PublishCommand({
      TopicArn: ANALYTICS_ALERTS_TOPIC,
      Subject: 'Voice Matrix - Analytics Processing Error',
      Message: `Analytics processing failed for event: ${JSON.stringify(event, null, 2)}\n\nError: ${error.message}`
    }));
  } catch (alertError) {
    console.error('Failed to send analytics alert:', alertError);
  }
}