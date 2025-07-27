#!/bin/bash

# Database Initialization Script Wrapper
# Executes the TypeScript initialization script with proper setup

set -e

# Configuration
PROJECT_NAME="VoiceMatrix"
REGION="us-east-1"

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
    echo "  -e, --environment ENV    Environment (dev|staging|prod) [default: dev]"
    echo "  -r, --region REGION      AWS region [default: us-east-1]"
    echo "  -p, --project NAME       Project name [default: VoiceMatrix]"
    echo "  -d, --dry-run           Show what would be done without executing"
    echo "  -v, --verbose           Enable verbose logging"
    echo "  -f, --force             Force re-initialization (overwrite existing data)"
    echo "  -h, --help              Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 -e dev                    Initialize dev environment"
    echo "  $0 -e prod -r us-west-2      Initialize prod in us-west-2"
    echo "  $0 --dry-run -e staging      Preview staging initialization"
    echo "  $0 -f -e dev                 Force re-initialize dev"
}

# Defaults
ENVIRONMENT="dev"
DRY_RUN=false
VERBOSE=false
FORCE=false

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
        -p|--project)
            PROJECT_NAME="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -f|--force)
            FORCE=true
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

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_SCRIPT="${SCRIPT_DIR}/initialize-database.ts"

print_status "Voice Matrix Database Initialization"
print_status "Environment: $ENVIRONMENT"
print_status "Region: $REGION"
print_status "Project: $PROJECT_NAME"
print_status "Dry Run: $DRY_RUN"
print_status "Force: $FORCE"

echo ""

# Check prerequisites
if [[ ! -f "$TS_SCRIPT" ]]; then
    print_error "TypeScript initialization script not found: $TS_SCRIPT"
    exit 1
fi

# Check Node.js and TypeScript
if ! command -v node &> /dev/null; then
    print_error "Node.js not installed"
    exit 1
fi

# Check if ts-node is available
if ! command -v ts-node &> /dev/null; then
    print_status "ts-node not found, installing globally..."
    if command -v npm &> /dev/null; then
        npm install -g ts-node typescript @types/node
        print_success "ts-node installed"
    else
        print_error "npm not available, cannot install ts-node"
        exit 1
    fi
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

print_success "Prerequisites validated"

# Check if DynamoDB tables exist
TABLES=(
    "${PROJECT_NAME}-PromptTemplates-${ENVIRONMENT}"
    "${PROJECT_NAME}-UserAssistants-${ENVIRONMENT}"
    "${PROJECT_NAME}-CallLogs-${ENVIRONMENT}"
    "${PROJECT_NAME}-TemplateAnalytics-${ENVIRONMENT}"
    "${PROJECT_NAME}-UserSessions-${ENVIRONMENT}"
)

print_status "Checking DynamoDB table existence..."
for table in "${TABLES[@]}"; do
    if aws dynamodb describe-table --table-name "$table" --region "$REGION" &> /dev/null; then
        print_success "✓ Table exists: $table"
    else
        print_error "✗ Table not found: $table"
        print_error "Please deploy the DynamoDB infrastructure first"
        exit 1
    fi
done

# Check if data already exists (unless force is specified)
if ! $FORCE && ! $DRY_RUN; then
    print_status "Checking for existing data..."
    
    TEMPLATE_COUNT=$(aws dynamodb scan \
        --table-name "${PROJECT_NAME}-PromptTemplates-${ENVIRONMENT}" \
        --select "COUNT" \
        --region "$REGION" \
        --query "Count" \
        --output text 2>/dev/null || echo "0")
    
    if [[ "$TEMPLATE_COUNT" -gt 0 ]]; then
        print_warning "Found $TEMPLATE_COUNT existing templates in database"
        
        if [[ "$ENVIRONMENT" == "prod" ]]; then
            print_error "Production environment has existing data. Use --force to overwrite"
            exit 1
        fi
        
        echo ""
        read -p "Database contains existing data. Continue anyway? (y/N): " confirm
        if [[ ! $confirm =~ ^[Yy]$ ]]; then
            print_warning "Initialization cancelled"
            exit 0
        fi
    fi
fi

# Install dependencies for the TypeScript script
LAMBDA_DIR="${SCRIPT_DIR}/../backend-lambda"
if [[ ! -d "${LAMBDA_DIR}/node_modules" ]]; then
    print_status "Installing dependencies for initialization script..."
    cd "$LAMBDA_DIR"
    npm install --silent
    cd - > /dev/null
    print_success "Dependencies installed"
fi

# Prepare arguments for TypeScript script
TS_ARGS=()
TS_ARGS+=("-e" "$ENVIRONMENT")
TS_ARGS+=("-r" "$REGION")
TS_ARGS+=("-p" "$PROJECT_NAME")

if $DRY_RUN; then
    TS_ARGS+=("--dry-run")
fi

if $VERBOSE; then
    TS_ARGS+=("--verbose")
fi

# Set NODE_PATH to include the lambda directory for imports
export NODE_PATH="${LAMBDA_DIR}/node_modules:${LAMBDA_DIR}"

print_status "Executing database initialization..."
echo ""

# Execute the TypeScript initialization script
cd "$LAMBDA_DIR"

if ts-node "$TS_SCRIPT" "${TS_ARGS[@]}"; then
    echo ""
    print_success "🎉 Database initialization completed successfully!"
    
    if ! $DRY_RUN; then
        print_status "📊 Summary of initialized data:"
        
        # Get counts of initialized data
        TEMPLATE_COUNT=$(aws dynamodb scan \
            --table-name "${PROJECT_NAME}-PromptTemplates-${ENVIRONMENT}" \
            --select "COUNT" \
            --region "$REGION" \
            --query "Count" \
            --output text 2>/dev/null || echo "0")
        
        ANALYTICS_COUNT=$(aws dynamodb scan \
            --table-name "${PROJECT_NAME}-TemplateAnalytics-${ENVIRONMENT}" \
            --select "COUNT" \
            --region "$REGION" \
            --query "Count" \
            --output text 2>/dev/null || echo "0")
        
        echo "  • Templates: $TEMPLATE_COUNT strategic templates loaded"
        echo "  • Analytics: $ANALYTICS_COUNT analytics records created"
        
        if [[ "$ENVIRONMENT" == "dev" ]]; then
            SESSION_COUNT=$(aws dynamodb scan \
                --table-name "${PROJECT_NAME}-UserSessions-${ENVIRONMENT}" \
                --select "COUNT" \
                --region "$REGION" \
                --query "Count" \
                --output text 2>/dev/null || echo "0")
            echo "  • Dev Sessions: $SESSION_COUNT sample sessions created"
        fi
        
        echo ""
        print_status "🚀 Next Steps:"
        echo "  1. Deploy webhook endpoints for call data collection"
        echo "  2. Deploy enhanced Lambda functions"
        echo "  3. Update frontend to use enhanced template system"
        echo "  4. Test end-to-end assistant creation flow"
        
        # Update environment file
        ENV_FILE="${SCRIPT_DIR}/../.env.${ENVIRONMENT}"
        if [[ -f "$ENV_FILE" ]]; then
            echo "" >> "$ENV_FILE"
            echo "# Database Initialization" >> "$ENV_FILE"
            echo "DATABASE_INITIALIZED=true" >> "$ENV_FILE"
            echo "DATABASE_INIT_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$ENV_FILE"
            echo "TEMPLATE_COUNT=$TEMPLATE_COUNT" >> "$ENV_FILE"
            print_success "Environment file updated: $ENV_FILE"
        fi
    fi
else
    print_error "Database initialization failed"
    exit 1
fi

cd - > /dev/null