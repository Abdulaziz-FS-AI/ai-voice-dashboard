#!/bin/bash

# VAPI Webhook Infrastructure Deployment Script
# Deploys API Gateway, Lambda, and monitoring for webhook endpoints

set -e

# Configuration
PROJECT_NAME="VoiceMatrix"
REGION="us-east-1"
WEBHOOK_STACK_PREFIX="${PROJECT_NAME}-VAPI-Webhook"

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
    echo "  -s, --webhook-secret SECRET VAPI webhook secret"
    echo "  --dry-run                   Preview deployment without executing"
    echo "  -h, --help                  Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 -e dev"
    echo "  $0 -e prod -r us-west-2 -s 'my-secret-key'"
}

# Defaults
ENVIRONMENT="dev"
DRY_RUN=false
DYNAMODB_STACK=""
WEBHOOK_SECRET=""

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
        -s|--webhook-secret)
            WEBHOOK_SECRET="$2"
            shift 2
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

# Construct stack names
WEBHOOK_STACK_NAME="${WEBHOOK_STACK_PREFIX}-${ENVIRONMENT}"
if [[ -z "$DYNAMODB_STACK" ]]; then
    DYNAMODB_STACK="${PROJECT_NAME}-Enhanced-Infrastructure-${ENVIRONMENT}"
fi

# Generate webhook secret if not provided
if [[ -z "$WEBHOOK_SECRET" ]]; then
    WEBHOOK_SECRET="voice-matrix-webhook-$(date +%Y%m%d)-${ENVIRONMENT}"
    print_status "Generated webhook secret: ${WEBHOOK_SECRET:0:20}..."
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CF_DIR="$(dirname "$SCRIPT_DIR")/cloudformation"
TEMPLATE_FILE="${CF_DIR}/vapi-webhook-stack.yaml"

print_status "VAPI Webhook Infrastructure Deployment"
print_status "Environment: $ENVIRONMENT"
print_status "Region: $REGION"
print_status "Webhook Stack: $WEBHOOK_STACK_NAME"
print_status "DynamoDB Stack: $DYNAMODB_STACK"

if $DRY_RUN; then
    print_warning "DRY RUN MODE - No resources will be created"
fi

echo ""

# Validate template
if [[ ! -f "$TEMPLATE_FILE" ]]; then
    print_error "Template not found: $TEMPLATE_FILE"
    exit 1
fi

# Check AWS CLI and credentials
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not installed"
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured"
    exit 1
fi

print_success "AWS credentials validated"

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

# Check if DynamoDB stack exists
print_status "Checking DynamoDB stack existence..."
if ! aws cloudformation describe-stacks \
    --stack-name "$DYNAMODB_STACK" \
    --region "$REGION" &> /dev/null; then
    print_error "DynamoDB stack '$DYNAMODB_STACK' not found"
    print_error "Please deploy the DynamoDB infrastructure first"
    exit 1
fi

print_success "DynamoDB stack found: $DYNAMODB_STACK"

# Check if webhook stack exists
print_status "Checking webhook stack status..."
if aws cloudformation describe-stacks \
    --stack-name "$WEBHOOK_STACK_NAME" \
    --region "$REGION" &> /dev/null; then
    STACK_EXISTS=true
    STACK_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "$WEBHOOK_STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text)
    print_warning "Stack exists with status: $STACK_STATUS"
else
    STACK_EXISTS=false
    print_status "Stack does not exist - will create"
fi

# Prepare deployment parameters
PARAMETERS="ParameterKey=Environment,ParameterValue=$ENVIRONMENT"
PARAMETERS="$PARAMETERS ParameterKey=ProjectName,ParameterValue=$PROJECT_NAME"
PARAMETERS="$PARAMETERS ParameterKey=DynamoDBStackName,ParameterValue=$DYNAMODB_STACK"
PARAMETERS="$PARAMETERS ParameterKey=WebhookSecret,ParameterValue=$WEBHOOK_SECRET"

if $DRY_RUN; then
    print_status "DRY RUN - Would deploy:"
    echo "  - VAPI Webhook Lambda Function"
    echo "  - API Gateway with /webhook endpoint"
    echo "  - CloudWatch monitoring and alarms"
    echo "  - EventBridge for real-time analytics"
    echo "  - Secrets Manager for webhook security"
    echo "  - Dead Letter Queue for error handling"
    echo ""
    echo "Parameters:"
    echo "  Environment: $ENVIRONMENT"
    echo "  DynamoDB Stack: $DYNAMODB_STACK"
    echo "  Webhook Secret: ${WEBHOOK_SECRET:0:20}..."
    exit 0
fi

# Package Lambda code (simplified - in production use proper build process)
print_status "Preparing Lambda deployment package..."
LAMBDA_DIR="${SCRIPT_DIR}/../backend-lambda"
BUILD_DIR="${LAMBDA_DIR}/build"
ZIP_FILE="${BUILD_DIR}/vapi-webhook.zip"

mkdir -p "$BUILD_DIR"

# Copy source files
cp -r "${LAMBDA_DIR}/src" "${BUILD_DIR}/"
cp "${LAMBDA_DIR}/package.json" "${BUILD_DIR}/"

# Create deployment package
cd "$BUILD_DIR"
if [[ -f package.json ]]; then
    # In production, you'd run npm install and build here
    print_status "Creating deployment package..."
fi

# For now, just zip the TypeScript files (in production, compile first)
zip -r "$ZIP_FILE" src/ package.json > /dev/null 2>&1
cd - > /dev/null

print_success "Deployment package created: $ZIP_FILE"

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
    CHANGE_SET_NAME="${WEBHOOK_STACK_NAME}-changeset-$(date +%Y%m%d-%H%M%S)"
    
    aws cloudformation create-change-set \
        --stack-name "$WEBHOOK_STACK_NAME" \
        --change-set-name "$CHANGE_SET_NAME" \
        --template-body file://"$TEMPLATE_FILE" \
        --parameters $PARAMETERS \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "$REGION" > /dev/null
    
    print_status "Waiting for change set creation..."
    aws cloudformation wait change-set-create-complete \
        --stack-name "$WEBHOOK_STACK_NAME" \
        --change-set-name "$CHANGE_SET_NAME" \
        --region "$REGION"
    
    # Show changes
    print_status "Change set summary:"
    aws cloudformation describe-change-set \
        --stack-name "$WEBHOOK_STACK_NAME" \
        --change-set-name "$CHANGE_SET_NAME" \
        --region "$REGION" \
        --query 'Changes[].{Action:Action,Resource:ResourceChange.LogicalResourceId,Type:ResourceChange.ResourceType}' \
        --output table
    
    echo ""
    read -p "Execute change set? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        aws cloudformation execute-change-set \
            --stack-name "$WEBHOOK_STACK_NAME" \
            --change-set-name "$CHANGE_SET_NAME" \
            --region "$REGION"
        OPERATION="update"
    else
        print_warning "Cancelled"
        aws cloudformation delete-change-set \
            --stack-name "$WEBHOOK_STACK_NAME" \
            --change-set-name "$CHANGE_SET_NAME" \
            --region "$REGION"
        exit 0
    fi
else
    print_status "Creating new stack..."
    aws cloudformation create-stack \
        --stack-name "$WEBHOOK_STACK_NAME" \
        --template-body file://"$TEMPLATE_FILE" \
        --parameters $PARAMETERS \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "$REGION" > /dev/null
    OPERATION="create"
fi

# Wait for completion
print_status "Waiting for stack $OPERATION to complete..."
if [[ $OPERATION == "create" ]]; then
    aws cloudformation wait stack-create-complete \
        --stack-name "$WEBHOOK_STACK_NAME" \
        --region "$REGION"
else
    aws cloudformation wait stack-update-complete \
        --stack-name "$WEBHOOK_STACK_NAME" \
        --region "$REGION"
fi

# Check final status
FINAL_STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$WEBHOOK_STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text)

if [[ $FINAL_STATUS == *"COMPLETE" && $FINAL_STATUS != *"ROLLBACK"* ]]; then
    print_success "Webhook infrastructure deployed successfully!"
    
    echo ""
    print_status "Stack Outputs:"
    aws cloudformation describe-stacks \
        --stack-name "$WEBHOOK_STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue}' \
        --output table
    
    # Get webhook URL
    WEBHOOK_URL=$(aws cloudformation describe-stacks \
        --stack-name "$WEBHOOK_STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`WebhookAPIURL`].OutputValue' \
        --output text)
    
    echo ""
    print_success "🎯 VAPI Webhook Endpoint Ready!"
    print_status "Webhook URL: $WEBHOOK_URL"
    print_status "Configure this URL in your VAPI assistant settings"
    
    echo ""
    print_status "✅ Webhook Features Deployed:"
    echo "  • Real-time call data processing (duration, transcript, summary, status)"
    echo "  • Business intelligence analytics"
    echo "  • Template performance tracking"
    echo "  • CloudWatch monitoring and alerts"
    echo "  • Error handling with Dead Letter Queue"
    echo "  • EventBridge for real-time analytics pipeline"
    
    # Update environment file
    ENV_FILE="${SCRIPT_DIR}/../.env.${ENVIRONMENT}"
    if [[ -f "$ENV_FILE" ]]; then
        echo "" >> "$ENV_FILE"
        echo "# VAPI Webhook Configuration" >> "$ENV_FILE"
        echo "WEBHOOK_URL=$WEBHOOK_URL" >> "$ENV_FILE"
        echo "WEBHOOK_STACK_NAME=$WEBHOOK_STACK_NAME" >> "$ENV_FILE"
        print_success "Environment file updated: $ENV_FILE"
    fi
    
else
    print_error "Deployment failed with status: $FINAL_STATUS"
    
    print_status "Recent stack events:"
    aws cloudformation describe-stack-events \
        --stack-name "$WEBHOOK_STACK_NAME" \
        --region "$REGION" \
        --query 'StackEvents[0:5].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' \
        --output table
    
    exit 1
fi