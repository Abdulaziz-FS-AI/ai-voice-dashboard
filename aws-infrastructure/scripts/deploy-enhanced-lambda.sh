#!/bin/bash

# Enhanced Lambda Deployment Script for Voice Matrix
# Deploys the enhanced template system with advanced API capabilities

set -e

# Configuration
PROJECT_NAME="VoiceMatrix"
REGION="us-east-1"
LAMBDA_STACK_PREFIX="${PROJECT_NAME}-Enhanced-Lambda"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV       Environment (dev|staging|prod) [default: dev]"
    echo "  -r, --region REGION         AWS region [default: us-east-1]"
    echo "  -d, --dynamodb-stack NAME   DynamoDB stack name to reference"
    echo "  -v, --vapi-secret NAME      VAPI secret name in Secrets Manager"
    echo "  -j, --jwt-secret SECRET     JWT secret for authentication"
    echo "  --build                     Build TypeScript before deployment"
    echo "  --dry-run                   Preview deployment without executing"
    echo "  -h, --help                  Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 -e dev --build"
    echo "  $0 -e prod -r us-west-2 --jwt-secret 'my-secret'"
}

# Defaults
ENVIRONMENT="dev"
DRY_RUN=false
BUILD_TS=false
DYNAMODB_STACK=""
VAPI_SECRET=""
JWT_SECRET=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -d|--dynamodb-stack)
            DYNAMODB_STACK="$2"
            shift 2
            ;;
        -v|--vapi-secret)
            VAPI_SECRET="$2"
            shift 2
            ;;
        -j|--jwt-secret)
            JWT_SECRET="$2"
            shift 2
            ;;
        --build)
            BUILD_TS=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    exit 1
fi

# Set defaults
LAMBDA_STACK_NAME="${LAMBDA_STACK_PREFIX}-${ENVIRONMENT}"
if [[ -z "$DYNAMODB_STACK" ]]; then
    DYNAMODB_STACK="${PROJECT_NAME}-Enhanced-Infrastructure-${ENVIRONMENT}"
fi
if [[ -z "$VAPI_SECRET" ]]; then
    VAPI_SECRET="${PROJECT_NAME}/vapi-api-key"
fi
if [[ -z "$JWT_SECRET" ]]; then
    JWT_SECRET="voice-matrix-jwt-$(date +%Y%m%d)-${ENVIRONMENT}"
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
LAMBDA_DIR="${SCRIPT_DIR}/../backend-lambda"
CF_DIR="$(dirname "$SCRIPT_DIR")/cloudformation"
TEMPLATE_FILE="${CF_DIR}/enhanced-lambda-stack.yaml"

print_status "Enhanced Lambda Deployment for Voice Matrix"
print_status "Environment: $ENVIRONMENT"
print_status "Region: $REGION"
print_status "Lambda Stack: $LAMBDA_STACK_NAME"
print_status "DynamoDB Stack: $DYNAMODB_STACK"
print_status "Build TypeScript: $BUILD_TS"

if $DRY_RUN; then
    print_warning "DRY RUN MODE - No resources will be created"
fi

echo ""

# Validate prerequisites
if [[ ! -f "$TEMPLATE_FILE" ]]; then
    print_error "Template not found: $TEMPLATE_FILE"
    exit 1
fi

if [[ ! -d "$LAMBDA_DIR" ]]; then
    print_error "Lambda directory not found: $LAMBDA_DIR"
    exit 1
fi

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not installed"
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured"
    exit 1
fi

print_success "AWS credentials validated"

# Check Node.js and npm if building
if $BUILD_TS; then
    if ! command -v node &> /dev/null; then
        print_error "Node.js not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm not installed"
        exit 1
    fi
    
    print_success "Node.js build tools available"
fi

# Validate CloudFormation template
print_status "Validating CloudFormation template..."
if aws cloudformation validate-template \
    --template-body file://"$TEMPLATE_FILE" \
    --region "$REGION" &> /dev/null; then
    print_success "Template is valid"
else
    print_error "Template validation failed"
    exit 1
fi

# Check DynamoDB stack
print_status "Checking DynamoDB stack..."
if ! aws cloudformation describe-stacks \
    --stack-name "$DYNAMODB_STACK" \
    --region "$REGION" &> /dev/null; then
    print_error "DynamoDB stack '$DYNAMODB_STACK' not found"
    exit 1
fi
print_success "DynamoDB stack found"

# Check Lambda stack status
if aws cloudformation describe-stacks \
    --stack-name "$LAMBDA_STACK_NAME" \
    --region "$REGION" &> /dev/null; then
    STACK_EXISTS=true
    STACK_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "$LAMBDA_STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text)
    print_warning "Stack exists with status: $STACK_STATUS"
else
    STACK_EXISTS=false
    print_status "Stack does not exist - will create"
fi

# Prepare Lambda deployment package
print_status "Preparing Lambda deployment package..."
BUILD_DIR="${LAMBDA_DIR}/build"
DIST_DIR="${BUILD_DIR}/dist"
ZIP_FILE="${BUILD_DIR}/enhanced-lambda.zip"

# Clean and create build directory
rm -rf "$BUILD_DIR"
mkdir -p "$DIST_DIR"

# Copy source files
print_status "Copying source files..."
cp -r "${LAMBDA_DIR}/src" "${DIST_DIR}/"
cp "${LAMBDA_DIR}/package.json" "${DIST_DIR}/"

# Create package.json for production dependencies
cat > "${DIST_DIR}/package.json" << EOF
{
  "name": "voice-matrix-enhanced-lambda",
  "version": "1.0.0",
  "description": "Enhanced Lambda functions for Voice Matrix",
  "main": "index.js",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.400.0",
    "@aws-sdk/lib-dynamodb": "^3.400.0",
    "@aws-sdk/client-secrets-manager": "^3.400.0",
    "@aws-sdk/client-eventbridge": "^3.400.0",
    "jsonwebtoken": "^9.0.0",
    "uuid": "^9.0.0",
    "axios": "^1.5.0"
  }
}
EOF

cd "$DIST_DIR"

# Build TypeScript if requested
if $BUILD_TS; then
    print_status "Building TypeScript..."
    
    # Install TypeScript compiler
    npm install --save-dev typescript @types/node @types/aws-lambda
    
    # Create tsconfig.json
    cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./js",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
EOF
    
    # Compile TypeScript
    npx tsc
    
    # Move compiled files to root
    cp -r js/* .
    rm -rf js src tsconfig.json
    
    print_success "TypeScript compilation completed"
else
    print_status "Skipping TypeScript build - using source files directly"
    # For development, just rename .ts to .js (not ideal but works for demo)
    find src -name "*.ts" -exec bash -c 'cp "$1" "${1%.ts}.js"' _ {} \;
fi

# Install production dependencies
print_status "Installing production dependencies..."
npm install --only=production --silent

# Create deployment zip
print_status "Creating deployment package..."
zip -r "$ZIP_FILE" . -x "*.ts" "tsconfig.json" > /dev/null 2>&1

cd - > /dev/null

ZIP_SIZE=$(du -h "$ZIP_FILE" | cut -f1)
print_success "Deployment package created: $ZIP_FILE ($ZIP_SIZE)"

# Upload to S3 (Lambda packages > 50MB need S3)
S3_BUCKET="${PROJECT_NAME,,}-lambda-deployments-${ENVIRONMENT}-$(aws sts get-caller-identity --query Account --output text)"
S3_KEY="enhanced-lambda/$(date +%Y%m%d-%H%M%S)/enhanced-lambda.zip"

print_status "Uploading deployment package to S3..."

# Create S3 bucket if it doesn't exist
if ! aws s3 ls "s3://$S3_BUCKET" &> /dev/null; then
    print_status "Creating S3 bucket: $S3_BUCKET"
    if [[ "$REGION" == "us-east-1" ]]; then
        aws s3 mb "s3://$S3_BUCKET" --region "$REGION"
    else
        aws s3 mb "s3://$S3_BUCKET" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION"
    fi
fi

# Upload zip file
aws s3 cp "$ZIP_FILE" "s3://$S3_BUCKET/$S3_KEY" --region "$REGION"
print_success "Deployment package uploaded to s3://$S3_BUCKET/$S3_KEY"

# Update CloudFormation template with S3 location
TEMP_TEMPLATE="${BUILD_DIR}/enhanced-lambda-stack-updated.yaml"
cp "$TEMPLATE_FILE" "$TEMP_TEMPLATE"

# Replace Code.ZipFile with S3 location
sed -i.bak "s|Code:.*ZipFile:.*|Code:\n        S3Bucket: $S3_BUCKET\n        S3Key: $S3_KEY|g" "$TEMP_TEMPLATE"

# Prepare deployment parameters
PARAMETERS="ParameterKey=Environment,ParameterValue=$ENVIRONMENT"
PARAMETERS="$PARAMETERS ParameterKey=ProjectName,ParameterValue=$PROJECT_NAME"
PARAMETERS="$PARAMETERS ParameterKey=DynamoDBStackName,ParameterValue=$DYNAMODB_STACK"
PARAMETERS="$PARAMETERS ParameterKey=VAPISecretName,ParameterValue=$VAPI_SECRET"
PARAMETERS="$PARAMETERS ParameterKey=JWTSecret,ParameterValue=$JWT_SECRET"

if $DRY_RUN; then
    print_status "DRY RUN - Would deploy:"
    echo "  - Enhanced Assistants Lambda with advanced template system"
    echo "  - Auth Lambda with JWT authentication"
    echo "  - API Gateway with CORS-enabled endpoints"
    echo "  - CloudWatch monitoring and alarms"
    echo "  - Shared dependencies layer"
    echo "  - Secrets Manager for JWT and VAPI keys"
    echo ""
    echo "API Endpoints:"
    echo "  - POST /auth (authentication)"
    echo "  - GET /assistants/templates (enhanced templates)"
    echo "  - POST /assistants/templates/search (template search)"
    echo "  - GET /assistants/templates/popular (popular templates)"
    echo "  - POST /assistants/templates/validate (template validation)"
    echo "  - POST /assistants/create (create enhanced assistant)"
    echo "  - POST /assistants/deploy (deploy to VAPI)"
    exit 0
fi

# Deploy stack
if $STACK_EXISTS; then
    print_status "Updating existing stack..."
    
    case $STACK_STATUS in
        CREATE_COMPLETE|UPDATE_COMPLETE|UPDATE_ROLLBACK_COMPLETE)
            ;;
        *)
            print_error "Stack in non-updatable state: $STACK_STATUS"
            exit 1
            ;;
    esac
    
    # Create change set
    CHANGE_SET_NAME="${LAMBDA_STACK_NAME}-changeset-$(date +%Y%m%d-%H%M%S)"
    
    aws cloudformation create-change-set \
        --stack-name "$LAMBDA_STACK_NAME" \
        --change-set-name "$CHANGE_SET_NAME" \
        --template-body file://"$TEMP_TEMPLATE" \
        --parameters $PARAMETERS \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "$REGION" > /dev/null
    
    print_status "Waiting for change set creation..."
    aws cloudformation wait change-set-create-complete \
        --stack-name "$LAMBDA_STACK_NAME" \
        --change-set-name "$CHANGE_SET_NAME" \
        --region "$REGION"
    
    # Show changes
    print_status "Change set summary:"
    aws cloudformation describe-change-set \
        --stack-name "$LAMBDA_STACK_NAME" \
        --change-set-name "$CHANGE_SET_NAME" \
        --region "$REGION" \
        --query 'Changes[].{Action:Action,Resource:ResourceChange.LogicalResourceId,Type:ResourceChange.ResourceType}' \
        --output table
    
    echo ""
    read -p "Execute change set? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        aws cloudformation execute-change-set \
            --stack-name "$LAMBDA_STACK_NAME" \
            --change-set-name "$CHANGE_SET_NAME" \
            --region "$REGION"
        OPERATION="update"
    else
        print_warning "Cancelled"
        aws cloudformation delete-change-set \
            --stack-name "$LAMBDA_STACK_NAME" \
            --change-set-name "$CHANGE_SET_NAME" \
            --region "$REGION"
        exit 0
    fi
else
    print_status "Creating new stack..."
    aws cloudformation create-stack \
        --stack-name "$LAMBDA_STACK_NAME" \
        --template-body file://"$TEMP_TEMPLATE" \
        --parameters $PARAMETERS \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "$REGION" > /dev/null
    OPERATION="create"
fi

# Wait for completion
print_status "Waiting for stack $OPERATION to complete..."
if [[ $OPERATION == "create" ]]; then
    aws cloudformation wait stack-create-complete \
        --stack-name "$LAMBDA_STACK_NAME" \
        --region "$REGION"
else
    aws cloudformation wait stack-update-complete \
        --stack-name "$LAMBDA_STACK_NAME" \
        --region "$REGION"
fi

# Check final status
FINAL_STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$LAMBDA_STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text)

if [[ $FINAL_STATUS == *"COMPLETE" && $FINAL_STATUS != *"ROLLBACK"* ]]; then
    print_success "Enhanced Lambda deployment completed successfully!"
    
    echo ""
    print_status "Stack Outputs:"
    aws cloudformation describe-stacks \
        --stack-name "$LAMBDA_STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue}' \
        --output table
    
    # Get API URL
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name "$LAMBDA_STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`EnhancedAPIURL`].OutputValue' \
        --output text)
    
    echo ""
    print_success "🚀 Enhanced API Deployed Successfully!"
    print_status "API Base URL: $API_URL"
    
    echo ""
    print_status "✅ Enhanced Features Deployed:"
    echo "  • Advanced template system with 5 strategic templates"
    echo "  • Business context and industry classification"
    echo "  • Template validation and scoring"
    echo "  • Advanced template search and filtering"
    echo "  • Template analytics and performance tracking"
    echo "  • Enhanced VAPI integration with business rules"
    echo "  • Real-time conversation analysis"
    echo "  • Comprehensive error handling and monitoring"
    
    echo ""
    print_status "🔗 API Endpoints Ready:"
    echo "  • $API_URL/auth (Authentication)"
    echo "  • $API_URL/assistants/templates (Enhanced Templates)"
    echo "  • $API_URL/assistants/templates/search (Template Search)"
    echo "  • $API_URL/assistants/templates/popular (Popular Templates)"
    echo "  • $API_URL/assistants/create (Create Enhanced Assistant)"
    echo "  • $API_URL/assistants/deploy (Deploy to VAPI)"
    
    # Update environment file
    ENV_FILE="${SCRIPT_DIR}/../.env.${ENVIRONMENT}"
    if [[ -f "$ENV_FILE" ]]; then
        echo "" >> "$ENV_FILE"
        echo "# Enhanced Lambda Configuration" >> "$ENV_FILE"
        echo "ENHANCED_API_URL=$API_URL" >> "$ENV_FILE"
        echo "LAMBDA_STACK_NAME=$LAMBDA_STACK_NAME" >> "$ENV_FILE"
        print_success "Environment file updated: $ENV_FILE"
    fi
    
else
    print_error "Deployment failed with status: $FINAL_STATUS"
    
    print_status "Recent stack events:"
    aws cloudformation describe-stack-events \
        --stack-name "$LAMBDA_STACK_NAME" \
        --region "$REGION" \
        --query 'StackEvents[0:5].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' \
        --output table
    
    exit 1
fi