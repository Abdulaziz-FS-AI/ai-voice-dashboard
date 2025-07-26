# Voice Matrix Backend API Documentation

## 🚀 **Production API Base URL**
```
https://jtpyvtfavj.execute-api.us-east-1.amazonaws.com/production
```

## 🔐 **Authentication**
All endpoints (except auth endpoints) require JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## 📋 **Quick Actions Backend APIs**

### 🤖 **Assistants Management** (`/assistants`)

#### **Get Prompt Templates**
```http
GET /assistants/templates
```
**Response:** Pre-built prompt templates with original + dynamic segments
```json
{
  "templates": [
    {
      "id": "customer-service",
      "name": "Customer Service Assistant", 
      "category": "support",
      "segments": [
        {
          "id": "intro",
          "type": "original",
          "content": "You are a professional AI assistant...",
          "editable": false
        },
        {
          "id": "company-name", 
          "type": "dynamic",
          "label": "Company Name",
          "placeholder": "Enter your company name",
          "required": true,
          "editable": true
        }
      ]
    }
  ]
}
```

#### **Create Assistant** 
```http
POST /assistants/create
```
**Request Body:**
```json
{
  "name": "My Customer Service Bot",
  "templateId": "customer-service", 
  "dynamicSegments": {
    "company-name": "Acme Corp",
    "business-hours": "Mon-Fri 9AM-5PM",
    "services-offered": "Web development, consulting",
    "transfer-number": "+1-555-123-4567"
  },
  "voiceSettings": {
    "provider": "elevenlabs",
    "voiceId": "ErXwobaYiN019PkySvjV",
    "speed": 1.0,
    "stability": 0.7
  }
}
```

#### **Deploy Assistant to VAPI**
```http
POST /assistants/deploy
```
**Request Body:**
```json
{
  "assistantId": "assistant-uuid"
}
```

#### **Get User's Assistants**
```http
GET /assistants/list
```

---

### 📊 **Analytics** (`/analytics`)

#### **Get Analytics Overview**
```http
GET /analytics/overview?timeframe=30d
```
**Response:** Complete metrics dashboard
```json
{
  "metrics": {
    "totalCalls": 169,
    "totalDuration": 16287,
    "averageDuration": 203,
    "successRate": 95,
    "transferRate": 12,
    "costTotal": 49722,
    "sentimentDistribution": {
      "positive": 82,
      "neutral": 10, 
      "negative": 1
    },
    "callsBy": {
      "hour": {"09": 49, "10": 24},
      "day": {"2025-07-26": 54},
      "week": {"Week of 2025-07-26": 214}
    },
    "topPerformers": [
      {
        "assistantId": "assistant-1",
        "assistantName": "Customer Service Bot",
        "callCount": 91,
        "successRate": 92
      }
    ]
  }
}
```

#### **Get Call Logs**
```http
GET /analytics/calls?limit=50&offset=0&assistantId=xxx&outcome=completed
```

#### **Get Performance Metrics**
```http
GET /analytics/performance?timeframe=30d&assistantId=xxx
```

#### **Get Real-time Metrics**
```http
GET /analytics/real-time
```

---

### 📞 **Phone Numbers Management** (`/phone-numbers`)

#### **Get Available Numbers**
```http
GET /phone-numbers/available?country=US&areaCode=555&city=New York
```
**Response:**
```json
{
  "availableNumbers": [
    {
      "number": "+1-555-0123",
      "country": "US", 
      "area": "555",
      "city": "New York",
      "price": 100,
      "capabilities": ["voice", "sms"],
      "provider": "vapi"
    }
  ]
}
```

#### **Provision Phone Number**
```http
POST /phone-numbers/provision
```
**Request Body:**
```json
{
  "number": "+1-555-0123",
  "provider": "vapi",
  "forwardingNumber": "+1-555-999-8888",
  "businessHours": {
    "enabled": true,
    "timezone": "America/New_York",
    "hours": {
      "monday": {"start": "09:00", "end": "17:00", "enabled": true}
    }
  }
}
```

#### **Assign Number to Assistant**
```http
POST /phone-numbers/assign
```
**Request Body:**
```json
{
  "phoneNumberId": "phone-uuid",
  "assistantId": "assistant-uuid"
}
```

#### **Get User's Phone Numbers**
```http
GET /phone-numbers/list
```

---

### ⚙️ **Settings** (`/settings`)

#### **Get User Profile**
```http
GET /settings/profile
```

#### **Update User Profile**
```http
PUT /settings/profile
```
**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe", 
  "company": "Acme Corp",
  "phone": "+1-555-123-4567",
  "email": "john@acme.com"
}
```

#### **Get User Preferences**
```http
GET /settings/preferences
```
**Response:**
```json
{
  "preferences": {
    "notifications": {
      "email": true,
      "sms": false,
      "callAlerts": true
    },
    "dashboard": {
      "theme": "light",
      "timezone": "America/New_York", 
      "defaultView": "overview"
    },
    "calling": {
      "recordCalls": true,
      "maxCallDuration": 600,
      "enableTranscription": true
    }
  },
  "integrations": {
    "vapi": {
      "configured": false,
      "apiKeySet": false
    }
  }
}
```

#### **Update VAPI Integration** 
```http
PUT /settings/integrations/vapi
```
**Request Body:**
```json
{
  "apiKey": "your-vapi-api-key"
}
```

#### **Change Password**
```http
POST /settings/change-password
```
**Request Body:**
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

---

## 🎯 **Quick Actions Implementation Guide**

### **1. Create Assistant Button Flow**
```javascript
// 1. Get templates
const templates = await fetch('/assistants/templates');

// 2. User selects template & fills dynamic segments
const assistantData = {
  name: "My Bot",
  templateId: "customer-service",
  dynamicSegments: {
    "company-name": "Acme Corp",
    "business-hours": "9AM-5PM"
  }
};

// 3. Create assistant
const assistant = await fetch('/assistants/create', {
  method: 'POST',
  body: JSON.stringify(assistantData)
});

// 4. Deploy to VAPI
const deployed = await fetch('/assistants/deploy', {
  method: 'POST', 
  body: JSON.stringify({ assistantId: assistant.id })
});
```

### **2. View Analytics Button Flow**
```javascript
// Get comprehensive analytics
const analytics = await fetch('/analytics/overview?timeframe=30d');
const realTime = await fetch('/analytics/real-time');
const performance = await fetch('/analytics/performance');
```

### **3. Manage Numbers Button Flow**
```javascript
// 1. Get available numbers
const available = await fetch('/phone-numbers/available?country=US');

// 2. Provision selected number
const provisioned = await fetch('/phone-numbers/provision', {
  method: 'POST',
  body: JSON.stringify({ number: "+1-555-0123" })
});

// 3. Assign to assistant
const assigned = await fetch('/phone-numbers/assign', {
  method: 'POST',
  body: JSON.stringify({ 
    phoneNumberId: provisioned.id,
    assistantId: "assistant-uuid"
  })
});
```

### **4. Settings Button Flow**
```javascript
// Get all settings
const profile = await fetch('/settings/profile');
const preferences = await fetch('/settings/preferences'); 
const integrations = await fetch('/settings/integrations');

// Update VAPI integration
const vapiUpdate = await fetch('/settings/integrations/vapi', {
  method: 'PUT',
  body: JSON.stringify({ apiKey: "vapi-key" })
});
```

---

## 🏗️ **Prompt Template System Architecture**

### **Template Structure**
```typescript
interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  segments: PromptSegment[];
}

interface PromptSegment {
  id: string;
  type: 'original' | 'dynamic';  // ← Key differentiator
  label: string;
  content: string;
  editable: boolean;
  required?: boolean;
  placeholder?: string;
}
```

### **Prompt Assembly Process**
1. **Get Template**: Fetch template with original + dynamic segments
2. **User Input**: Fill only dynamic segments via forms
3. **Assembly**: Combine original (unchanged) + dynamic (user-filled)
4. **VAPI Deploy**: Send assembled prompt to VAPI API

---

## 🚀 **All Backend APIs Now Live**

✅ **9 Lambda Functions Deployed:**
- `auth` - Authentication & user management
- `user` - User profile operations  
- `vapi` - VAPI integrations
- `admin` - Admin operations
- `dashboard` - Dashboard data
- `assistants` - Assistant creation & management (**NEW**)
- `analytics` - Call analytics & reporting (**NEW**)
- `phoneNumbers` - Phone number management (**NEW**)
- `settings` - User preferences & integrations (**NEW**)

✅ **5 DynamoDB Tables:**
- `production-voice-matrix-users`
- `production-voice-matrix-vapi-config` 
- `production-voice-matrix-assistants` (**NEW**)
- `production-voice-matrix-phone-numbers` (**NEW**)
- `production-voice-matrix-user-settings` (**NEW**)

**Ready for frontend integration!** All Quick Actions buttons can now connect to working backend APIs with real functionality.