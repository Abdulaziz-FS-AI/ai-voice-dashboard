# 🚀 Complete VAPI Integration Setup Guide

## Step 1: Install Required Tools

### 1.1 Install AWS CLI
```bash
# For macOS (you're on macOS)
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Verify installation
aws --version
```

### 1.2 Install SAM CLI
```bash
# Install SAM CLI using pip
pip3 install aws-sam-cli

# Or using Homebrew (easier on macOS)
brew install aws-sam-cli

# Verify installation
sam --version
```

### 1.3 Install Node.js Dependencies
```bash
# Navigate to backend folder
cd "/Users/abdulaziz.f/Desktop/abdulaziz/2nd project/ai-voice-dashboard/backend/src"

# Install dependencies
npm install
```

## Step 2: Configure AWS Credentials

### 2.1 Set up AWS CLI
```bash
aws configure
```

When prompted, enter:
- **AWS Access Key ID**: [Your AWS Access Key]
- **AWS Secret Access Key**: [Your AWS Secret Key] 
- **Default region name**: `eu-north-1`
- **Default output format**: `json`

### 2.2 Test AWS Connection
```bash
# Test if AWS CLI is working
aws sts get-caller-identity
```

You should see your AWS account details.

## Step 3: Create DynamoDB Tables

Since you mentioned you already created the tables, let's verify they exist:

```bash
# Check if your tables exist
aws dynamodb list-tables --region eu-north-1
```

You should see these tables:
- voice-matrix-users
- voice-matrix-calls  
- voice-matrix-analytics
- voice-matrix-vapi-sync

If any are missing, create them:

```bash
# Create Users Table (if missing)
aws dynamodb create-table \
    --table-name voice-matrix-users \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region eu-north-1

# Create VAPI Sync Table (if missing)
aws dynamodb create-table \
    --table-name voice-matrix-vapi-sync \
    --attribute-definitions \
        AttributeName=userId,AttributeType=S \
        AttributeName=syncType,AttributeType=S \
    --key-schema \
        AttributeName=userId,KeyType=HASH \
        AttributeName=syncType,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region eu-north-1
```

## Step 4: Deploy Backend with SAM

### 4.1 Navigate to Backend Directory
```bash
cd "/Users/abdulaziz.f/Desktop/abdulaziz/2nd project/ai-voice-dashboard/backend"
```

### 4.2 Build the SAM Application
```bash
sam build
```

### 4.3 Deploy with Guided Setup
```bash
sam deploy --guided
```

**When prompted, enter these values:**

1. **Stack Name**: `voice-matrix-backend`
2. **AWS Region**: `eu-north-1`
3. **Parameter EncryptionKey**: Press Enter (will use default) or enter a 32-character string
4. **Confirm changes before deploy**: `y`
5. **Allow SAM CLI IAM role creation**: `y`
6. **Disable rollback**: `n`
7. **Save parameters to configuration file**: `y`
8. **SAM configuration file**: Press Enter (default)
9. **SAM configuration environment**: Press Enter (default)

**This will:**
- Create all Lambda functions automatically
- Set up API Gateway
- Create IAM roles and policies
- Deploy everything to AWS

### 4.4 Get Your API URL
After deployment completes, look for this line in the output:
```
Outputs:
VoiceMatrixApiUrl   https://xxxxxxxxxx.execute-api.eu-north-1.amazonaws.com/prod/
```

**Copy this URL** - you'll need it for your frontend!

## Step 5: Update Frontend Configuration

### 5.1 Update Environment Variables
```bash
# Navigate to your React app root
cd "/Users/abdulaziz.f/Desktop/abdulaziz/2nd project/ai-voice-dashboard"

# Edit your .env file
echo "REACT_APP_API_URL=https://your-api-gateway-url.execute-api.eu-north-1.amazonaws.com/prod" >> .env
```

**Replace `your-api-gateway-url` with the actual URL from Step 4.4**

### 5.2 Add VAPI Settings to Dashboard Navigation

You'll need to add the VapiSettings component to your dashboard. Update your Dashboard component to include a "Settings" or "VAPI" tab.

## Step 6: Configure VAPI Integration

### 6.1 Get Your VAPI Webhook URL
Your webhook URL will be:
```
https://your-api-gateway-url.execute-api.eu-north-1.amazonaws.com/prod/webhook/vapi
```

### 6.2 Set Up VAPI Webhook
1. Go to [VAPI Dashboard](https://dashboard.vapi.ai)
2. Navigate to Settings → Webhooks
3. Add webhook URL from Step 6.1
4. Enable these events:
   - call-started
   - call-ended
   - transcript

## Step 7: Test Everything

### 7.1 Start Your React App
```bash
npm start
```

### 7.2 Test the Integration
1. Go to your dashboard
2. Navigate to VAPI Settings (you'll need to add this to navigation)
3. Enter your VAPI API key
4. Save credentials
5. Go to Agent Editor
6. You should see your VAPI assistants loaded

## 🚨 Common Issues & Solutions

### Issue: "SAM command not found"
```bash
# Install using pip
pip3 install aws-sam-cli

# Or using Homebrew
brew install aws-sam-cli
```

### Issue: "Access Denied" during deployment
- Make sure your AWS credentials have administrator access
- Check that you ran `aws configure` correctly

### Issue: "Table already exists" 
- This is fine, SAM will use existing tables
- Make sure table names match exactly

### Issue: API Gateway CORS errors
- The SAM template includes CORS configuration
- If issues persist, check browser console for specific errors

## 📞 What Happens Next

Once everything is deployed:

1. **Real-time call tracking**: VAPI will send webhook events to your backend
2. **Automatic data sync**: Every hour, your system syncs missed data
3. **Live analytics**: Your dashboard shows real call metrics
4. **Assistant management**: Edit assistants directly from your dashboard

## 🎯 Final Checklist

- [ ] AWS CLI installed and configured
- [ ] SAM CLI installed  
- [ ] DynamoDB tables exist
- [ ] Backend deployed successfully
- [ ] Frontend .env updated with API URL
- [ ] VAPI webhook configured
- [ ] Test VAPI credentials in dashboard

That's it! Your Voice Matrix dashboard is now fully integrated with VAPI! 🚀