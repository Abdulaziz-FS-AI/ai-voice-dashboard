const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handleWebhook = async (event) => {
    try {
        const webhookData = JSON.parse(event.body);
        const { type, call, message } = webhookData;
        
        console.log(`Received VAPI webhook: ${type}`, webhookData);
        
        // Handle different VAPI webhook events
        switch (type) {
            case 'call-started':
                await handleCallStarted(call);
                break;
            case 'call-ended':
                await handleCallEnded(call);
                break;
            case 'transcript':
                await handleTranscript(call, message);
                break;
            case 'function-call':
                await handleFunctionCall(call, message);
                break;
            case 'hang':
                await handleHang(call);
                break;
            case 'speech-update':
                await handleSpeechUpdate(call, message);
                break;
            default:
                console.log(`Unhandled webhook type: ${type}`);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error('Webhook error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

async function handleCallStarted(call) {
    try {
        const userId = await getUserIdFromCall(call);
        if (!userId) {
            console.log('Could not determine user for call:', call.id);
            return;
        }
        
        const callLog = {
            userId,
            callId: `vapi_${call.id}`,
            vapiCallId: call.id,
            timestamp: call.startedAt || new Date().toISOString(),
            status: 'in_progress',
            callerName: call.customer?.name || 'Unknown',
            callerPhone: call.customer?.number || '',
            assistantId: call.assistantId,
            type: call.type || 'inbound'
        };
        
        await dynamodb.put({
            TableName: process.env.CALLS_TABLE,
            Item: callLog
        }).promise();
        
        console.log('Call started logged:', callLog);
    } catch (error) {
        console.error('Error handling call started:', error);
    }
}

async function handleCallEnded(call) {
    try {
        const userId = await getUserIdFromCall(call);
        if (!userId) {
            console.log('Could not determine user for call:', call.id);
            return;
        }
        
        // Calculate duration
        const startTime = new Date(call.startedAt);
        const endTime = new Date(call.endedAt);
        const duration = Math.floor((endTime - startTime) / 1000); // seconds
        
        // Determine satisfaction score from call analysis
        const satisfaction = calculateSatisfactionScore(call);
        
        const callLog = {
            userId,
            callId: `vapi_${call.id}`,
            vapiCallId: call.id,
            timestamp: call.endedAt || new Date().toISOString(),
            duration: duration,
            callerName: call.customer?.name || 'Unknown',
            callerPhone: call.customer?.number || '',
            outcome: call.endedReason === 'customer-ended-call' ? 'completed' : call.endedReason,
            satisfaction: satisfaction,
            transcript: call.transcript || '',
            cost: call.cost || 0,
            assistantId: call.assistantId,
            summary: call.summary || '',
            status: 'completed',
            type: call.type || 'inbound',
            recordingUrl: call.recordingUrl || null,
            stereoRecordingUrl: call.stereoRecordingUrl || null,
            endedReason: call.endedReason
        };
        
        // Update or insert call log
        await dynamodb.put({
            TableName: process.env.CALLS_TABLE,
            Item: callLog
        }).promise();
        
        // Update analytics
        await updateAnalytics(userId, callLog);
        
        console.log('Call ended logged:', callLog);
    } catch (error) {
        console.error('Error handling call ended:', error);
    }
}

async function handleTranscript(call, message) {
    try {
        const userId = await getUserIdFromCall(call);
        if (!userId) return;
        
        // Update call with latest transcript
        const updateParams = {
            TableName: process.env.CALLS_TABLE,
            Key: { userId, callId: `vapi_${call.id}` },
            UpdateExpression: 'SET transcript = :transcript, lastTranscriptUpdate = :timestamp',
            ExpressionAttributeValues: {
                ':transcript': message.transcript || '',
                ':timestamp': new Date().toISOString()
            }
        };
        
        await dynamodb.update(updateParams).promise();
        
        console.log('Transcript updated for call:', call.id);
    } catch (error) {
        console.error('Error handling transcript:', error);
    }
}

async function handleFunctionCall(call, message) {
    try {
        console.log('Function call received:', message);
        // Handle function calls here if needed
        // This could trigger external APIs or business logic
    } catch (error) {
        console.error('Error handling function call:', error);
    }
}

async function handleHang(call) {
    try {
        console.log('Hang detected for call:', call.id);
        // Handle hang detection
    } catch (error) {
        console.error('Error handling hang:', error);
    }
}

async function handleSpeechUpdate(call, message) {
    try {
        console.log('Speech update for call:', call.id, message);
        // Handle real-time speech updates if needed
    } catch (error) {
        console.error('Error handling speech update:', error);
    }
}

async function getUserIdFromCall(call) {
    try {
        // Method 1: Check if assistant has metadata with userId
        if (call.assistant?.metadata?.userId) {
            return call.assistant.metadata.userId;
        }
        
        // Method 2: Look up user by assistant ID
        const assistantParams = {
            TableName: process.env.USERS_TABLE,
            FilterExpression: 'contains(assistantIds, :assistantId)',
            ExpressionAttributeValues: {
                ':assistantId': call.assistantId
            }
        };
        
        const assistantResult = await dynamodb.scan(assistantParams).promise();
        if (assistantResult.Items?.length > 0) {
            return assistantResult.Items[0].userId;
        }
        
        // Method 3: Look up user by phone number mapping
        if (call.customer?.number) {
            const phoneParams = {
                TableName: process.env.USERS_TABLE,
                FilterExpression: 'contains(phoneNumbers, :phone)',
                ExpressionAttributeValues: {
                    ':phone': call.customer.number
                }
            };
            
            const phoneResult = await dynamodb.scan(phoneParams).promise();
            if (phoneResult.Items?.length > 0) {
                return phoneResult.Items[0].userId;
            }
        }
        
        // Method 4: If no mapping found, check for default user or create one
        // This is a fallback - in production you'd want better user mapping
        console.warn('No user mapping found for call:', call.id);
        return null;
    } catch (error) {
        console.error('Error getting user ID from call:', error);
        return null;
    }
}

function calculateSatisfactionScore(call) {
    // Simple satisfaction scoring based on call outcome and duration
    if (!call.endedReason) return 3; // neutral
    
    switch (call.endedReason) {
        case 'customer-ended-call':
            // If customer ended naturally and call was long enough
            const duration = call.duration || 0;
            if (duration > 30) return 4; // good
            if (duration > 10) return 3; // neutral
            return 2; // short call might indicate issues
        case 'assistant-ended-call':
            return 4; // assistant completed the task
        case 'customer-hung-up':
            return 2; // customer hung up early
        case 'assistant-hung-up':
            return 1; // technical issue
        case 'exceeded-max-duration':
            return 3; // long call, neutral
        case 'silence-timeout':
            return 2; // silence might indicate confusion
        case 'pipeline-error-openai-llm-failed':
        case 'pipeline-error-custom-llm-failed':
        case 'pipeline-error-azure-openai-llm-failed':
            return 1; // technical failure
        default:
            return 3; // neutral for unknown reasons
    }
}

async function updateAnalytics(userId, callLog) {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Get existing analytics or create new
        const params = {
            TableName: process.env.ANALYTICS_TABLE,
            Key: { userId, date: today }
        };
        
        const existing = await dynamodb.get(params).promise();
        const analytics = existing.Item || {
            userId,
            date: today,
            totalCalls: 0,
            successfulCalls: 0,
            averageDuration: 0,
            totalCost: 0,
            satisfactionScore: 0
        };
        
        // Update analytics
        analytics.totalCalls += 1;
        if (callLog.outcome === 'completed' || callLog.endedReason === 'customer-ended-call') {
            analytics.successfulCalls += 1;
        }
        
        // Update average duration
        const totalDuration = (analytics.averageDuration * (analytics.totalCalls - 1)) + callLog.duration;
        analytics.averageDuration = Math.round(totalDuration / analytics.totalCalls);
        
        // Update total cost
        analytics.totalCost += callLog.cost || 0;
        
        // Update satisfaction score
        if (callLog.satisfaction) {
            const totalSatisfaction = (analytics.satisfactionScore * (analytics.totalCalls - 1)) + callLog.satisfaction;
            analytics.satisfactionScore = Math.round((totalSatisfaction / analytics.totalCalls) * 10) / 10;
        }
        
        await dynamodb.put({
            TableName: process.env.ANALYTICS_TABLE,
            Item: analytics
        }).promise();
        
        console.log('Analytics updated:', analytics);
    } catch (error) {
        console.error('Error updating analytics:', error);
    }
}