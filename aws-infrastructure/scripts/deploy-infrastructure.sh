#!/bin/bash

# Voice Matrix Enhanced Infrastructure Deployment Script
# Deploys DynamoDB tables and supporting infrastructure

set -e  # Exit on any error

# Configuration
PROJECT_NAME="VoiceMatrix"
REGION="us-east-1"  # Default region
STACK_NAME_PREFIX="${PROJECT_NAME}-Enhanced-Infrastructure"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -e, --environment ENV    Environment to deploy (dev|staging|prod) [default: dev]"
    echo "  -r, --region REGION      AWS region [default: us-east-1]"
    echo "  -p, --project NAME       Project name [default: VoiceMatrix]"
    echo "  -d, --dry-run           Show what would be deployed without executing"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e dev                    Deploy to dev environment"
    echo "  $0 -e prod -r us-west-2      Deploy to prod in us-west-2"
    echo "  $0 --dry-run -e staging      Preview staging deployment"
}

# Default values
ENVIRONMENT="dev"
DRY_RUN=false

# Parse command line arguments
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
        -p|--project)
            PROJECT_NAME="$2"
            shift 2
            ;;
        -d|--dry-run)
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
    print_error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or prod."
    exit 1
fi

# Construct stack name
STACK_NAME="${STACK_NAME_PREFIX}-${ENVIRONMENT}"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLOUDFORMATION_DIR="$(dirname "$SCRIPT_DIR")/cloudformation"
TEMPLATE_FILE="${CLOUDFORMATION_DIR}/enhanced-dynamodb-stack.yaml"

# Validate CloudFormation template exists
if [[ ! -f "$TEMPLATE_FILE" ]]; then
    print_error "CloudFormation template not found: $TEMPLATE_FILE"
    exit 1
fi

print_status "Starting Voice Matrix Infrastructure Deployment"
print_status "Environment: $ENVIRONMENT"
print_status "Region: $REGION"
print_status "Stack Name: $STACK_NAME"
print_status "Template: $TEMPLATE_FILE"

if $DRY_RUN; then
    print_warning "DRY RUN MODE - No resources will be created"
fi

echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
print_status "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
CURRENT_REGION=$(aws configure get region 2>/dev/null || echo "us-east-1")

print_success "AWS credentials validated"
print_status "Account ID: $ACCOUNT_ID"
print_status "Current Region: $CURRENT_REGION"

if [[ "$CURRENT_REGION" != "$REGION" ]]; then
    print_warning "Deploying to $REGION but AWS CLI default region is $CURRENT_REGION"
fi

echo ""

# Validate CloudFormation template
print_status "Validating CloudFormation template..."
if aws cloudformation validate-template \
    --template-body file://"$TEMPLATE_FILE" \
    --region "$REGION" &> /dev/null; then
    print_success "CloudFormation template is valid"
else
    print_error "CloudFormation template validation failed"
    exit 1
fi

# Check if stack exists
print_status "Checking if stack exists..."
if aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" &> /dev/null; then
    STACK_EXISTS=true
    STACK_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text)
    print_warning "Stack $STACK_NAME already exists with status: $STACK_STATUS"
else
    STACK_EXISTS=false
    print_status "Stack $STACK_NAME does not exist - will create new stack"
fi

echo ""

if $DRY_RUN; then
    print_status "DRY RUN - Would execute the following:"
    if $STACK_EXISTS; then
        echo "  - Update existing stack: $STACK_NAME"
    else
        echo "  - Create new stack: $STACK_NAME"
    fi
    echo "  - Deploy 5 DynamoDB tables with enhanced schema"
    echo "  - Create IAM roles and policies"
    echo "  - Set up CloudWatch monitoring and alarms"
    echo "  - Configure Point-in-Time Recovery for all tables"
    exit 0
fi

# Deployment parameters
PARAMETERS="ParameterKey=Environment,ParameterValue=$ENVIRONMENT"
PARAMETERS="$PARAMETERS ParameterKey=ProjectName,ParameterValue=$PROJECT_NAME"

# Deploy or update stack
if $STACK_EXISTS; then
    print_status "Updating existing stack..."
    
    # Check if stack is in a updatable state
    case $STACK_STATUS in
        CREATE_COMPLETE|UPDATE_COMPLETE|UPDATE_ROLLBACK_COMPLETE)
            print_status "Stack is in updatable state: $STACK_STATUS"
            ;;
        *)
            print_error "Stack is in non-updatable state: $STACK_STATUS"
            print_error "Please wait for stack operations to complete or fix the stack manually"
            exit 1
            ;;
    esac
    
    # Execute update
    CHANGE_SET_NAME="${STACK_NAME}-changeset-$(date +%Y%m%d-%H%M%S)"
    
    print_status "Creating change set: $CHANGE_SET_NAME"
    aws cloudformation create-change-set \
        --stack-name "$STACK_NAME" \
        --change-set-name "$CHANGE_SET_NAME" \
        --template-body file://"$TEMPLATE_FILE" \
        --parameters $PARAMETERS \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "$REGION" > /dev/null
    
    print_status "Waiting for change set to be created..."
    aws cloudformation wait change-set-create-complete \
        --stack-name "$STACK_NAME" \
        --change-set-name "$CHANGE_SET_NAME" \
        --region "$REGION"
    
    # Show changes
    print_status "Change set summary:"
    aws cloudformation describe-change-set \
        --stack-name "$STACK_NAME" \
        --change-set-name "$CHANGE_SET_NAME" \
        --region "$REGION" \
        --query 'Changes[].{Action:Action,Resource:ResourceChange.LogicalResourceId,Type:ResourceChange.ResourceType}' \
        --output table
    
    echo ""
    read -p "Do you want to execute this change set? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        print_status "Executing change set..."
        aws cloudformation execute-change-set \
            --stack-name "$STACK_NAME" \
            --change-set-name "$CHANGE_SET_NAME" \
            --region "$REGION"
        
        OPERATION="update"
    else
        print_warning "Change set execution cancelled"
        print_status "Deleting change set..."
        aws cloudformation delete-change-set \
            --stack-name "$STACK_NAME" \
            --change-set-name "$CHANGE_SET_NAME" \
            --region "$REGION"
        exit 0
    fi
else
    print_status "Creating new stack..."
    aws cloudformation create-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://"$TEMPLATE_FILE" \
        --parameters $PARAMETERS \
        --capabilities CAPABILITY_NAMED_IAM \
        --enable-termination-protection \
        --region "$REGION" > /dev/null
    
    OPERATION="create"
fi

# Wait for stack operation to complete
print_status "Waiting for stack $OPERATION to complete..."
echo "This may take several minutes..."

if [[ $OPERATION == "create" ]]; then
    aws cloudformation wait stack-create-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
else
    aws cloudformation wait stack-update-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
fi

# Check final status
FINAL_STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text)

if [[ $FINAL_STATUS == *"COMPLETE" && $FINAL_STATUS != *"ROLLBACK"* ]]; then
    print_success "Stack $OPERATION completed successfully!"
    print_success "Final status: $FINAL_STATUS"
    
    echo ""
    print_status "Stack Outputs:"
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue,Description:Description}' \
        --output table
    
    echo ""
    print_success "Enhanced DynamoDB infrastructure deployed successfully!"
    print_status "Next steps:"
    echo "  1. Update Lambda environment variables with new table names"
    echo "  2. Deploy webhook endpoints for VAPI integration"
    echo "  3. Initialize database with strategic templates"
    echo ""
    
    # Create environment file with table names
    ENV_FILE="${SCRIPT_DIR}/../.env.${ENVIRONMENT}"
    print_status "Creating environment file: $ENV_FILE"
    
    cat > "$ENV_FILE" << EOF
# Voice Matrix Enhanced Infrastructure Environment Variables
# Generated on $(date)
# Stack: $STACK_NAME
# Region: $REGION

ENVIRONMENT=$ENVIRONMENT
PROJECT_NAME=$PROJECT_NAME
REGION=$REGION
STACK_NAME=$STACK_NAME

# DynamoDB Table Names
PROMPT_TEMPLATES_TABLE=${PROJECT_NAME}-PromptTemplates-${ENVIRONMENT}
USER_ASSISTANTS_TABLE=${PROJECT_NAME}-UserAssistants-${ENVIRONMENT}
CALL_LOGS_TABLE=${PROJECT_NAME}-CallLogs-${ENVIRONMENT}
TEMPLATE_ANALYTICS_TABLE=${PROJECT_NAME}-TemplateAnalytics-${ENVIRONMENT}
USER_SESSIONS_TABLE=${PROJECT_NAME}-UserSessions-${ENVIRONMENT}

# IAM Role ARN (for Lambda functions)
DYNAMODB_ACCESS_ROLE_ARN=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" --query 'Stacks[0].Outputs[?OutputKey==`DynamoDBAccessRoleArn`].OutputValue' --output text)
EOF
    
    print_success "Environment file created: $ENV_FILE"
    
else
    print_error "Stack $OPERATION failed!"
    print_error "Final status: $FINAL_STATUS"
    
    print_status "Stack events (last 10):"
    aws cloudformation describe-stack-events \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'StackEvents[0:9].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' \
        --output table
    
    exit 1
fi