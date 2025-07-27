#!/bin/bash

# Analytics Pipeline Deployment Script for Voice Matrix
# Deploys real-time analytics processing with EventBridge and Kinesis

set -e

# Configuration
PROJECT_NAME="VoiceMatrix"
REGION="us-east-1"
ANALYTICS_STACK_PREFIX="${PROJECT_NAME}-Analytics-Pipeline"

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
    echo "  -a, --alert-email EMAIL     Email for analytics alerts"
    echo "  --dry-run                   Preview deployment without executing"
    echo "  -h, --help                  Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 -e dev"
    echo "  $0 -e prod -a 'admin@company.com'"
}

# Defaults
ENVIRONMENT="dev"
DRY_RUN=false
DYNAMODB_STACK=""
ALERT_EMAIL=""

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
        -a|--alert-email)
            ALERT_EMAIL="$2"
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

# Set defaults
ANALYTICS_STACK_NAME="${ANALYTICS_STACK_PREFIX}-${ENVIRONMENT}"
if [[ -z "$DYNAMODB_STACK" ]]; then
    DYNAMODB_STACK="${PROJECT_NAME}-Enhanced-Infrastructure-${ENVIRONMENT}"
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CF_DIR="$(dirname "$SCRIPT_DIR")/cloudformation"
TEMPLATE_FILE="${CF_DIR}/analytics-pipeline-stack.yaml"

print_status "Analytics Pipeline Deployment for Voice Matrix"
print_status "Environment: $ENVIRONMENT"
print_status "Region: $REGION"
print_status "Analytics Stack: $ANALYTICS_STACK_NAME"
print_status "DynamoDB Stack: $DYNAMODB_STACK"

if [[ -n "$ALERT_EMAIL" ]]; then
    print_status "Alert Email: $ALERT_EMAIL"
fi

if $DRY_RUN; then
    print_warning "DRY RUN MODE - No resources will be created"
fi

echo ""

# Validate prerequisites
if [[ ! -f "$TEMPLATE_FILE" ]]; then
    print_error "Template not found: $TEMPLATE_FILE"
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

# Check analytics stack status
if aws cloudformation describe-stacks \
    --stack-name "$ANALYTICS_STACK_NAME" \
    --region "$REGION" &> /dev/null; then
    STACK_EXISTS=true
    STACK_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "$ANALYTICS_STACK_NAME" \
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

if [[ -n "$ALERT_EMAIL" ]]; then
    PARAMETERS="$PARAMETERS ParameterKey=AlertEmail,ParameterValue=$ALERT_EMAIL"
fi

if $DRY_RUN; then
    print_status "DRY RUN - Would deploy:"
    echo "  - Real-time Analytics Processor Lambda"
    echo "  - EventBridge Rules for call, template, and assistant events"
    echo "  - Kinesis Data Stream for high-volume analytics"
    echo "  - Daily analytics aggregation scheduled job"
    echo "  - CloudWatch monitoring and alerting"
    echo "  - SNS topic for analytics alerts"
    echo "  - Dead Letter Queue for failed events"
    echo ""
    echo "Event Processing:"
    echo "  • Call Analytics Events (duration, quality, objectives)"
    echo "  • Template Usage Events (views, ratings, usage)"
    echo "  • Assistant Performance Events (creation, deployment)"
    echo "  • Real-time insights and anomaly detection"
    echo ""
    echo "Analytics Features:"
    echo "  • Template performance tracking"
    echo "  • Assistant usage analytics"
    echo "  • Call quality monitoring"
    echo "  • Business objective achievement tracking"
    echo "  • Failure rate monitoring and alerts"
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
    CHANGE_SET_NAME="${ANALYTICS_STACK_NAME}-changeset-$(date +%Y%m%d-%H%M%S)"
    
    aws cloudformation create-change-set \
        --stack-name "$ANALYTICS_STACK_NAME" \
        --change-set-name "$CHANGE_SET_NAME" \
        --template-body file://"$TEMPLATE_FILE" \
        --parameters $PARAMETERS \
        --capabilities CAPABILITY_NAMED_IAM \
        --region "$REGION" > /dev/null
    
    print_status "Waiting for change set creation..."
    aws cloudformation wait change-set-create-complete \
        --stack-name "$ANALYTICS_STACK_NAME" \
        --change-set-name "$CHANGE_SET_NAME" \
        --region "$REGION"
    
    # Show changes
    print_status "Change set summary:"
    aws cloudformation describe-change-set \
        --stack-name "$ANALYTICS_STACK_NAME" \
        --change-set-name "$CHANGE_SET_NAME" \
        --region "$REGION" \
        --query 'Changes[].{Action:Action,Resource:ResourceChange.LogicalResourceId,Type:ResourceChange.ResourceType}' \
        --output table
    
    echo ""
    read -p "Execute change set? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        aws cloudformation execute-change-set \
            --stack-name "$ANALYTICS_STACK_NAME" \
            --change-set-name "$CHANGE_SET_NAME" \
            --region "$REGION"
        OPERATION="update"
    else
        print_warning "Cancelled"
        aws cloudformation delete-change-set \
            --stack-name "$ANALYTICS_STACK_NAME" \
            --change-set-name "$CHANGE_SET_NAME" \
            --region "$REGION"
        exit 0
    fi
else
    print_status "Creating new stack..."
    aws cloudformation create-stack \
        --stack-name "$ANALYTICS_STACK_NAME" \
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
        --stack-name "$ANALYTICS_STACK_NAME" \
        --region "$REGION"
else
    aws cloudformation wait stack-update-complete \
        --stack-name "$ANALYTICS_STACK_NAME" \
        --region "$REGION"
fi

# Check final status
FINAL_STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$ANALYTICS_STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].StackStatus' \
    --output text)

if [[ $FINAL_STATUS == *"COMPLETE" && $FINAL_STATUS != *"ROLLBACK"* ]]; then
    print_success "Analytics Pipeline deployed successfully!"
    
    echo ""
    print_status "Stack Outputs:"
    aws cloudformation describe-stacks \
        --stack-name "$ANALYTICS_STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue}' \
        --output table
    
    echo ""
    print_success "📊 Real-time Analytics Pipeline Ready!"
    
    echo ""
    print_status "✅ Analytics Features Deployed:"
    echo "  • Real-time call analytics processing"
    echo "  • Template performance tracking"
    echo "  • Assistant usage monitoring"
    echo "  • Business objective achievement tracking"
    echo "  • Quality score monitoring and alerts"
    echo "  • Failure rate detection and alerts"
    echo "  • Escalation tracking and notifications"
    echo "  • Daily analytics aggregation jobs"
    echo "  • High-volume event processing with Kinesis"
    echo "  • Comprehensive CloudWatch monitoring"
    
    echo ""
    print_status "🔄 Event Processing Rules:"
    echo "  • Call Analytics: Duration, transcript, summary, status processing"
    echo "  • Template Events: Usage, views, ratings tracking"
    echo "  • Assistant Events: Creation, deployment, performance updates"
    echo "  • Real-time Insights: Anomaly detection and alerting"
    
    echo ""
    print_status "📈 Analytics Capabilities:"
    echo "  • Template popularity and success rate tracking"
    echo "  • Call quality trend analysis"
    echo "  • Business objective achievement rates"
    echo "  • User engagement and retention metrics"
    echo "  • Performance benchmarking and optimization suggestions"
    
    # Update environment file
    ENV_FILE="${SCRIPT_DIR}/../.env.${ENVIRONMENT}"
    if [[ -f "$ENV_FILE" ]]; then
        echo "" >> "$ENV_FILE"
        echo "# Analytics Pipeline Configuration" >> "$ENV_FILE"
        echo "ANALYTICS_STACK_NAME=$ANALYTICS_STACK_NAME" >> "$ENV_FILE"
        echo "ANALYTICS_PIPELINE_DEPLOYED=true" >> "$ENV_FILE"
        
        if [[ -n "$ALERT_EMAIL" ]]; then
            echo "ANALYTICS_ALERT_EMAIL=$ALERT_EMAIL" >> "$ENV_FILE"
        fi
        
        print_success "Environment file updated: $ENV_FILE"
    fi
    
    echo ""
    print_status "🎯 Phase 3 Complete!"
    print_status "Next: Deploy Phase 4 - Frontend Integration & Advanced Features"
    
else
    print_error "Deployment failed with status: $FINAL_STATUS"
    
    print_status "Recent stack events:"
    aws cloudformation describe-stack-events \
        --stack-name "$ANALYTICS_STACK_NAME" \
        --region "$REGION" \
        --query 'StackEvents[0:5].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' \
        --output table
    
    exit 1
fi