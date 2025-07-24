# Voice Matrix Backend Setup Guide

## Architecture: Lambda + API Gateway + DynamoDB

### Step 1: Create Lambda Functions

#### 1.1 Install AWS CLI and SAM
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install AWS SAM CLI
pip install aws-sam-cli

# Configure AWS credentials
aws configure
# Enter your AWS Access Key ID, Secret Access Key, Region (eu-north-1), Output format (json)
```

#### 1.2 Create SAM Template
Create `template.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Voice Matrix Backend

Globals:
  Function:
    Timeout: 30
    Runtime: nodejs18.x
    Environment:
      Variables:
        REGION: eu-north-1
        USERS_TABLE: voice-matrix-users
        CALLS_TABLE: voice-matrix-calls
        ANALYTICS_TABLE: voice-matrix-analytics
        AGENTS_TABLE: voice-matrix-agents

Resources:
  # API Gateway
  VoiceMatrixApi:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Cors:
        AllowMethods: "'GET,POST,PUT,DELETE,OPTIONS'"
        AllowHeaders: "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
        AllowOrigin: "'*'"
      Auth:
        DefaultAuthorizer: CognitoAuthorizer
        Authorizers:
          CognitoAuthorizer:
            UserPoolArn: !Sub 'arn:aws:cognito-idp:${AWS::Region}:${AWS::AccountId}:userpool/eu-north-1_RvDRR8Kgr'

  # Lambda Functions
  GetDashboardData:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: dashboard.handler
      Events:
        Api:
          Type: Api
          Properties:
            RestApiId: !Ref VoiceMatrixApi
            Path: /dashboard
            Method: GET
      Policies:
        - DynamoDBReadPolicy:
            TableName: voice-matrix-calls
        - DynamoDBReadPolicy:
            TableName: voice-matrix-analytics

  GetCallLogs:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: calls.getCallLogs
      Events:
        Api:
          Type: Api
          Properties:
            RestApiId: !Ref VoiceMatrixApi
            Path: /calls
            Method: GET
      Policies:
        - DynamoDBReadPolicy:
            TableName: voice-matrix-calls

  CreateCallLog:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: calls.createCallLog
      Events:
        Api:
          Type: Api
          Properties:
            RestApiId: !Ref VoiceMatrixApi
            Path: /calls
            Method: POST
      Policies:
        - DynamoDBWritePolicy:
            TableName: voice-matrix-calls
        - DynamoDBWritePolicy:
            TableName: voice-matrix-analytics

  GetAgentConfig:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: agents.getConfig
      Events:
        Api:
          Type: Api
          Properties:
            RestApiId: !Ref VoiceMatrixApi
            Path: /agents/{agentId}
            Method: GET
      Policies:
        - DynamoDBReadPolicy:
            TableName: voice-matrix-agents

  UpdateAgentConfig:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: agents.updateConfig
      Events:
        Api:
          Type: Api
          Properties:
            RestApiId: !Ref VoiceMatrixApi
            Path: /agents/{agentId}
            Method: PUT
      Policies:
        - DynamoDBWritePolicy:
            TableName: voice-matrix-agents

Outputs:
  VoiceMatrixApiUrl:
    Description: "API Gateway endpoint URL"
    Value: !Sub "https://${VoiceMatrixApi}.execute-api.${AWS::Region}.amazonaws.com/prod/"
```

#### 1.3 Create Lambda Function Code Structure
```bash
mkdir -p src
cd src
npm init -y
npm install aws-sdk uuid
```

### Step 2: Lambda Function Implementations

#### 2.1 Dashboard Handler (`src/dashboard.js`)
```javascript
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        
        // Get today's analytics
        const today = new Date().toISOString().split('T')[0];
        const analyticsParams = {
            TableName: process.env.ANALYTICS_TABLE,
            Key: { userId, date: today }
        };
        
        const analytics = await dynamodb.get(analyticsParams).promise();
        
        // Get recent calls
        const callsParams = {
            TableName: process.env.CALLS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: { ':userId': userId },
            ScanIndexForward: false,
            Limit: 10
        };
        
        const calls = await dynamodb.query(callsParams).promise();
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                analytics: analytics.Item || {
                    totalCalls: 0,
                    successfulCalls: 0,
                    averageDuration: 0,
                    satisfactionScore: 0
                },
                recentCalls: calls.Items
            })
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

#### 2.2 Calls Handler (`src/calls.js`)
```javascript
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.getCallLogs = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const period = event.queryStringParameters?.period || 'today';
        
        let filterExpression = 'userId = :userId';
        let expressionAttributeValues = { ':userId': userId };
        
        // Add time filtering based on period
        if (period !== 'all') {
            const now = new Date();
            let startDate;
            
            switch (period) {
                case 'today':
                    startDate = new Date(now.setHours(0, 0, 0, 0));
                    break;
                case 'week':
                    startDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case 'month':
                    startDate = new Date(now.setMonth(now.getMonth() - 1));
                    break;
            }
            
            filterExpression += ' AND #timestamp >= :startDate';
            expressionAttributeValues[':startDate'] = startDate.toISOString();
        }
        
        const params = {
            TableName: process.env.CALLS_TABLE,
            KeyConditionExpression: filterExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: { '#timestamp': 'timestamp' },
            ScanIndexForward: false
        };
        
        const result = await dynamodb.query(params).promise();
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(result.Items)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.createCallLog = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const callData = JSON.parse(event.body);
        
        const callLog = {
            userId,
            callId: uuidv4(),
            timestamp: new Date().toISOString(),
            ...callData
        };
        
        // Save call log
        await dynamodb.put({
            TableName: process.env.CALLS_TABLE,
            Item: callLog
        }).promise();
        
        // Update analytics
        await updateAnalytics(userId, callLog);
        
        return {
            statusCode: 201,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(callLog)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

async function updateAnalytics(userId, callLog) {
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
        satisfactionScore: 0
    };
    
    // Update analytics
    analytics.totalCalls += 1;
    if (callLog.outcome === 'completed') {
        analytics.successfulCalls += 1;
    }
    
    // Update average duration
    const totalDuration = (analytics.averageDuration * (analytics.totalCalls - 1)) + callLog.duration;
    analytics.averageDuration = totalDuration / analytics.totalCalls;
    
    // Update satisfaction score
    if (callLog.satisfaction) {
        const totalSatisfaction = (analytics.satisfactionScore * (analytics.totalCalls - 1)) + callLog.satisfaction;
        analytics.satisfactionScore = totalSatisfaction / analytics.totalCalls;
    }
    
    await dynamodb.put({
        TableName: process.env.ANALYTICS_TABLE,
        Item: analytics
    }).promise();
}
```

#### 2.3 Agents Handler (`src/agents.js`)
```javascript
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.getConfig = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const agentId = event.pathParameters.agentId;
        
        const params = {
            TableName: process.env.AGENTS_TABLE,
            Key: { userId, agentId }
        };
        
        const result = await dynamodb.get(params).promise();
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(result.Item)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.updateConfig = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const agentId = event.pathParameters.agentId;
        const configData = JSON.parse(event.body);
        
        const agentConfig = {
            userId,
            agentId,
            updatedAt: new Date().toISOString(),
            ...configData
        };
        
        await dynamodb.put({
            TableName: process.env.AGENTS_TABLE,
            Item: agentConfig
        }).promise();
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(agentConfig)
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

### Step 3: Deploy Backend

```bash
# Build and deploy
sam build
sam deploy --guided

# Follow prompts:
# Stack Name: voice-matrix-backend
# AWS Region: eu-north-1
# Confirm changes before deploy: Y
# Allow SAM CLI IAM role creation: Y
# Save parameters to samconfig.toml: Y
```

### Step 4: Update Frontend to Use Backend

Add these environment variables to your React app:
```bash
# In .env
REACT_APP_API_URL=https://your-api-id.execute-api.eu-north-1.amazonaws.com/prod
```

## Cost Estimation

### DynamoDB (Pay-per-request):
- **Free Tier**: 25GB storage, 25 RCU, 25 WCU
- **Typical Cost**: $1-5/month for small-medium usage

### Lambda:
- **Free Tier**: 1M requests/month, 400,000 GB-seconds
- **Typical Cost**: $0-2/month for dashboard usage

### API Gateway:
- **Cost**: $3.50 per million API calls
- **Typical Cost**: $1-3/month

**Total Monthly Cost: $2-10/month** for typical usage

This setup gives you:
✅ Serverless scalability
✅ Real-time analytics
✅ Secure authentication
✅ Cost-effective operation
✅ Easy maintenance