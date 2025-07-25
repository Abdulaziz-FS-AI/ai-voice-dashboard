#!/bin/bash

# Voice Matrix AI Dashboard - Environment Setup Script
# This script sets up environment variables and secrets for production deployment

set -e

# Configuration
ENVIRONMENT=${1:-production}
REGION=${2:-us-east-1}
DOMAIN_NAME=${3:-voicematrix.ai}

echo "🔧 Setting up environment for ${ENVIRONMENT}..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI is not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI is configured${NC}"

# Function to create or update a secret
create_or_update_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3
    
    echo "🔐 Setting up secret: $secret_name"
    
    # Check if secret exists
    if aws secretsmanager describe-secret --secret-id "$secret_name" --region "$REGION" > /dev/null 2>&1; then
        echo "📝 Updating existing secret: $secret_name"
        aws secretsmanager update-secret \
            --secret-id "$secret_name" \
            --secret-string "$secret_value" \
            --region "$REGION" > /dev/null
    else
        echo "🆕 Creating new secret: $secret_name"
        aws secretsmanager create-secret \
            --name "$secret_name" \
            --description "$description" \
            --secret-string "$secret_value" \
            --region "$REGION" > /dev/null
    fi
    
    echo -e "${GREEN}✅ Secret $secret_name configured${NC}"
}

# Function to prompt for secret values
prompt_for_secret() {
    local prompt_text=$1
    local default_value=$2
    local secret_value
    
    if [ -n "$default_value" ]; then
        read -p "$prompt_text [$default_value]: " secret_value
        secret_value=${secret_value:-$default_value}
    else
        read -p "$prompt_text: " secret_value
    fi
    
    echo "$secret_value"
}

echo ""
echo "🔑 Let's set up your secrets and environment variables..."
echo ""

# VAPI API Key
echo -e "${YELLOW}VAPI Configuration:${NC}"
vapi_key=$(prompt_for_secret "Enter your VAPI API Key" "")

if [ -z "$vapi_key" ]; then
    echo -e "${RED}❌ VAPI API Key is required${NC}"
    exit 1
fi

vapi_secret=$(cat <<EOF
{
  "apiKey": "$vapi_key"
}
EOF
)

create_or_update_secret \
    "voice-matrix/${ENVIRONMENT}/vapi-api-key" \
    "$vapi_secret" \
    "VAPI API Key for Voice Matrix ${ENVIRONMENT}"

# JWT Secret
echo ""
echo -e "${YELLOW}Authentication Configuration:${NC}"
jwt_secret=$(prompt_for_secret "Enter JWT Secret (leave blank for auto-generated)" "")

if [ -z "$jwt_secret" ]; then
    jwt_secret=$(openssl rand -base64 32)
    echo "🔄 Generated JWT secret automatically"
fi

auth_secret=$(cat <<EOF
{
  "jwtSecret": "$jwt_secret"
}
EOF
)

create_or_update_secret \
    "voice-matrix/${ENVIRONMENT}/auth-config" \
    "$auth_secret" \
    "Authentication configuration for Voice Matrix ${ENVIRONMENT}"

# Database Configuration
echo ""
echo -e "${YELLOW}Database Configuration:${NC}"
db_encryption_key=$(prompt_for_secret "Enter database encryption key (leave blank for auto-generated)" "")

if [ -z "$db_encryption_key" ]; then
    db_encryption_key=$(openssl rand -base64 32)
    echo "🔄 Generated database encryption key automatically"
fi

db_secret=$(cat <<EOF
{
  "encryptionKey": "$db_encryption_key"
}
EOF
)

create_or_update_secret \
    "voice-matrix/${ENVIRONMENT}/database-config" \
    "$db_secret" \
    "Database configuration for Voice Matrix ${ENVIRONMENT}"

# Email Configuration (for notifications)
echo ""
echo -e "${YELLOW}Email Configuration (Optional):${NC}"
smtp_host=$(prompt_for_secret "SMTP Host (leave blank to skip)" "")

if [ -n "$smtp_host" ]; then
    smtp_port=$(prompt_for_secret "SMTP Port" "587")
    smtp_user=$(prompt_for_secret "SMTP Username" "")
    smtp_pass=$(prompt_for_secret "SMTP Password" "")
    from_email=$(prompt_for_secret "From Email Address" "noreply@${DOMAIN_NAME}")
    
    email_secret=$(cat <<EOF
{
  "smtpHost": "$smtp_host",
  "smtpPort": "$smtp_port",
  "smtpUser": "$smtp_user",
  "smtpPassword": "$smtp_pass",
  "fromEmail": "$from_email"
}
EOF
)

    create_or_update_secret \
        "voice-matrix/${ENVIRONMENT}/email-config" \
        "$email_secret" \
        "Email configuration for Voice Matrix ${ENVIRONMENT}"
fi

# Stripe Configuration (for payments)
echo ""
echo -e "${YELLOW}Stripe Configuration (Optional):${NC}"
stripe_publishable=$(prompt_for_secret "Stripe Publishable Key (leave blank to skip)" "")

if [ -n "$stripe_publishable" ]; then
    stripe_secret=$(prompt_for_secret "Stripe Secret Key" "")
    stripe_webhook_secret=$(prompt_for_secret "Stripe Webhook Secret" "")
    
    payment_secret=$(cat <<EOF
{
  "stripePublishableKey": "$stripe_publishable",
  "stripeSecretKey": "$stripe_secret",
  "stripeWebhookSecret": "$stripe_webhook_secret"
}
EOF
)

    create_or_update_secret \
        "voice-matrix/${ENVIRONMENT}/payment-config" \
        "$payment_secret" \
        "Payment configuration for Voice Matrix ${ENVIRONMENT}"
fi

# Create environment configuration file
echo ""
echo "📋 Creating environment configuration file..."

cat > ".env.${ENVIRONMENT}" <<EOF
# Voice Matrix AI Dashboard - ${ENVIRONMENT} Environment Configuration
# Generated on $(date)

# Environment
ENVIRONMENT=${ENVIRONMENT}
AWS_REGION=${REGION}
DOMAIN_NAME=${DOMAIN_NAME}

# Application URLs
FRONTEND_URL=https://${DOMAIN_NAME}
API_URL=https://api.${DOMAIN_NAME}

# AWS Resources (these will be populated after infrastructure deployment)
USERS_TABLE=${ENVIRONMENT}-voice-matrix-users
VAPI_CONFIG_TABLE=${ENVIRONMENT}-voice-matrix-vapi-config
S3_BUCKET=${ENVIRONMENT}-voice-matrix-frontend
CLOUDFRONT_DISTRIBUTION_ID=REPLACE_AFTER_DEPLOYMENT

# Secrets Manager Secret Names
VAPI_SECRET_NAME=voice-matrix/${ENVIRONMENT}/vapi-api-key
AUTH_SECRET_NAME=voice-matrix/${ENVIRONMENT}/auth-config
DATABASE_SECRET_NAME=voice-matrix/${ENVIRONMENT}/database-config
EMAIL_SECRET_NAME=voice-matrix/${ENVIRONMENT}/email-config
PAYMENT_SECRET_NAME=voice-matrix/${ENVIRONMENT}/payment-config

# Cognito (these will be populated after Cognito deployment)
COGNITO_USER_POOL_ID=REPLACE_AFTER_COGNITO_DEPLOYMENT
COGNITO_CLIENT_ID=REPLACE_AFTER_COGNITO_DEPLOYMENT
COGNITO_IDENTITY_POOL_ID=REPLACE_AFTER_COGNITO_DEPLOYMENT

# Security
CORS_ORIGINS=https://${DOMAIN_NAME},https://www.${DOMAIN_NAME}
EOF

echo -e "${GREEN}✅ Environment configuration saved to .env.${ENVIRONMENT}${NC}"

# Create deployment script
echo ""
echo "🚀 Creating deployment script..."

cat > "deploy-${ENVIRONMENT}.sh" <<EOF
#!/bin/bash

# Voice Matrix AI Dashboard - ${ENVIRONMENT} Deployment Script
# Generated on $(date)

set -e

ENVIRONMENT=${ENVIRONMENT}
REGION=${REGION}
DOMAIN=${DOMAIN_NAME}

echo "🚀 Starting ${ENVIRONMENT} deployment..."

# Load environment variables
source .env.\${ENVIRONMENT}

# Step 1: Deploy infrastructure
echo "📦 Deploying infrastructure..."
aws cloudformation deploy \\
    --template-file aws-infrastructure/cloudformation-template.yaml \\
    --stack-name voice-matrix-\${ENVIRONMENT}-infrastructure \\
    --parameter-overrides \\
        Environment=\${ENVIRONMENT} \\
        DomainName=\${DOMAIN} \\
    --capabilities CAPABILITY_NAMED_IAM \\
    --region \${REGION}

# Step 2: Deploy Cognito
echo "🔐 Deploying Cognito..."
aws cloudformation deploy \\
    --template-file aws-infrastructure/cognito-template.yaml \\
    --stack-name voice-matrix-\${ENVIRONMENT}-cognito \\
    --parameter-overrides \\
        Environment=\${ENVIRONMENT} \\
        DomainName=\${DOMAIN} \\
    --capabilities CAPABILITY_NAMED_IAM \\
    --region \${REGION}

# Step 3: Deploy Lambda backend
echo "⚡ Deploying Lambda backend..."
cd aws-infrastructure/backend-lambda
npm install
npm run deploy:\${ENVIRONMENT}
cd ../..

# Step 4: Deploy frontend
echo "🌐 Deploying frontend..."
./aws-infrastructure/deploy-frontend.sh \${ENVIRONMENT} \${REGION}

echo ""
echo -e "🎉 ${ENVIRONMENT} deployment completed!"
echo ""
echo "Next steps:"
echo "1. Configure your custom domain and SSL certificate"
echo "2. Update DNS records to point to CloudFront"
echo "3. Test the application thoroughly"
echo "4. Set up monitoring and alerts"
EOF

chmod +x "deploy-${ENVIRONMENT}.sh"

echo -e "${GREEN}✅ Deployment script created: deploy-${ENVIRONMENT}.sh${NC}"

# Create update script for environment variables
cat > "update-env-${ENVIRONMENT}.sh" <<EOF
#!/bin/bash

# Update environment variables after infrastructure deployment

set -e

ENVIRONMENT=${ENVIRONMENT}
REGION=${REGION}

echo "🔄 Updating environment variables after infrastructure deployment..."

# Get infrastructure outputs
CLOUDFRONT_ID=\$(aws cloudformation describe-stacks \\
    --stack-name voice-matrix-\${ENVIRONMENT}-infrastructure \\
    --region \${REGION} \\
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \\
    --output text)

# Get Cognito outputs
USER_POOL_ID=\$(aws cloudformation describe-stacks \\
    --stack-name voice-matrix-\${ENVIRONMENT}-cognito \\
    --region \${REGION} \\
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \\
    --output text)

CLIENT_ID=\$(aws cloudformation describe-stacks \\
    --stack-name voice-matrix-\${ENVIRONMENT}-cognito \\
    --region \${REGION} \\
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \\
    --output text)

IDENTITY_POOL_ID=\$(aws cloudformation describe-stacks \\
    --stack-name voice-matrix-\${ENVIRONMENT}-cognito \\
    --region \${REGION} \\
    --query "Stacks[0].Outputs[?OutputKey=='IdentityPoolId'].OutputValue" \\
    --output text)

# Update .env file
sed -i.bak \\
    -e "s/CLOUDFRONT_DISTRIBUTION_ID=.*/CLOUDFRONT_DISTRIBUTION_ID=\${CLOUDFRONT_ID}/" \\
    -e "s/COGNITO_USER_POOL_ID=.*/COGNITO_USER_POOL_ID=\${USER_POOL_ID}/" \\
    -e "s/COGNITO_CLIENT_ID=.*/COGNITO_CLIENT_ID=\${CLIENT_ID}/" \\
    -e "s/COGNITO_IDENTITY_POOL_ID=.*/COGNITO_IDENTITY_POOL_ID=\${IDENTITY_POOL_ID}/" \\
    .env.\${ENVIRONMENT}

echo "✅ Environment variables updated in .env.\${ENVIRONMENT}"
echo "📋 CloudFront Distribution ID: \${CLOUDFRONT_ID}"
echo "🔐 Cognito User Pool ID: \${USER_POOL_ID}"
echo "🔑 Cognito Client ID: \${CLIENT_ID}"
echo "🆔 Identity Pool ID: \${IDENTITY_POOL_ID}"
EOF

chmod +x "update-env-${ENVIRONMENT}.sh"

echo -e "${GREEN}✅ Environment update script created: update-env-${ENVIRONMENT}.sh${NC}"

echo ""
echo -e "${GREEN}🎉 Environment setup completed!${NC}"
echo ""
echo "Files created:"
echo "  📄 .env.${ENVIRONMENT} - Environment configuration"
echo "  🚀 deploy-${ENVIRONMENT}.sh - Complete deployment script"
echo "  🔄 update-env-${ENVIRONMENT}.sh - Update environment after deployment"
echo ""
echo "Next steps:"
echo "  1. Review the .env.${ENVIRONMENT} file and make any necessary adjustments"
echo "  2. Run ./deploy-${ENVIRONMENT}.sh to deploy your infrastructure"
echo "  3. Run ./update-env-${ENVIRONMENT}.sh after deployment to update environment variables"
echo "  4. Configure your custom domain and SSL certificate"
echo ""
echo -e "${YELLOW}⚠️  Keep your .env.${ENVIRONMENT} file secure and do not commit it to version control!${NC}"