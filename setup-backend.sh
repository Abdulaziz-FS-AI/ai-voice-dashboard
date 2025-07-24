#!/bin/bash

echo "🚀 Setting up Voice Matrix Backend..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first."
    echo "Visit: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo "❌ SAM CLI not found. Installing..."
    pip install aws-sam-cli
fi

echo "✅ Creating project structure..."
mkdir -p backend/src
cd backend

# Create package.json
cat > src/package.json << 'EOF'
{
  "name": "voice-matrix-backend",
  "version": "1.0.0",
  "description": "Voice Matrix serverless backend",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1490.0",
    "uuid": "^9.0.1"
  }
}
EOF

# Install dependencies
cd src && npm install && cd ..

echo "✅ Creating SAM template..."
cat > template.yaml << 'EOF'
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
  VoiceMatrixApi:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Cors:
        AllowMethods: "'GET,POST,PUT,DELETE,OPTIONS'"
        AllowHeaders: "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
        AllowOrigin: "'*'"

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

Outputs:
  VoiceMatrixApiUrl:
    Description: "API Gateway endpoint URL"
    Value: !Sub "https://${VoiceMatrixApi}.execute-api.${AWS::Region}.amazonaws.com/prod/"
EOF

echo "✅ Creating Lambda functions..."
# Copy the JavaScript files from the markdown above

echo "🎯 Setup complete! Next steps:"
echo "1. Run: sam build"
echo "2. Run: sam deploy --guided"
echo "3. Update your React app's .env with the API URL"
echo ""
echo "📋 Don't forget to create DynamoDB tables first!"
echo "Run the AWS CLI commands from database-setup.md"