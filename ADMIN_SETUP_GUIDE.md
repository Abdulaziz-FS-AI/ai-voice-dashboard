# 👑 Voice Matrix Admin Setup Guide

## Overview
This guide explains how to set up and use the admin functionality for VAPI API key management and assistant creation/editing.

## Admin Access Configuration

### 1. Configure Admin Users
Edit `/src/utils/adminConfig.ts` to add authorized admin users:

```typescript
export const adminConfig = {
  // List of authorized admin usernames
  authorizedAdmins: [
    'admin',
    'abdulaziz',
    'your-username-here',  // Add your username
  ],

  // List of authorized admin emails
  authorizedAdminEmails: [
    'admin@voicematrix.com',
    'abdulaziz@voicematrix.com',
    'your-email@domain.com',  // Add your email
  ],
};
```

### 2. Admin Features Available

#### 🔑 VAPI API Key Management
- **Secure Storage**: API keys are encrypted and stored in AWS DynamoDB
- **Backend Integration**: Keys are saved via AWS Lambda functions
- **Validation**: Real-time API key validation with VAPI service

#### 🤖 Assistant Management
- **Template Creation**: Pre-built assistant templates for common use cases
- **Custom Creation**: Full custom assistant creation with all VAPI options
- **Edit Functionality**: Complete assistant editing capabilities
- **Delete Operations**: Safe assistant deletion with confirmation

#### 📊 Enhanced Dashboard
- **Admin Badge**: Visual indication of admin status
- **Extended Permissions**: Access to all management features
- **Real-time Updates**: Live assistant data synchronization

## How to Use Admin Features

### Step 1: Access VAPI Settings
1. Log in to Voice Matrix Dashboard
2. Click "🔑 VAPI Settings (Admin)" button
3. Admin features will be visible if you're authorized

### Step 2: Configure VAPI API Key
1. Get your VAPI API key from [VAPI Dashboard](https://dashboard.vapi.ai)
2. Navigate to Settings → API Keys
3. Copy your API key
4. Paste it in the "VAPI API Key Configuration" section
5. Click "Connect" to validate and save

### Step 3: Create Assistants

#### Using Templates (Recommended)
1. Scroll to "👑 Create Voice Matrix Assistants" section
2. Choose from pre-built templates:
   - **Sales Professional**: Lead qualification and sales calls
   - **Customer Support**: Help desk and support calls
   - **Appointment Scheduler**: Booking and scheduling calls
   - **Market Researcher**: Survey and research calls
   - **Virtual Receptionist**: Call routing and reception
3. Click "Create Assistant" on desired template

#### Creating Custom Assistants
1. Click "+ Create Custom" button
2. Fill in all required fields:
   - **Assistant Name**: Unique name for your assistant
   - **Voice Provider**: ElevenLabs, PlayHT, or OpenAI
   - **Voice ID**: Specific voice identifier (e.g., rachel, sam)
   - **Model Provider**: OpenAI or Anthropic
   - **Model**: GPT-3.5 Turbo, GPT-4, etc.
   - **System Message**: Core instructions for the assistant
   - **First Message**: Greeting message
   - **End Call Message**: Closing message
3. Click "Create Assistant"

### Step 4: Edit Existing Assistants
1. Find the assistant in "🤖 Your VAPI Assistants" section
2. Click "Edit" button
3. Modify any fields in the edit modal
4. Click "Save Changes"

### Step 5: Delete Assistants
1. Find the assistant to delete
2. Click "Delete" button
3. Confirm deletion in the popup

## Technical Implementation

### Backend Integration
- **AWS Lambda**: Serverless functions handle VAPI API calls
- **DynamoDB**: Encrypted storage for API keys and user data
- **API Gateway**: RESTful endpoints for all operations

### Security Features
- **Encrypted Storage**: API keys encrypted before database storage
- **JWT Authentication**: All requests require valid AWS Cognito tokens
- **Admin Authorization**: Role-based access control
- **Input Validation**: All inputs validated before processing

### VAPI API Integration
The system uses the official VAPI API endpoints:

```typescript
// Assistant Management
GET    /assistant           // List assistants
POST   /assistant           // Create assistant
PATCH  /assistant/{id}      // Update assistant
DELETE /assistant/{id}      // Delete assistant

// Account Management
GET    /account             // Get account info
GET    /usage               // Get usage statistics
```

## Troubleshooting

### Common Issues

#### "Please configure your VAPI API key first"
- **Solution**: Add a valid VAPI API key in Settings
- **Check**: Ensure API key has proper permissions in VAPI dashboard

#### "Invalid VAPI API key"
- **Solution**: Verify API key is correct and active
- **Check**: Test API key directly in VAPI dashboard

#### "Failed to create assistant"
- **Solution**: Check all required fields are filled
- **Check**: Verify voice ID and model are valid for your VAPI plan

#### Admin features not visible
- **Solution**: Ensure your username/email is in `adminConfig.ts`
- **Check**: Verify you're logged in with the correct account

### API Limits
- **VAPI Free Tier**: Limited assistants and calls
- **Rate Limits**: VAPI enforces API rate limits
- **Voice Limits**: Some voices require paid plans

## Best Practices

### Assistant Creation
1. **Use Templates First**: Start with templates and customize
2. **Test Thoroughly**: Test assistants before production use
3. **Clear Instructions**: Write clear, specific system messages
4. **Voice Selection**: Choose appropriate voices for your use case

### API Key Management
1. **Secure Storage**: Never share API keys
2. **Regular Rotation**: Rotate keys periodically
3. **Monitor Usage**: Track API usage in VAPI dashboard
4. **Backup Keys**: Keep backup keys for emergency access

### Admin Operations
1. **Document Changes**: Keep track of assistant modifications
2. **Test Before Deploy**: Test all changes in development first
3. **User Communication**: Inform users of assistant updates
4. **Monitor Performance**: Track assistant performance metrics

## Support

### Getting Help
- **Documentation**: Check VAPI official documentation
- **Community**: Join VAPI Discord community
- **Support**: Contact VAPI support for API issues

### Voice Matrix Support
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check project README and guides
- **Admin Access**: Contact system administrator for access issues

---

**🎉 Congratulations!** You now have full admin control over your Voice Matrix VAPI integration. Create, edit, and manage AI voice assistants with ease!
