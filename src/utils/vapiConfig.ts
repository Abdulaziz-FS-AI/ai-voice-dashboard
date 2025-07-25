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

// Pre-built assistant templates for Voice Matrix
export const assistantTemplates: Omit<VapiAssistant, 'id'>[] = [
  {
    name: 'Sales Professional',
    model: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      systemMessage: `You are a professional sales assistant for Voice Matrix. Your goal is to qualify leads and gather important information about potential customers.

Key behaviors:
- Be friendly, professional, and helpful
- Ask qualifying questions about their business needs
- Gather contact information and budget information
- Schedule follow-up calls when appropriate
- Always remain positive and solution-focused

Remember to speak naturally and conversationally while gathering the necessary information.`,
      temperature: 0.7,
    },
    voice: {
      provider: 'elevenlabs',
      voiceId: 'rachel', // Professional female voice
    },
    firstMessage: 'Hi! Thank you for your interest in Voice Matrix. I\'m here to learn more about your business needs and see how our AI voice solutions can help you. Could you start by telling me what type of business you\'re in?',
    recordingEnabled: true,
    endCallMessage: 'Thank you for your time! Someone from our team will follow up with you soon.',
    endCallPhrases: ['goodbye', 'thank you', 'that\'s all', 'end call'],
  },
  {
    name: 'Customer Support',
    model: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      systemMessage: `You are a helpful customer support assistant for Voice Matrix. Your role is to help customers with their questions, resolve issues, and gather feedback.

Key behaviors:
- Be empathetic and understanding
- Listen carefully to customer concerns
- Provide clear and helpful solutions
- Escalate complex issues when needed
- Gather feedback about our services

Always maintain a helpful and professional tone throughout the conversation.`,
      temperature: 0.5,
    },
    voice: {
      provider: 'elevenlabs',
      voiceId: 'sam', // Friendly voice
    },
    firstMessage: 'Hello! I\'m here to help you with any questions or concerns you might have about Voice Matrix. What can I assist you with today?',
    recordingEnabled: true,
    endCallMessage: 'Thank you for contacting Voice Matrix support. Have a great day!',
    endCallPhrases: ['resolved', 'thank you', 'goodbye', 'that helps'],
  },
  {
    name: 'Appointment Scheduler',
    model: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      systemMessage: `You are an appointment scheduling assistant for Voice Matrix. Your job is to help customers schedule appointments, consultations, or demos.

Key behaviors:
- Gather preferred dates and times
- Check availability (assume you have access to calendar)
- Collect contact information for confirmation
- Ask about specific needs for the appointment
- Confirm all details before ending the call

Be efficient but thorough in gathering all necessary information.`,
      temperature: 0.3,
    },
    voice: {
      provider: 'elevenlabs',
      voiceId: 'bella', // Professional scheduling voice
    },
    firstMessage: 'Hi! I\'d be happy to help you schedule an appointment with Voice Matrix. What type of appointment are you looking to book?',
    recordingEnabled: true,
    endCallMessage: 'Perfect! Your appointment has been scheduled. You\'ll receive a confirmation email shortly.',
    endCallPhrases: ['scheduled', 'confirmed', 'thank you', 'perfect'],
  },
  {
    name: 'Market Researcher',
    model: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      systemMessage: `You are a market research assistant conducting surveys and gathering insights for Voice Matrix. Your goal is to collect valuable feedback and market data.

Key behaviors:
- Ask structured survey questions
- Gather demographic information
- Collect feedback about products/services
- Ask about pain points and needs
- Keep responses organized and clear

Maintain a professional but conversational tone throughout the research process.`,
      temperature: 0.4,
    },
    voice: {
      provider: 'elevenlabs',
      voiceId: 'josh', // Professional research voice
    },
    firstMessage: 'Hello! I\'m conducting a brief market research survey for Voice Matrix. This will only take a few minutes of your time. Would you be willing to participate?',
    recordingEnabled: true,
    endCallMessage: 'Thank you so much for participating in our research. Your feedback is very valuable to us!',
    endCallPhrases: ['completed', 'finished', 'thank you', 'done'],
  },
  {
    name: 'Virtual Receptionist',
    model: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      systemMessage: `You are a virtual receptionist for Voice Matrix. Your role is to greet callers, direct them to the right department, and handle general inquiries.

Key behaviors:
- Greet callers professionally
- Identify the purpose of their call
- Route calls to appropriate departments
- Take messages when needed
- Provide basic company information

Always be welcoming and helpful while efficiently handling each call.`,
      temperature: 0.2,
    },
    voice: {
      provider: 'elevenlabs',
      voiceId: 'rachel', // Professional receptionist voice
    },
    firstMessage: 'Thank you for calling Voice Matrix! How may I direct your call today?',
    recordingEnabled: true,
    endCallMessage: 'Thank you for calling Voice Matrix. Have a wonderful day!',
    endCallPhrases: ['transferred', 'goodbye', 'thank you', 'completed'],
  },
];

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