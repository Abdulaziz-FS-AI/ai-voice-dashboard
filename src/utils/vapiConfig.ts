// VAPI Configuration and API Integration
export interface VapiConfig {
  apiKey: string;
  baseUrl: string;
  organizationId?: string;
}

export interface VapiAssistant {
  id?: string;
  name: string;
  model: {
    provider: string;
    model: string;
    systemMessage: string;
    temperature?: number;
  };
  voice: {
    provider: string;
    voiceId: string;
  };
  firstMessage?: string;
  recordingEnabled?: boolean;
  endCallMessage?: string;
  endCallPhrases?: string[];
  metadata?: Record<string, any>;
}

export interface VapiCall {
  id: string;
  assistantId: string;
  customer: {
    number: string;
  };
  status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended';
  startedAt?: string;
  endedAt?: string;
  cost?: number;
  costBreakdown?: any;
  transcript?: string;
  recordingUrl?: string;
  summary?: string;
  analysis?: any;
}

/**
 * VAPI API Client for Voice Matrix Admin
 */
class VapiClient {
  private config: VapiConfig;

  constructor(config: VapiConfig) {
    this.config = config;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(`VAPI API Error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  // Assistant Management
  async getAssistants(): Promise<VapiAssistant[]> {
    return this.makeRequest('/assistant');
  }

  async getAssistant(assistantId: string): Promise<VapiAssistant> {
    return this.makeRequest(`/assistant/${assistantId}`);
  }

  async createAssistant(assistant: Omit<VapiAssistant, 'id'>): Promise<VapiAssistant> {
    return this.makeRequest('/assistant', {
      method: 'POST',
      body: JSON.stringify(assistant),
    });
  }

  async updateAssistant(assistantId: string, updates: Partial<VapiAssistant>): Promise<VapiAssistant> {
    return this.makeRequest(`/assistant/${assistantId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteAssistant(assistantId: string): Promise<void> {
    return this.makeRequest(`/assistant/${assistantId}`, {
      method: 'DELETE',
    });
  }

  // Call Management
  async getCalls(limit?: number): Promise<VapiCall[]> {
    const params = limit ? `?limit=${limit}` : '';
    return this.makeRequest(`/call${params}`);
  }

  async getCall(callId: string): Promise<VapiCall> {
    return this.makeRequest(`/call/${callId}`);
  }

  async createCall(callData: {
    assistantId: string;
    customer: { number: string };
    metadata?: Record<string, any>;
  }): Promise<VapiCall> {
    return this.makeRequest('/call', {
      method: 'POST',
      body: JSON.stringify(callData),
    });
  }

  // Organization/Account Info
  async getAccount(): Promise<any> {
    return this.makeRequest('/account');
  }

  async getUsage(): Promise<any> {
    return this.makeRequest('/usage');
  }
}

// Default VAPI configuration
export const defaultVapiConfig: VapiConfig = {
  apiKey: process.env.REACT_APP_VAPI_API_KEY || '',
  baseUrl: 'https://api.vapi.ai',
};

// Create VAPI client instance
export const createVapiClient = (config?: Partial<VapiConfig>): VapiClient => {
  return new VapiClient({
    ...defaultVapiConfig,
    ...config,
  });
};

// Pre-built assistant templates - Users should create their own
export const assistantTemplates: Omit<VapiAssistant, 'id'>[] = [];

// Utility functions
export const validateVapiApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const client = createVapiClient({ apiKey });
    await client.getAccount();
    return true;
  } catch (error) {
    console.error('VAPI API key validation failed:', error);
    return false;
  }
};

export const formatVapiError = (error: any): string => {
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred with the VAPI service';
};