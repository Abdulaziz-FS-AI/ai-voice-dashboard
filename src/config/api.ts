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
  const token = localStorage.getItem('authToken') || 'demo-token';
  
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