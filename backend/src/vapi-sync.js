const AWS = require('aws-sdk');
const axios = require('axios');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.syncVapiData = async (event) => {
    try {
        console.log('Starting VAPI data sync...');
        
        // Get all users with VAPI keys
        const users = await getAllUsersWithVapiKeys();
        console.log(`Found ${users.length} users with VAPI keys`);
        
        for (const user of users) {
            try {
                await syncUserCallsFromVapi(user);
                await updateSyncStatus(user.userId, 'calls', 'success');
            } catch (error) {
                console.error(`Error syncing calls for user ${user.userId}:`, error);
                await updateSyncStatus(user.userId, 'calls', 'failed', error.message);
            }
            
            try {
                await syncUserAssistantsFromVapi(user);
                await updateSyncStatus(user.userId, 'assistants', 'success');
            } catch (error) {
                console.error(`Error syncing assistants for user ${user.userId}:`, error);
                await updateSyncStatus(user.userId, 'assistants', 'failed', error.message);
            }
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Sync completed',
                processedUsers: users.length
            })
        };
    } catch (error) {
        console.error('Error in sync process:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.syncUserData = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        
        // Get user's VAPI credentials
        const userParams = {
            TableName: process.env.USERS_TABLE,
            Key: { userId }
        };
        const userData = await dynamodb.get(userParams).promise();
        
        if (!userData.Item?.vapiApiKey) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'VAPI API key not configured' })
            };
        }
        
        // Sync user's data
        await syncUserCallsFromVapi(userData.Item);
        await syncUserAssistantsFromVapi(userData.Item);
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'User data synced successfully' })
        };
    } catch (error) {
        console.error('Error syncing user data:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

async function getAllUsersWithVapiKeys() {
    const params = {
        TableName: process.env.USERS_TABLE,
        FilterExpression: 'attribute_exists(vapiApiKey)'
    };
    
    const result = await dynamodb.scan(params).promise();
    return result.Items || [];
}

async function syncUserCallsFromVapi(user) {
    try {
        // Get the last sync timestamp
        const lastSyncParams = {
            TableName: process.env.VAPI_SYNC_TABLE || 'voice-matrix-vapi-sync',
            Key: { userId: user.userId, syncType: 'calls' }
        };
        
        const lastSync = await dynamodb.get(lastSyncParams).promise();
        const lastSyncTime = lastSync.Item?.lastSyncTimestamp || 
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago
        
        // Get recent calls from VAPI
        const vapiParams = {
            limit: 100,
            createdAtGte: lastSyncTime
        };
        
        const vapiResponse = await axios.get('https://api.vapi.ai/call', {
            headers: {
                'Authorization': `Bearer ${user.vapiApiKey}`,
                'Content-Type': 'application/json'
            },
            params: vapiParams
        });
        
        const calls = vapiResponse.data;
        let syncedCount = 0;
        
        // Process each call
        for (const call of calls) {
            try {
                // Check if call already exists in our database
                const existingCallParams = {
                    TableName: process.env.CALLS_TABLE,
                    Key: { userId: user.userId, callId: `vapi_${call.id}` }
                };
                
                const existingCall = await dynamodb.get(existingCallParams).promise();
                
                if (!existingCall.Item) {
                    // Save new call
                    await saveCallToDynamoDB(user.userId, call);
                    syncedCount++;
                } else if (call.endedAt && !existingCall.Item.endedAt) {
                    // Update call if it has ended since we last saw it
                    await updateCallInDynamoDB(user.userId, call);
                    syncedCount++;
                }
            } catch (callError) {
                console.error(`Error processing call ${call.id}:`, callError);
            }
        }
        
        // Update sync status
        await updateSyncStatus(user.userId, 'calls', 'success', null, syncedCount);
        
        console.log(`Synced ${syncedCount} calls for user ${user.userId}`);
    } catch (error) {
        console.error(`Error syncing calls for user ${user.userId}:`, error);
        throw error;
    }
}

async function syncUserAssistantsFromVapi(user) {
    try {
        // Get assistants from VAPI
        const vapiResponse = await axios.get('https://api.vapi.ai/assistant', {
            headers: {
                'Authorization': `Bearer ${user.vapiApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        const assistants = vapiResponse.data;
        
        // Update user record with assistant IDs for call mapping
        const assistantIds = assistants.map(a => a.id);
        
        await dynamodb.update({
            TableName: process.env.USERS_TABLE,
            Key: { userId: user.userId },
            UpdateExpression: 'SET assistantIds = :assistantIds, lastAssistantSync = :timestamp',
            ExpressionAttributeValues: {
                ':assistantIds': assistantIds,
                ':timestamp': new Date().toISOString()
            }
        }).promise();
        
        console.log(`Updated assistant IDs for user ${user.userId}:`, assistantIds);
    } catch (error) {
        console.error(`Error syncing assistants for user ${user.userId}:`, error);
        throw error;
    }
}

async function saveCallToDynamoDB(userId, call) {
    const duration = call.endedAt && call.startedAt ? 
        Math.floor((new Date(call.endedAt) - new Date(call.startedAt)) / 1000) : 0;
    
    const callLog = {
        userId,
        callId: `vapi_${call.id}`,
        vapiCallId: call.id,
        timestamp: call.endedAt || call.startedAt || new Date().toISOString(),
        duration: duration,
        callerName: call.customer?.name || 'Unknown',
        callerPhone: call.customer?.number || '',
        outcome: call.endedReason === 'customer-ended-call' ? 'completed' : call.endedReason,
        satisfaction: calculateSatisfactionScore(call),
        transcript: call.transcript || '',
        cost: call.cost || 0,
        assistantId: call.assistantId,
        summary: call.summary || '',
        status: call.endedAt ? 'completed' : 'in_progress',
        type: call.type || 'inbound',
        recordingUrl: call.recordingUrl || null,
        stereoRecordingUrl: call.stereoRecordingUrl || null,
        endedReason: call.endedReason,
        startedAt: call.startedAt,
        endedAt: call.endedAt
    };
    
    await dynamodb.put({
        TableName: process.env.CALLS_TABLE,
        Item: callLog
    }).promise();
    
    // Update analytics if call is completed
    if (call.endedAt) {
        await updateAnalytics(userId, callLog);
    }
}

async function updateCallInDynamoDB(userId, call) {
    const duration = call.endedAt && call.startedAt ? 
        Math.floor((new Date(call.endedAt) - new Date(call.startedAt)) / 1000) : 0;
    
    const updateParams = {
        TableName: process.env.CALLS_TABLE,
        Key: { userId, callId: `vapi_${call.id}` },
        UpdateExpression: `SET 
            #duration = :duration,
            #outcome = :outcome,
            #satisfaction = :satisfaction,
            #transcript = :transcript,
            #cost = :cost,
            #summary = :summary,
            #status = :status,
            #recordingUrl = :recordingUrl,
            #stereoRecordingUrl = :stereoRecordingUrl,
            #endedReason = :endedReason,
            #endedAt = :endedAt`,
        ExpressionAttributeNames: {
            '#duration': 'duration',
            '#outcome': 'outcome',
            '#satisfaction': 'satisfaction',
            '#transcript': 'transcript',
            '#cost': 'cost',
            '#summary': 'summary',
            '#status': 'status',
            '#recordingUrl': 'recordingUrl',
            '#stereoRecordingUrl': 'stereoRecordingUrl',
            '#endedReason': 'endedReason',
            '#endedAt': 'endedAt'
        },
        ExpressionAttributeValues: {
            ':duration': duration,
            ':outcome': call.endedReason === 'customer-ended-call' ? 'completed' : call.endedReason,
            ':satisfaction': calculateSatisfactionScore(call),
            ':transcript': call.transcript || '',
            ':cost': call.cost || 0,
            ':summary': call.summary || '',
            ':status': call.endedAt ? 'completed' : 'in_progress',
            ':recordingUrl': call.recordingUrl || null,
            ':stereoRecordingUrl': call.stereoRecordingUrl || null,
            ':endedReason': call.endedReason,
            ':endedAt': call.endedAt
        }
    };
    
    await dynamodb.update(updateParams).promise();
    
    // Update analytics
    if (call.endedAt) {
        const callLog = {
            userId,
            duration,
            outcome: call.endedReason === 'customer-ended-call' ? 'completed' : call.endedReason,
            satisfaction: calculateSatisfactionScore(call),
            cost: call.cost || 0,
            endedReason: call.endedReason
        };
        await updateAnalytics(userId, callLog);
    }
}

async function updateSyncStatus(userId, syncType, status, errorMessage = null, syncedCount = 0) {
    const syncRecord = {
        userId,
        syncType,
        lastSyncTimestamp: new Date().toISOString(),
        syncStatus: status,
        syncedCount
    };
    
    if (errorMessage) {
        syncRecord.errorMessage = errorMessage;
    }
    
    await dynamodb.put({
        TableName: process.env.VAPI_SYNC_TABLE || 'voice-matrix-vapi-sync',
        Item: syncRecord
    }).promise();
}

function calculateSatisfactionScore(call) {
    if (!call.endedReason) return 3;
    
    switch (call.endedReason) {
        case 'customer-ended-call':
            const duration = call.duration || 0;
            if (duration > 30) return 4;
            if (duration > 10) return 3;
            return 2;
        case 'assistant-ended-call':
            return 4;
        case 'customer-hung-up':
            return 2;
        case 'assistant-hung-up':
            return 1;
        case 'exceeded-max-duration':
            return 3;
        case 'silence-timeout':
            return 2;
        case 'pipeline-error-openai-llm-failed':
        case 'pipeline-error-custom-llm-failed':
        case 'pipeline-error-azure-openai-llm-failed':
            return 1;
        default:
            return 3;
    }
}

async function updateAnalytics(userId, callLog) {
    try {
        const today = new Date().toISOString().split('T')[0];
        
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
        
        analytics.totalCalls += 1;
        if (callLog.outcome === 'completed' || callLog.endedReason === 'customer-ended-call') {
            analytics.successfulCalls += 1;
        }
        
        const totalDuration = (analytics.averageDuration * (analytics.totalCalls - 1)) + callLog.duration;
        analytics.averageDuration = Math.round(totalDuration / analytics.totalCalls);
        
        analytics.totalCost += callLog.cost || 0;
        
        if (callLog.satisfaction) {
            const totalSatisfaction = (analytics.satisfactionScore * (analytics.totalCalls - 1)) + callLog.satisfaction;
            analytics.satisfactionScore = Math.round((totalSatisfaction / analytics.totalCalls) * 10) / 10;
        }
        
        await dynamodb.put({
            TableName: process.env.ANALYTICS_TABLE,
            Item: analytics
        }).promise();
    } catch (error) {
        console.error('Error updating analytics:', error);
    }
}