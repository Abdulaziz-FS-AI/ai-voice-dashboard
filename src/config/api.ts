// API Configuration for Voice Matrix
export const API_CONFIG = {
  BASE_URL: 'https://w60nq0gwb5.execute-api.eu-north-1.amazonaws.com/prod',
  ENDPOINTS: {
    // User Management
    USER_PROFILE: '/user/profile',
    VAPI_CREDENTIALS: '/user/vapi-credentials',
    SYNC_STATUS: '/user/sync-status',
    SYNC_USER_DATA: '/user/sync',
    
    // VAPI Integration
    VAPI_ASSISTANTS: '/vapi/assistants',
    VAPI_CALLS: '/vapi/calls',
    VAPI_PHONE_NUMBERS: '/vapi/phone-numbers',
    VAPI_TEMPLATES: '/vapi/templates',
    VAPI_LINK_PHONE: (assistantId: string) => `/vapi/assistants/${assistantId}/link-phone`,
    VAPI_UPDATE_ASSISTANT: (assistantId: string) => `/vapi/assistants/${assistantId}`,
    VAPI_DELETE_ASSISTANT: (assistantId: string) => `/vapi/assistants/${assistantId}`,
    
    // Dashboard & Analytics
    DASHBOARD: '/dashboard',
    CALL_LOGS: '/calls',
    
    // Webhooks
    VAPI_WEBHOOK: '/webhook/vapi'
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