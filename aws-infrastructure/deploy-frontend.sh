#!/bin/bash

# Voice Matrix AI Dashboard - Frontend Deployment Script
# This script builds and deploys the React frontend to AWS S3 + CloudFront

set -e

# Configuration
ENVIRONMENT=${1:-production}
REGION=${2:-us-east-1}
STACK_NAME="voice-matrix-${ENVIRONMENT}-infrastructure"

echo "🚀 Starting frontend deployment for ${ENVIRONMENT} environment..."

# Get stack outputs
echo "📋 Getting infrastructure details..."
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

if [ -z "$BUCKET_NAME" ] || [ -z "$CLOUDFRONT_ID" ]; then
  echo "❌ Error: Could not get bucket name or CloudFront distribution ID"
  echo "Make sure the infrastructure stack is deployed first"
  exit 1
fi

echo "✅ Found S3 bucket: $BUCKET_NAME"
echo "✅ Found CloudFront distribution: $CLOUDFRONT_ID"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the React app
echo "🔨 Building React application..."
if [ "$ENVIRONMENT" = "production" ]; then
  REACT_APP_ENV=production \
  REACT_APP_API_URL=https://api.voicematrix.ai \
  REACT_APP_COGNITO_REGION=$REGION \
  REACT_APP_COGNITO_USER_POOL_ID=REPLACE_WITH_COGNITO_POOL_ID \
  REACT_APP_COGNITO_CLIENT_ID=REPLACE_WITH_COGNITO_CLIENT_ID \
  npm run build
else
  REACT_APP_ENV=staging \
  REACT_APP_API_URL=https://api-staging.voicematrix.ai \
  REACT_APP_COGNITO_REGION=$REGION \
  REACT_APP_COGNITO_USER_POOL_ID=REPLACE_WITH_STAGING_COGNITO_POOL_ID \
  REACT_APP_COGNITO_CLIENT_ID=REPLACE_WITH_STAGING_COGNITO_CLIENT_ID \
  npm run build
fi

# Sync to S3
echo "☁️ Uploading to S3..."
aws s3 sync build/ s3://$BUCKET_NAME/ \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "*.html" \
  --exclude "service-worker.js" \
  --exclude "manifest.json"

# Upload HTML files with no-cache
aws s3 sync build/ s3://$BUCKET_NAME/ \
  --delete \
  --cache-control "public,max-age=0,must-revalidate" \
  --include "*.html" \
  --include "service-worker.js" \
  --include "manifest.json"

# Invalidate CloudFront cache
echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_ID \
  --paths "/*" \
  --output table

echo "✅ Frontend deployment completed successfully!"
echo "🌐 Your application will be available at:"
echo "   https://$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" \
  --output text)"

echo ""
echo "📝 Next steps:"
echo "1. Set up your custom domain and SSL certificate"
echo "2. Deploy the backend Lambda functions"
echo "3. Configure Cognito user pool"
echo "4. Update environment variables with actual values"