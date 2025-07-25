# Voice Matrix AI Dashboard - AWS Production Infrastructure

Complete AWS production environment setup for the Voice Matrix AI Dashboard application.

## 🏗️ Architecture Overview

### Infrastructure Components

- **Frontend**: React app deployed to S3 + CloudFront CDN
- **Backend**: Serverless Lambda functions with API Gateway
- **Database**: DynamoDB for user data and VAPI configuration
- **Authentication**: AWS Cognito User Pools
- **Security**: WAF, SSL certificates, secrets management
- **Monitoring**: CloudWatch, X-Ray tracing, custom metrics
- **Backup**: AWS Backup with cross-region replication
- **CI/CD**: GitHub Actions workflows

## 🚀 Quick Start

### Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Node.js 18+** and npm
3. **Domain name** (recommended: voicematrix.ai)
4. **VAPI API Key** from [dashboard.vapi.ai](https://dashboard.vapi.ai)

### 1. Environment Setup

```bash
# Make setup script executable
chmod +x aws-infrastructure/environment-setup.sh

# Run environment setup (interactive)
./aws-infrastructure/environment-setup.sh production us-east-1 voicematrix.ai
```

This script will:
- Create AWS Secrets Manager entries for sensitive data
- Generate environment configuration files
- Create deployment scripts

### 2. Deploy Infrastructure

```bash
# Deploy complete production environment
./deploy-production.sh
```

Or deploy step by step:

```bash
# 1. Core infrastructure
aws cloudformation deploy \
  --template-file aws-infrastructure/cloudformation-template.yaml \
  --stack-name voice-matrix-production-infrastructure \
  --parameter-overrides Environment=production DomainName=voicematrix.ai \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1

# 2. Cognito authentication
aws cloudformation deploy \
  --template-file aws-infrastructure/cognito-template.yaml \
  --stack-name voice-matrix-production-cognito \
  --parameter-overrides Environment=production DomainName=voicematrix.ai \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1

# 3. SSL and custom domain
aws cloudformation deploy \
  --template-file aws-infrastructure/domain-ssl-template.yaml \
  --stack-name voice-matrix-production-domain \
  --parameter-overrides Environment=production DomainName=voicematrix.ai \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1

# 4. Backend Lambda functions
cd aws-infrastructure/backend-lambda
npm install
npm run deploy:prod
cd ../..

# 5. Frontend deployment
./aws-infrastructure/deploy-frontend.sh production us-east-1

# 6. Monitoring and alerting
aws cloudformation deploy \
  --template-file aws-infrastructure/monitoring-template.yaml \
  --stack-name voice-matrix-production-monitoring \
  --parameter-overrides Environment=production AlertEmail=alerts@voicematrix.ai \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1

# 7. Backup and disaster recovery
aws cloudformation deploy \
  --template-file aws-infrastructure/backup-template.yaml \
  --stack-name voice-matrix-production-backup \
  --parameter-overrides Environment=production \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

### 3. Update Environment Variables

```bash
# Update environment file with deployed resource IDs
./update-env-production.sh
```

### 4. Configure DNS

If not using Route53, manually configure DNS:

```
# Main domain
voicematrix.ai → [CloudFront Distribution Domain]

# WWW subdomain  
www.voicematrix.ai → [CloudFront Distribution Domain]

# API subdomain
api.voicematrix.ai → [API Gateway Regional Domain]
```

## 📁 Directory Structure

```
aws-infrastructure/
├── cloudformation-template.yaml    # Core infrastructure (VPC, S3, DynamoDB)
├── cognito-template.yaml          # Authentication setup
├── domain-ssl-template.yaml       # SSL certificates and custom domains
├── monitoring-template.yaml       # CloudWatch monitoring and alerting
├── backup-template.yaml          # Backup and disaster recovery
├── environment-setup.sh          # Interactive environment configuration
├── deploy-frontend.sh            # Frontend deployment script
├── backend-lambda/               # Serverless backend
│   ├── package.json
│   ├── serverless.yml
│   └── src/
│       ├── handlers/
│       │   ├── auth.ts           # Authentication endpoints
│       │   ├── user.ts           # User management
│       │   ├── vapi.ts           # VAPI integration proxy
│       │   └── admin.ts          # Admin functions
│       └── utils/
└── README.md                     # This file
```

## 🔧 Configuration

### Environment Variables

The setup creates `.env.production` with:

```bash
# Environment
ENVIRONMENT=production
AWS_REGION=us-east-1
DOMAIN_NAME=voicematrix.ai

# Application URLs
FRONTEND_URL=https://voicematrix.ai
API_URL=https://api.voicematrix.ai

# AWS Resources
USERS_TABLE=production-voice-matrix-users
VAPI_CONFIG_TABLE=production-voice-matrix-vapi-config
S3_BUCKET=production-voice-matrix-frontend

# Secrets (stored in AWS Secrets Manager)
VAPI_SECRET_NAME=voice-matrix/production/vapi-api-key
AUTH_SECRET_NAME=voice-matrix/production/auth-config
```

### Required Secrets

Store these in AWS Secrets Manager:

1. **VAPI API Key**: `voice-matrix/production/vapi-api-key`
2. **JWT Secret**: `voice-matrix/production/auth-config`
3. **Database Encryption**: `voice-matrix/production/database-config`
4. **Email Config** (optional): `voice-matrix/production/email-config`
5. **Payment Config** (optional): `voice-matrix/production/payment-config`

## 🔐 Security Features

### Frontend Security
- CloudFront with WAF protection
- SSL/TLS encryption (TLS 1.2+)
- CORS configuration
- No API keys exposed in frontend code

### Backend Security
- VPC with private subnets for Lambda functions
- API Gateway with request validation
- JWT-based authentication
- Secrets Manager for sensitive data
- Encrypted DynamoDB tables

### Infrastructure Security
- IAM roles with least privilege
- Security groups with minimal access
- CloudTrail for audit logging
- Backup encryption with KMS

## 📊 Monitoring & Alerting

### CloudWatch Dashboards
- Application performance metrics
- Lambda function monitoring
- DynamoDB capacity utilization
- API Gateway request/error rates

### Alarms
- Lambda error rates and duration
- DynamoDB throttling
- API Gateway 4xx/5xx errors
- Backup job failures

### Logging
- Lambda function logs
- API Gateway access logs
- Application-specific logs
- CloudTrail audit logs

## 🔄 CI/CD Pipeline

### GitHub Actions Workflows

1. **Deploy to Staging** (`.github/workflows/deploy-staging.yml`)
   - Triggers on push to `develop` branch
   - Runs tests and deploys to staging environment

2. **Deploy to Production** (`.github/workflows/deploy-production.yml`)
   - Triggers on push to `main` branch
   - Includes security scans and smoke tests
   - Automatic rollback on failure

### Required GitHub Secrets

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY

# Cognito Configuration
COGNITO_USER_POOL_ID
COGNITO_CLIENT_ID
STAGING_COGNITO_USER_POOL_ID
STAGING_COGNITO_CLIENT_ID

# DNS Configuration
ROUTE53_HOSTED_ZONE_ID

# Notifications
ALERT_EMAIL
SLACK_WEBHOOK_URL
```

## 🛡️ Backup & Disaster Recovery

### Backup Strategy
- **Daily backups** with 30-day retention
- **Weekly backups** with 90-day retention
- **Cross-region replication** to us-west-2
- **Point-in-time recovery** for DynamoDB

### Recovery Procedures
1. **RTO**: 4 hours (Recovery Time Objective)
2. **RPO**: 1 hour (Recovery Point Objective)
3. **Automated backup health monitoring**
4. **DR runbook** stored in S3

## 💰 Cost Optimization

### Estimated Monthly Costs (Production)

- **Lambda**: $10-50 (depending on usage)
- **DynamoDB**: $5-25 (on-demand pricing)
- **S3 + CloudFront**: $10-30
- **API Gateway**: $3-15
- **CloudWatch**: $5-20
- **Backup**: $10-40
- **Total**: $43-180/month

### Cost Optimization Features
- S3 Intelligent Tiering
- DynamoDB On-Demand pricing
- Lambda provisioned concurrency (if needed)
- CloudWatch log retention policies

## 🚨 Troubleshooting

### Common Issues

1. **Certificate Validation Hanging**
   ```bash
   # Check DNS records for certificate validation
   aws acm describe-certificate --certificate-arn [ARN]
   ```

2. **Lambda Function Timeouts**
   ```bash
   # Check VPC NAT Gateway configuration
   aws ec2 describe-nat-gateways
   ```

3. **CORS Issues**
   ```bash
   # Verify API Gateway CORS configuration
   aws apigateway get-resource --rest-api-id [ID] --resource-id [ID]
   ```

### Logs and Debugging

```bash
# Lambda function logs
aws logs tail /aws/lambda/production-voice-matrix-auth --follow

# API Gateway logs
aws logs tail /aws/apigateway/production-voice-matrix --follow

# Application logs
aws logs tail /voice-matrix/production/application --follow
```

## 🔧 Maintenance

### Regular Tasks

1. **Monthly**: Review and test disaster recovery procedures
2. **Weekly**: Check backup job success rates
3. **Daily**: Monitor application performance metrics
4. **As needed**: Update dependencies and security patches

### Health Checks

```bash
# Application health
curl -f https://voicematrix.ai/health

# API health
curl -f https://api.voicematrix.ai/health

# Backup health
aws backup list-recovery-points --backup-vault-name production-voice-matrix-backup-vault
```

## 🆘 Support

### Getting Help

1. **Application Issues**: Check CloudWatch logs and metrics
2. **Infrastructure Issues**: Review CloudFormation stack events
3. **AWS Support**: Use AWS Support Center for infrastructure issues
4. **Emergency**: Follow the disaster recovery runbook

### Contact Information

- **Technical Lead**: [Your contact information]
- **AWS Account**: [AWS Account ID]
- **Support Level**: [Your AWS support tier]

---

## 🎯 Next Steps After Deployment

1. **Configure Custom Domain**: Set up DNS records for your domain
2. **Test Application**: Verify all functionality works correctly
3. **Set Up Monitoring**: Configure alerts and notification channels
4. **User Training**: Train your team on the admin dashboard
5. **Go Live**: Start onboarding your first customers!

---

*Generated for Voice Matrix AI Dashboard - Production AWS Infrastructure*