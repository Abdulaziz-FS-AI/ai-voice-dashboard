# Voice Matrix + VAPI Integration Guide

## 🎯 **Updated Architecture with VAPI**

### **What Changes:**
- ✅ **Keep:** Users, Call Logs, Analytics tables in DynamoDB
- ❌ **Remove:** Agent Configurations table (VAPI handles this)
- ✅ **Add:** VAPI API integration in Lambda functions
- ✅ **Add:** VAPI webhook endpoints for real-time call data

---

## 📊 **Updated Database Design**

### **1. Users Table** (Keep Same)
```
Table Name: voice-matrix-users
Partition Key: userId (String)
Attributes:
- email (String)
- vapiApiKey (String - encrypted)
- vapiOrgId (String)
- createdAt (String)
- lastLogin (String)
- subscription (String)
```

### **2. Call Logs Table** (Enhanced for VAPI)
```
Table Name: voice-matrix-calls
Partition Key: userId (String)
Sort Key: callId (String)
Attributes:
- vapiCallId (String - VAPI's call ID)
- timestamp (String)
- duration (Number)
- callerName (String)
- callerPhone (String)
- outcome (String)
- satisfaction (Number)
- transcript (String - from VAPI)
- cost (Number - VAPI call cost)
- assistantId (String - VAPI assistant ID)
- summary (String - AI generated summary)
```

### **3. Analytics Table** (Keep Same)
```
Table Name: voice-matrix-analytics
Partition Key: userId (String)
Sort Key: date (String)
Attributes:
- totalCalls (Number)
- successfulCalls (Number)
- averageDuration (Number)
- totalCost (Number - VAPI costs)
- satisfactionScore (Number)
- topIntents (List - from VAPI transcripts)
```

### **4. VAPI Sync Table** (New)
```
Table Name: voice-matrix-vapi-sync
Partition Key: userId (String)
Sort Key: syncType (String - assistants/calls/analytics)
Attributes:
- lastSyncTimestamp (String)
- syncStatus (String - success/failed/pending)
- errorMessage (String)
- syncedCount (Number)
```

---

## 🔧 **Updated Lambda Functions**

### **1. VAPI Integration Functions**

#### **Get User's VAPI Assistants**
```javascript
// src/vapi-assistants.js
const AWS = require('aws-sdk');
const axios = require('axios');

exports.getAssistants = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        
        // Get user's VAPI credentials from DynamoDB
        const userParams = {
            TableName: process.env.USERS_TABLE,
            Key: { userId }
        };
        const userData = await dynamodb.get(userParams).promise();
        
        if (!userData.Item?.vapiApiKey) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'VAPI API key not configured' })
            };
        }
        
        // Call VAPI API to get assistants
        const vapiResponse = await axios.get('https://api.vapi.ai/assistant', {
            headers: {
                'Authorization': `Bearer ${userData.Item.vapiApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(vapiResponse.data)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.updateAssistant = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const assistantId = event.pathParameters.assistantId;
        const assistantConfig = JSON.parse(event.body);
        
        // Get user's VAPI credentials
        const userParams = {
            TableName: process.env.USERS_TABLE,
            Key: { userId }
        };
        const userData = await dynamodb.get(userParams).promise();
        
        // Update assistant via VAPI API
        const vapiResponse = await axios.patch(
            `https://api.vapi.ai/assistant/${assistantId}`,
            assistantConfig,
            {
                headers: {
                    'Authorization': `Bearer ${userData.Item.vapiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(vapiResponse.data)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
```

#### **VAPI Webhook Handler**
```javascript
// src/vapi-webhook.js
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handleWebhook = async (event) => {
    try {
        const webhookData = JSON.parse(event.body);
        const { type, call } = webhookData;
        
        // Handle different VAPI webhook events
        switch (type) {
            case 'call-started':
                await handleCallStarted(call);
                break;
            case 'call-ended':
                await handleCallEnded(call);
                break;
            case 'transcript':
                await handleTranscript(call);
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

async function handleCallEnded(call) {
    // Extract user ID from VAPI metadata or phone number mapping
    const userId = await getUserIdFromCall(call);
    
    if (!userId) return;
    
    // Save call log to DynamoDB
    const callLog = {
        userId,
        callId: `vapi_${call.id}`,
        vapiCallId: call.id,
        timestamp: call.endedAt || new Date().toISOString(),
        duration: call.duration || 0,
        callerName: call.customer?.name || 'Unknown',
        callerPhone: call.customer?.number || '',
        outcome: call.endedReason === 'customer-ended' ? 'completed' : call.endedReason,
        transcript: call.transcript || '',
        cost: call.cost || 0,
        assistantId: call.assistantId,
        summary: call.summary || ''
    };
    
    await dynamodb.put({
        TableName: process.env.CALLS_TABLE,
        Item: callLog
    }).promise();
    
    // Update analytics
    await updateAnalytics(userId, callLog);
}

async function getUserIdFromCall(call) {
    // You'll need to implement this based on how you map VAPI calls to users
    // Option 1: Store user mapping in DynamoDB based on phone numbers
    // Option 2: Use VAPI metadata to store user ID
    // Option 3: Use assistant ID to user mapping
    
    // Example implementation:
    const params = {
        TableName: process.env.USERS_TABLE,
        FilterExpression: 'contains(phoneNumbers, :phone)',
        ExpressionAttributeValues: {
            ':phone': call.customer?.number || ''
        }
    };
    
    const result = await dynamodb.scan(params).promise();
    return result.Items[0]?.userId;
}
```

#### **VAPI Analytics Sync**
```javascript
// src/vapi-sync.js
exports.syncVapiData = async (event) => {
    try {
        // This function runs on a schedule (e.g., every hour)
        // to sync data from VAPI that might have been missed
        
        const users = await getAllUsersWithVapiKeys();
        
        for (const user of users) {
            await syncUserCallsFromVapi(user);
            await syncUserAnalyticsFromVapi(user);
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Sync completed' })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

async function syncUserCallsFromVapi(user) {
    // Get recent calls from VAPI
    const vapiCalls = await axios.get('https://api.vapi.ai/call', {
        headers: {
            'Authorization': `Bearer ${user.vapiApiKey}`,
            'Content-Type': 'application/json'
        },
        params: {
            limit: 100,
            // Add timestamp filter for recent calls
        }
    });
    
    // Process and save any missing calls
    for (const call of vapiCalls.data) {
        // Check if call already exists in our database
        const existingCall = await dynamodb.get({
            TableName: process.env.CALLS_TABLE,
            Key: { userId: user.userId, callId: `vapi_${call.id}` }
        }).promise();
        
        if (!existingCall.Item) {
            // Save new call
            await handleCallEnded(call);
        }
    }
}
```

---

## 🔗 **Updated SAM Template**

```yaml
# Updated template.yaml with VAPI integration
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  # Existing API Gateway and functions...
  
  # VAPI Integration Functions
  GetVapiAssistants:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: vapi-assistants.getAssistants
      Events:
        Api:
          Type: Api
          Properties:
            RestApiId: !Ref VoiceMatrixApi
            Path: /vapi/assistants
            Method: GET
      Environment:
        Variables:
          VAPI_BASE_URL: https://api.vapi.ai
  
  UpdateVapiAssistant:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: vapi-assistants.updateAssistant
      Events:
        Api:
          Type: Api
          Properties:
            RestApiId: !Ref VoiceMatrixApi
            Path: /vapi/assistants/{assistantId}
            Method: PATCH
  
  VapiWebhookHandler:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: vapi-webhook.handleWebhook
      Events:
        Api:
          Type: Api
          Properties:
            RestApiId: !Ref VoiceMatrixApi
            Path: /webhook/vapi
            Method: POST
            Auth:
              Authorizer: NONE  # VAPI webhooks don't use Cognito
  
  VapiSyncScheduler:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: vapi-sync.syncVapiData
      Events:
        Schedule:
          Type: Schedule
          Properties:
            Schedule: rate(1 hour)  # Run every hour
```

---

## ⚙️ **Frontend Integration Changes**

### **Update Your React Components**

#### **1. VAPI Settings Component**
```javascript
// src/components/VapiSettings.tsx
import React, { useState } from 'react';

const VapiSettings = () => {
    const [apiKey, setApiKey] = useState('');
    const [orgId, setOrgId] = useState('');
    
    const saveVapiCredentials = async () => {
        // Call your backend to save VAPI credentials
        await fetch(`${process.env.REACT_APP_API_URL}/user/vapi-credentials`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ apiKey, orgId })
        });
    };
    
    return (
        <div className="vapi-settings">
            <h3>VAPI Integration</h3>
            <input 
                type="password"
                placeholder="VAPI API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
            />
            <input 
                type="text"
                placeholder="VAPI Organization ID"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
            />
            <button onClick={saveVapiCredentials}>
                Save VAPI Credentials
            </button>
        </div>
    );
};
```

#### **2. Updated Agent Editor**
```javascript
// Update VoiceAgentEditor.tsx to use VAPI API
const VoiceAgentEditor = () => {
    const [assistants, setAssistants] = useState([]);
    
    useEffect(() => {
        // Load assistants from VAPI via your backend
        fetchVapiAssistants();
    }, []);
    
    const fetchVapiAssistants = async () => {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/vapi/assistants`, {
            headers: {
                'Authorization': `Bearer ${userToken}`
            }
        });
        const data = await response.json();
        setAssistants(data);
    };
    
    const updateAssistant = async (assistantId, config) => {
        await fetch(`${process.env.REACT_APP_API_URL}/vapi/assistants/${assistantId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
    };
    
    // Rest of component...
};
```

---

## 🎯 **VAPI Setup Steps**

### **1. VAPI Webhook Configuration**
```javascript
// In VAPI dashboard, set webhook URL to:
// https://your-api-gateway-url.com/webhook/vapi

// Configure these events:
// - call-started
// - call-ended  
// - transcript (optional, for real-time updates)
```

### **2. Environment Variables**
```bash
# Add to your .env
REACT_APP_API_URL=https://your-api-gateway-url.com
REACT_APP_VAPI_PUBLIC_KEY=your-vapi-public-key
```

### **3. VAPI Call Flow**
```
1. User configures assistant in your dashboard
   ↓
2. Changes sent to VAPI via your backend
   ↓  
3. VAPI assistant receives calls
   ↓
4. VAPI sends webhook to your backend
   ↓
5. Your backend saves call data to DynamoDB
   ↓
6. Dashboard shows real call analytics
```

---

## 💰 **Updated Cost Estimate**

- **DynamoDB**: $1-5/month
- **Lambda**: $1-3/month  
- **API Gateway**: $1-3/month
- **VAPI**: $0.05-0.10 per minute of calls
- **Total Backend**: $3-11/month + VAPI usage

**This integration gives you:**
✅ Real VAPI assistant management
✅ Real call logs and analytics  
✅ Automatic data sync from VAPI
✅ Professional dashboard with live data
✅ Cost tracking for VAPI usage

Much better approach! 🎯