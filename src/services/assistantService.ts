import { apiCall, API_CONFIG } from '../config/api';

export interface Assistant {
  id: string;
  name: string;
  vapiId: string;
  createdAt: string;
  phoneNumber?: string;
  isActive: boolean;
  model: {
    provider: string;
    model: string;
    messages: Array<{ role: string; content: string }>;
  };
  voice: {
    provider: string;
    voiceId: string;
  };
  firstMessage: string;
  recordingEnabled: boolean;
}

export interface CreateAssistantRequest {
  name: string;
  customConfig: {
    model: {
      provider: string;
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    voice: {
      provider: string;
      voiceId: string;
    };
    firstMessage: string;
    recordingEnabled: boolean;
  };
}

export class AssistantService {
  static async getAssistants(): Promise<{ assistants: Assistant[] }> {
    try {
      const response = await apiCall(API_CONFIG.ENDPOINTS.VAPI_ASSISTANTS);
      
      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        console.log('No assistants found or API error');
        return { assistants: [] };
      }
    } catch (error) {
      console.error('Error loading assistants:', error);
      return { assistants: [] };
    }
  }

  static async createAssistant(assistantData: CreateAssistantRequest): Promise<Assistant> {
    const response = await apiCall(API_CONFIG.ENDPOINTS.VAPI_ASSISTANTS, {
      method: 'POST',
      body: JSON.stringify(assistantData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create assistant');
    }

    return await response.json();
  }

  static async updateAssistant(assistantId: string, updates: Partial<CreateAssistantRequest>): Promise<Assistant> {
    const response = await apiCall(API_CONFIG.ENDPOINTS.VAPI_UPDATE_ASSISTANT(assistantId), {
      method: 'PUT',
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update assistant');
    }

    return await response.json();
  }

  static async deleteAssistant(assistantId: string): Promise<void> {
    const response = await apiCall(API_CONFIG.ENDPOINTS.VAPI_DELETE_ASSISTANT(assistantId), {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete assistant');
    }
  }

  static async getTemplates(): Promise<Assistant[]> {
    try {
      const response = await apiCall(API_CONFIG.ENDPOINTS.VAPI_TEMPLATES);
      
      if (response.ok) {
        const data = await response.json();
        return data.templates || [];
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      return [];
    }
  }

  static async linkPhoneToAssistant(assistantId: string, phoneData: any): Promise<void> {
    const response = await apiCall(API_CONFIG.ENDPOINTS.VAPI_LINK_PHONE(assistantId), {
      method: 'POST',
      body: JSON.stringify(phoneData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to link phone to assistant');
    }
  }
}

export default AssistantService;