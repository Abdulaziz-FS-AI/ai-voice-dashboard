import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './VoiceAgentEditor.css';

interface VapiAssistant {
  id: string;
  name: string;
  model: {
    provider: string;
    model: string;
    messages?: Array<{
      role: string;
      content: string;
    }>;
  };
  voice: {
    provider: string;
    voiceId: string;
  };
  firstMessage?: string;
  serverUrl?: string;
  metadata?: any;
}

interface AgentConfig {
  companyName: string;
  welcomeMessage: string;
  voiceGender: 'male' | 'female';
  voiceAccent: string;
  personality: string;
  questions: Question[];
}

interface Question {
  id: string;
  question: string;
  type: 'text' | 'multiple-choice' | 'yes-no' | 'number';
  options?: string[];
  required: boolean;
}

interface VoiceAgentEditorProps {
  onSave: (config: AgentConfig) => void;
  onNavigate: (page: 'dashboard' | 'editor') => void;
}

const VoiceAgentEditor: React.FC<VoiceAgentEditorProps> = ({ onSave, onNavigate }) => {
  const { user } = useAuth();
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [selectedAssistant, setSelectedAssistant] = useState<VapiAssistant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [config, setConfig] = useState<AgentConfig>({
    companyName: 'Voice Matrix',
    welcomeMessage: 'Hello! Welcome to Voice Matrix. How can our AI assistant help you today?',
    voiceGender: 'female',
    voiceAccent: 'american',
    personality: 'professional',
    questions: []
  });

  const [newQuestion, setNewQuestion] = useState<Question>({
    id: '',
    question: '',
    type: 'text',
    options: [],
    required: false
  });

  const [showQuestionForm, setShowQuestionForm] = useState(false);

  useEffect(() => {
    fetchAssistants();
  }, []);

  const fetchAssistants = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const token = await user.getJWTToken();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/vapi/assistants`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAssistants(data);
        if (data.length > 0) {
          setSelectedAssistant(data[0]);
          loadAssistantConfig(data[0]);
        }
      } else if (response.status === 400) {
        setMessage({ type: 'error', text: 'Please configure your VAPI credentials first' });
      }
    } catch (error) {
      console.error('Error fetching assistants:', error);
      setMessage({ type: 'error', text: 'Failed to load assistants' });
    } finally {
      setLoading(false);
    }
  };

  const loadAssistantConfig = (assistant: VapiAssistant) => {
    // Convert VAPI assistant to our config format
    const systemMessage = assistant.model.messages?.find(m => m.role === 'system')?.content || '';
    
    setConfig({
      companyName: assistant.metadata?.companyName || assistant.name,
      welcomeMessage: assistant.firstMessage || 'Hello! How can I help you today?',
      voiceGender: getVoiceGender(assistant.voice.voiceId),
      voiceAccent: getVoiceAccent(assistant.voice.voiceId),
      personality: extractPersonality(systemMessage),
      questions: assistant.metadata?.questions || []
    });
  };

  const getVoiceGender = (voiceId: string): 'male' | 'female' => {
    // Map VAPI voice IDs to gender (this is a simplified mapping)
    const femaleVoices = ['jennifer', 'alloy', 'nova', 'sarah'];
    return femaleVoices.some(v => voiceId.toLowerCase().includes(v)) ? 'female' : 'male';
  };

  const getVoiceAccent = (voiceId: string): string => {
    // Map VAPI voice IDs to accents (simplified)
    if (voiceId.toLowerCase().includes('british')) return 'british';
    if (voiceId.toLowerCase().includes('australian')) return 'australian';
    if (voiceId.toLowerCase().includes('canadian')) return 'canadian';
    return 'american';
  };

  const extractPersonality = (systemMessage: string): string => {
    if (systemMessage.toLowerCase().includes('professional')) return 'professional';
    if (systemMessage.toLowerCase().includes('friendly')) return 'friendly';
    if (systemMessage.toLowerCase().includes('casual')) return 'casual';
    if (systemMessage.toLowerCase().includes('formal')) return 'formal';
    if (systemMessage.toLowerCase().includes('enthusiastic')) return 'enthusiastic';
    return 'professional';
  };

  const handleConfigChange = (field: keyof AgentConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const addQuestion = () => {
    if (newQuestion.question.trim()) {
      const questionWithId = {
        ...newQuestion,
        id: Date.now().toString()
      };
      setConfig(prev => ({
        ...prev,
        questions: [...prev.questions, questionWithId]
      }));
      setNewQuestion({
        id: '',
        question: '',
        type: 'text',
        options: [],
        required: false
      });
      setShowQuestionForm(false);
    }
  };

  const removeQuestion = (id: string) => {
    setConfig(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== id)
    }));
  };

  const handleSave = async () => {
    if (!selectedAssistant || !user) return;

    setSaving(true);
    setMessage(null);

    try {
      // Build VAPI assistant configuration
      const vapiConfig = buildVapiConfig(config);
      
      const token = await user.getJWTToken();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/vapi/assistants/${selectedAssistant.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(vapiConfig)
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Assistant configuration saved successfully!' });
        onSave(config);
        await fetchAssistants(); // Refresh the list
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save configuration' });
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      setMessage({ type: 'error', text: 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  const buildVapiConfig = (config: AgentConfig) => {
    // Convert our config to VAPI format
    const systemPrompt = buildSystemPrompt(config);
    const voiceId = getVapiVoiceId(config.voiceGender, config.voiceAccent);

    return {
      name: config.companyName,
      firstMessage: config.welcomeMessage,
      model: {
        provider: 'openai',
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          }
        ]
      },
      voice: {
        provider: 'playht',
        voiceId: voiceId
      },
      metadata: {
        companyName: config.companyName,
        questions: config.questions,
        personality: config.personality
      }
    };
  };

  const buildSystemPrompt = (config: AgentConfig): string => {
    let prompt = `You are a ${config.personality} AI assistant for ${config.companyName}. `;
    
    if (config.questions.length > 0) {
      prompt += `\n\nDuring the call, please ask the following questions:\n`;
      config.questions.forEach((q, index) => {
        prompt += `${index + 1}. ${q.question}`;
        if (q.required) prompt += ' (Required)';
        if (q.options && q.options.length > 0) {
          prompt += ` Options: ${q.options.join(', ')}`;
        }
        prompt += '\n';
      });
    }

    prompt += `\nAlways be ${config.personality} and helpful. Keep responses concise and focused.`;
    
    return prompt;
  };

  const getVapiVoiceId = (gender: string, accent: string): string => {
    // Map our settings to VAPI voice IDs
    const voiceMap: { [key: string]: string } = {
      'female-american': 'jennifer',
      'female-british': 'sarah-british',
      'female-australian': 'lisa-australian',
      'female-canadian': 'nova',
      'male-american': 'matthew',
      'male-british': 'arthur-british',
      'male-australian': 'jack-australian',
      'male-canadian': 'liam'
    };
    
    return voiceMap[`${gender}-${accent}`] || 'jennifer';
  };

  const addOption = () => {
    setNewQuestion(prev => ({
      ...prev,
      options: [...(prev.options || []), '']
    }));
  };

  const updateOption = (index: number, value: string) => {
    setNewQuestion(prev => ({
      ...prev,
      options: prev.options?.map((opt, i) => i === index ? value : opt)
    }));
  };

  const removeOption = (index: number) => {
    setNewQuestion(prev => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="voice-editor-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading VAPI assistants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-editor-container">
      <div className="editor-header">
        <div className="header-logo">
          <img 
            src="/voice-matrix-logo.png" 
            alt="Voice Matrix" 
            className="editor-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="header-title">
            <h1>Voice Matrix Agent Configuration</h1>
            <span className="editor-subtitle">Customize Your VAPI Assistant</span>
          </div>
        </div>
        <div className="header-buttons">
          <button className="nav-button" onClick={() => onNavigate('dashboard')}>
            Dashboard
          </button>
          <button 
            className="save-button" 
            onClick={handleSave}
            disabled={saving || !selectedAssistant}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {assistants.length > 0 && (
        <div className="assistant-selector">
          <label>Select Assistant to Edit:</label>
          <select
            value={selectedAssistant?.id || ''}
            onChange={(e) => {
              const assistant = assistants.find(a => a.id === e.target.value);
              if (assistant) {
                setSelectedAssistant(assistant);
                loadAssistantConfig(assistant);
              }
            }}
          >
            {assistants.map(assistant => (
              <option key={assistant.id} value={assistant.id}>
                {assistant.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="editor-content">
        <div className="config-section">
          <h2>Basic Settings</h2>
          <div className="form-group">
            <label>Company/Agency Name:</label>
            <input
              type="text"
              value={config.companyName}
              onChange={(e) => handleConfigChange('companyName', e.target.value)}
              placeholder="Enter your company name"
            />
          </div>

          <div className="form-group">
            <label>Welcome Message:</label>
            <textarea
              value={config.welcomeMessage}
              onChange={(e) => handleConfigChange('welcomeMessage', e.target.value)}
              placeholder="Hello! Welcome to [Company Name]. How can I help you today?"
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Voice Gender:</label>
              <select
                value={config.voiceGender}
                onChange={(e) => handleConfigChange('voiceGender', e.target.value)}
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>

            <div className="form-group">
              <label>Voice Accent:</label>
              <select
                value={config.voiceAccent}
                onChange={(e) => handleConfigChange('voiceAccent', e.target.value)}
              >
                <option value="american">American</option>
                <option value="british">British</option>
                <option value="australian">Australian</option>
                <option value="canadian">Canadian</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Personality:</label>
            <select
              value={config.personality}
              onChange={(e) => handleConfigChange('personality', e.target.value)}
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="casual">Casual</option>
              <option value="formal">Formal</option>
              <option value="enthusiastic">Enthusiastic</option>
            </select>
          </div>
        </div>

        <div className="questions-section">
          <div className="section-header">
            <h2>Call Questions</h2>
            <button 
              className="add-question-button"
              onClick={() => setShowQuestionForm(true)}
            >
              + Add Question
            </button>
          </div>

          {config.questions.length > 0 && (
            <div className="questions-list">
              {config.questions.map((question, index) => (
                <div key={question.id} className="question-item">
                  <div className="question-header">
                    <span className="question-number">Q{index + 1}</span>
                    <span className="question-type">{question.type}</span>
                    <button 
                      className="remove-button"
                      onClick={() => removeQuestion(question.id)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="question-content">
                    <p>{question.question}</p>
                    {question.options && question.options.length > 0 && (
                      <div className="question-options">
                        <strong>Options:</strong>
                        <ul>
                          {question.options.map((option, i) => (
                            <li key={i}>{option}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {question.required && <span className="required-badge">Required</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showQuestionForm && (
            <div className="question-form">
              <h3>Add New Question</h3>
              
              <div className="form-group">
                <label>Question:</label>
                <input
                  type="text"
                  value={newQuestion.question}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, question: e.target.value }))}
                  placeholder="What question should the AI ask?"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Question Type:</label>
                  <select
                    value={newQuestion.type}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, type: e.target.value as any }))}
                  >
                    <option value="text">Text Response</option>
                    <option value="multiple-choice">Multiple Choice</option>
                    <option value="yes-no">Yes/No</option>
                    <option value="number">Number</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={newQuestion.required}
                      onChange={(e) => setNewQuestion(prev => ({ ...prev, required: e.target.checked }))}
                    />
                    Required
                  </label>
                </div>
              </div>

              {newQuestion.type === 'multiple-choice' && (
                <div className="options-section">
                  <label>Options:</label>
                  {newQuestion.options?.map((option, index) => (
                    <div key={index} className="option-input">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                      />
                      <button 
                        type="button"
                        onClick={() => removeOption(index)}
                        className="remove-option-button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addOption} className="add-option-button">
                    + Add Option
                  </button>
                </div>
              )}

              <div className="form-actions">
                <button onClick={addQuestion} className="confirm-button">
                  Add Question
                </button>
                <button onClick={() => setShowQuestionForm(false)} className="cancel-button">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceAgentEditor;