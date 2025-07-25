// API Configuration for Voice Matrix
export const API_CONFIG = {
  BASE_URL: 'https://jtpyvtfavj.execute-api.us-east-1.amazonaws.com/production',
  ENDPOINTS: {
    // Authentication
    AUTH_LOGIN: '/auth/login',
    AUTH_REGISTER: '/auth/register',
    AUTH_VERIFY_TOKEN: '/auth/verify-token',
    AUTH_ADMIN_LOGIN: '/auth/admin-login',

    // User Management
    USER_PROFILE: '/user/profile',
    VAPI_CREDENTIALS: '/user/vapi-credentials',
    SYNC_STATUS: '/user/sync-status',
    SYNC_USER_DATA: '/user/sync',
    USER_SUBSCRIPTION: '/user/subscription',
    
    // VAPI Integration
    VAPI_ASSISTANTS: '/vapi/assistants',
    VAPI_CALLS: '/vapi/calls',
    VAPI_PHONE_NUMBERS: '/vapi/phone-numbers',
    VAPI_TEMPLATES: '/vapi/templates',
    VAPI_ACCOUNT: '/vapi/account',
    VAPI_LINK_PHONE: (assistantId: string) => `/vapi/assistants/${assistantId}/link-phone`,
    VAPI_UPDATE_ASSISTANT: (assistantId: string) => `/vapi/assistants/${assistantId}`,
    VAPI_DELETE_ASSISTANT: (assistantId: string) => `/vapi/assistants/${assistantId}`,
    VAPI_TEST_ASSISTANT: '/vapi/assistants/test',
    
    // Dashboard & Analytics
    DASHBOARD: '/dashboard',
    DASHBOARD_STATS: '/dashboard/stats',
    DASHBOARD_RECENT_ACTIVITY: '/dashboard/recent-activity',
    DASHBOARD_QUICK_ACTIONS: '/dashboard/quick-actions',
    
    // Admin
    ADMIN_USERS: '/admin/users',
    ADMIN_ANALYTICS: '/admin/analytics',
    ADMIN_REVENUE: '/admin/revenue',
    ADMIN_SUBSCRIPTIONS: '/admin/subscriptions',
    ADMIN_SYSTEM_STATUS: '/admin/system-status',
    ADMIN_AUDIT_LOGS: '/admin/audit-logs',
    ADMIN_FEATURE_FLAGS: '/admin/feature-flags',
    
    // Webhooks
    VAPI_WEBHOOK: '/vapi/webhook'
  }
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Helper function for API calls with authentication
export const apiCall = async (
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> => {
  // In demo mode, use a demo token. In production, get from proper auth
  let token = localStorage.getItem('authToken');
  
  // For demo purposes, create a mock JWT-like token
  if (!token) {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.userId) {
      // Create a mock JWT for demo mode
      const mockPayload = {
        sub: userData.userId,
        email: userData.email || 'demo@voicematrix.ai',
        'cognito:username': userData.userName || 'demo-user',
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      };
      
      // In demo mode, we'll use this mock token
      token = `demo.${btoa(JSON.stringify(mockPayload))}.signature`;
      localStorage.setItem('authToken', token);
    } else {
      token = 'demo-token';
    }
  }
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {})
    }
  };

  return fetch(buildApiUrl(endpoint), config);
};

export default API_CONFIG;