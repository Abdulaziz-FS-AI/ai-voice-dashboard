# Voice Matrix Database Setup Guide

## DynamoDB Tables Design

### 1. **Users Table**
```
Table Name: voice-matrix-users
Partition Key: userId (String)
Attributes:
- email (String)
- createdAt (String - ISO timestamp)
- lastLogin (String - ISO timestamp)
- subscription (String - free/premium/enterprise)
- settings (Map)
```

### 2. **Call Logs Table**
```
Table Name: voice-matrix-calls
Partition Key: userId (String)
Sort Key: callId (String)
GSI: timestamp-index (timestamp as partition key)
Attributes:
- timestamp (String - ISO timestamp)
- duration (Number - seconds)
- callerName (String)
- callerPhone (String)
- outcome (String - completed/abandoned/transferred)
- satisfaction (Number - 1-5 rating)
- responses (Map - questions and answers)
- agentId (String)
```

### 3. **Analytics Table**
```
Table Name: voice-matrix-analytics
Partition Key: userId (String)
Sort Key: date (String - YYYY-MM-DD)
Attributes:
- totalCalls (Number)
- successfulCalls (Number)
- averageDuration (Number)
- satisfactionScore (Number)
- topRequests (List)
- hourlyBreakdown (Map)
```

### 4. **Agent Configurations Table**
```
Table Name: voice-matrix-agents
Partition Key: userId (String)
Sort Key: agentId (String)
Attributes:
- name (String)
- prompt (String)
- isActive (Boolean)
- createdAt (String)
- updatedAt (String)
- configuration (Map)
```

## AWS CLI Setup Commands

```bash
# Create Users Table
aws dynamodb create-table \
    --table-name voice-matrix-users \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region eu-north-1

# Create Call Logs Table
aws dynamodb create-table \
    --table-name voice-matrix-calls \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=callId,AttributeType=S \
        AttributeName=timestamp,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=callId,KeyType=RANGE \
    --global-secondary-indexes \
        IndexName=timestamp-index,KeySchema=[{AttributeName=timestamp,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5} \
    --billing-mode PAY_PER_REQUEST \
    --region eu-north-1

# Create Analytics Table
aws dynamodb create-table \
    --table-name voice-matrix-analytics \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=date,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=date,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region eu-north-1

# Create Agent Configurations Table
aws dynamodb create-table \
    --table-name voice-matrix-agents \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=agentId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=agentId,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region eu-north-1
```