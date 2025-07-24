#!/bin/bash

echo "🚀 Manual Deployment Script for Voice Matrix Backend"
echo "This script will create Lambda functions manually using AWS CLI"

# Variables
REGION="eu-north-1"
FUNCTION_RUNTIME="nodejs18.x"
FUNCTION_TIMEOUT="30"

# Create a deployment directory
mkdir -p deployment
cd deployment

echo "📦 Creating Lambda deployment packages..."

# Function 1: VAPI Assistants
mkdir -p vapi-assistants
cp ../src/vapi-assistants.js vapi-assistants/index.js
cp ../src/package.json vapi-assistants/
cd vapi-assistants
npm install --production
zip -r ../vapi-assistants.zip .
cd ..

# Function 2: VAPI Webhook
mkdir -p vapi-webhook
cp ../src/vapi-webhook.js vapi-webhook/index.js
cp ../src/package.json vapi-webhook/
cd vapi-webhook
npm install --production
zip -r ../vapi-webhook.zip .
cd ..

# Function 3: VAPI Sync
mkdir -p vapi-sync
cp ../src/vapi-sync.js vapi-sync/index.js
cp ../src/package.json vapi-sync/
cd vapi-sync
npm install --production
zip -r ../vapi-sync.zip .
cd ..

# Function 4: User Management
mkdir -p user-management
cp ../src/user-management.js user-management/index.js
cp ../src/package.json user-management/
cd user-management
npm install --production
zip -r ../user-management.zip .
cd ..

echo "✅ Deployment packages created!"
echo "📋 Next steps:"
echo "1. Create IAM role for Lambda functions"
echo "2. Create Lambda functions"
echo "3. Create API Gateway"
echo "4. Configure permissions"

# Create IAM role for Lambda
echo "🔐 Creating IAM role..."

# Trust policy for Lambda
cat > lambda-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
    --role-name VoiceMatrixLambdaRole \
    --assume-role-policy-document file://lambda-trust-policy.json \
    --region $REGION

# Attach basic Lambda execution policy
aws iam attach-role-policy \
    --role-name VoiceMatrixLambdaRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create custom policy for DynamoDB access
cat > dynamodb-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-north-1:*:table/voice-matrix-*"
      ]
    }
  ]
}
EOF

aws iam create-policy \
    --policy-name VoiceMatrixDynamoDBPolicy \
    --policy-document file://dynamodb-policy.json

# Get account ID for policy ARN
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Attach DynamoDB policy
aws iam attach-role-policy \
    --role-name VoiceMatrixLambdaRole \
    --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/VoiceMatrixDynamoDBPolicy

echo "⏳ Waiting 10 seconds for IAM role to propagate..."
sleep 10

# Create Lambda functions
echo "🚀 Creating Lambda functions..."

# Function 1: VAPI Assistants
aws lambda create-function \
    --function-name voice-matrix-vapi-assistants \
    --runtime $FUNCTION_RUNTIME \
    --role arn:aws:iam::${ACCOUNT_ID}:role/VoiceMatrixLambdaRole \
    --handler index.getAssistants \
    --zip-file fileb://vapi-assistants.zip \
    --timeout $FUNCTION_TIMEOUT \
    --environment Variables='{REGION=eu-north-1,USERS_TABLE=voice-matrix-users,CALLS_TABLE=voice-matrix-calls,ANALYTICS_TABLE=voice-matrix-analytics,VAPI_SYNC_TABLE=voice-matrix-vapi-sync}' \
    --region $REGION

# Function 2: VAPI Webhook
aws lambda create-function \
    --function-name voice-matrix-vapi-webhook \
    --runtime $FUNCTION_RUNTIME \
    --role arn:aws:iam::${ACCOUNT_ID}:role/VoiceMatrixLambdaRole \
    --handler index.handleWebhook \
    --zip-file fileb://vapi-webhook.zip \
    --timeout $FUNCTION_TIMEOUT \
    --environment Variables='{REGION=eu-north-1,USERS_TABLE=voice-matrix-users,CALLS_TABLE=voice-matrix-calls,ANALYTICS_TABLE=voice-matrix-analytics,VAPI_SYNC_TABLE=voice-matrix-vapi-sync}' \
    --region $REGION

# Function 3: VAPI Sync
aws lambda create-function \
    --function-name voice-matrix-vapi-sync \
    --runtime $FUNCTION_RUNTIME \
    --role arn:aws:iam::${ACCOUNT_ID}:role/VoiceMatrixLambdaRole \
    --handler index.syncVapiData \
    --zip-file fileb://vapi-sync.zip \
    --timeout $FUNCTION_TIMEOUT \
    --environment Variables='{REGION=eu-north-1,USERS_TABLE=voice-matrix-users,CALLS_TABLE=voice-matrix-calls,ANALYTICS_TABLE=voice-matrix-analytics,VAPI_SYNC_TABLE=voice-matrix-vapi-sync}' \
    --region $REGION

# Function 4: User Management
aws lambda create-function \
    --function-name voice-matrix-user-management \
    --runtime $FUNCTION_RUNTIME \
    --role arn:aws:iam::${ACCOUNT_ID}:role/VoiceMatrixLambdaRole \
    --handler index.getUserProfile \
    --zip-file fileb://user-management.zip \
    --timeout $FUNCTION_TIMEOUT \
    --environment Variables='{REGION=eu-north-1,USERS_TABLE=voice-matrix-users,CALLS_TABLE=voice-matrix-calls,ANALYTICS_TABLE=voice-matrix-analytics,VAPI_SYNC_TABLE=voice-matrix-vapi-sync}' \
    --region $REGION

echo "✅ Lambda functions created!"
echo ""
echo "🌐 Now we need to create API Gateway..."
echo "📧 Please run the API Gateway creation script next."

cd ..