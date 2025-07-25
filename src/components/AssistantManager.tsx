import React, { useState, useEffect } from 'react';
import { AssistantService, Assistant, CreateAssistantRequest } from '../services/assistantService';
import { useAuth } from '../contexts/AuthContext';
import './AssistantManager.css';


interface VoiceOption {
  id: string;
  name: string;
  provider: string;
}

const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'jennifer', name: 'Jennifer (Female)', provider: 'playht' },
  { id: 'ryan', name: 'Ryan (Male)', provider: 'playht' },
  { id: 'sarah', name: 'Sarah (Female)', provider: 'playht' },
  { id: 'mark', name: 'Mark (Male)', provider: 'playht' },
  { id: 'bella', name: 'Bella (Female)', provider: '11labs' },
  { id: 'adam', name: 'Adam (Male)', provider: '11labs' },
  { id: 'rachel', name: 'Rachel (Female)', provider: '11labs' },
  { id: 'daniel', name: 'Daniel (Male)', provider: '11labs' }
];

interface AssistantManagerProps {
  onBack: () => void;
}

const AssistantManager: React.FC<AssistantManagerProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    voice: 'jennifer',
    voiceProvider: 'playht',
    systemPrompt: '',
    firstMessage: '',
    questions: ['']
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAssistants();
  }, []);

  const loadAssistants = async () => {
    try {
      setLoading(true);
      const data = await AssistantService.getAssistants();
      setAssistants(data.assistants || []);
    } catch (error) {
      console.error('Error loading assistants:', error);
      setAssistants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceChange = (voiceId: string) => {
    const voice = VOICE_OPTIONS.find(v => v.id === voiceId);
    setFormData(prev => ({
      ...prev,
      voice: voiceId,
      voiceProvider: voice?.provider || 'playht'
    }));
  };

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, '']
    }));
  };

  const removeQuestion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const updateQuestion = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === index ? value : q)
    }));
  };

  const handleCreateAssistant = async () => {
    if (!formData.name.trim()) {
      setError('Assistant name is required');
      return;
    }

    if (!user?.userId) {
      setError('User authentication required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // Build system prompt with questions
      const validQuestions = formData.questions.filter(q => q.trim());
      let systemPrompt = formData.systemPrompt || 'You are a helpful AI assistant.';
      
      if (validQuestions.length > 0) {
        systemPrompt += '\n\nDuring the conversation, try to naturally collect the following information:';
        validQuestions.forEach((question, index) => {
          systemPrompt += `\n${index + 1}. ${question}`;
        });
        systemPrompt += '\n\nCollect this information naturally during the conversation, not all at once.';
      }

      const assistantConfig: CreateAssistantRequest = {
        name: formData.name,
        customConfig: {
          model: {
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: systemPrompt
              }
            ]
          },
          voice: {
            provider: formData.voiceProvider,
            voiceId: formData.voice
          },
          firstMessage: formData.firstMessage || `Hello! I'm ${formData.name}. How can I help you today?`,
          recordingEnabled: true
        }
      };

      const result = await AssistantService.createAssistant(assistantConfig);
      console.log('✅ Assistant created:', result);
      
      // Reset form
      setFormData({
        name: '',
        voice: 'jennifer',
        voiceProvider: 'playht',
        systemPrompt: '',
        firstMessage: '',
        questions: ['']
      });
      setShowCreateForm(false);
      
      // Reload assistants
      await loadAssistants();
    } catch (error: any) {
      console.error('Error creating assistant:', error);
      setError(error.message || 'Failed to create assistant. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAssistant = async (assistantId: string, assistantName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${assistantName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await AssistantService.deleteAssistant(assistantId);
      console.log('✅ Assistant deleted');
      await loadAssistants();
    } catch (error: any) {
      console.error('Error deleting assistant:', error);
      alert(`Failed to delete assistant: ${error.message || 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="assistant-manager">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading assistants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assistant-manager">
      <div className="manager-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <h1>AI Assistant Manager</h1>
        <button 
          className="create-button" 
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
        >
          + Create New Assistant
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {showCreateForm && (
        <div className="create-form">
          <div className="form-header">
            <h2>Create New Assistant</h2>
            <button 
              className="cancel-button" 
              onClick={() => {
                setShowCreateForm(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>

          <div className="form-grid">
            <div className="form-section">
              <h3>Basic Information</h3>
              
              <div className="form-group">
                <label>Assistant Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Sales Assistant, Support Bot"
                  required
                />
              </div>

              <div className="form-group">
                <label>Voice Selection</label>
                <select
                  value={formData.voice}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                >
                  {VOICE_OPTIONS.map(voice => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} ({voice.provider})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>First Message</label>
                <textarea
                  value={formData.firstMessage}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstMessage: e.target.value }))}
                  placeholder="Hello! How can I help you today?"
                  rows={2}
                />
              </div>
            </div>

            <div className="form-section">
              <h3>System Instructions</h3>
              
              <div className="form-group">
                <label>System Prompt</label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="You are a helpful assistant that..."
                  rows={4}
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Information Collection</h3>
              <p className="section-description">
                Add questions you want the assistant to collect during conversations
              </p>
              
              {formData.questions.map((question, index) => (
                <div key={index} className="question-group">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => updateQuestion(index, e.target.value)}
                    placeholder="e.g., What's your company name?"
                  />
                  {formData.questions.length > 1 && (
                    <button 
                      type="button"
                      className="remove-question"
                      onClick={() => removeQuestion(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              
              <button 
                type="button" 
                className="add-question"
                onClick={addQuestion}
              >
                + Add Question
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button 
              className="create-assistant-button" 
              onClick={handleCreateAssistant}
              disabled={creating || !formData.name.trim()}
            >
              {creating ? 'Creating...' : 'Create Assistant'}
            </button>
          </div>
        </div>
      )}

      <div className="assistants-grid">
        {assistants.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🤖</div>
            <h3>No assistants yet</h3>
            <p>Create your first AI assistant to get started</p>
            <button 
              className="create-first-button" 
              onClick={() => setShowCreateForm(true)}
            >
              Create First Assistant
            </button>
          </div>
        ) : (
          assistants.map(assistant => (
            <div key={assistant.id} className="assistant-card">
              <div className="card-header">
                <h3>{assistant.name}</h3>
                <div className="card-actions">
                  <button 
                    className="delete-button"
                    onClick={() => handleDeleteAssistant(assistant.id, assistant.name)}
                    title="Delete assistant"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              <div className="card-details">
                <div className="detail-row">
                  <span className="label">Voice:</span>
                  <span>{assistant.voice?.voiceId} ({assistant.voice?.provider})</span>
                </div>
                <div className="detail-row">
                  <span className="label">Model:</span>
                  <span>{assistant.model?.model}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Created:</span>
                  <span>{new Date(assistant.createdAt).toLocaleDateString()}</span>
                </div>
                {assistant.phoneNumber && (
                  <div className="detail-row">
                    <span className="label">Phone:</span>
                    <span>{assistant.phoneNumber}</span>
                  </div>
                )}
              </div>
              
              <div className="card-status">
                <span className={`status-badge ${assistant.isActive ? 'active' : 'inactive'}`}>
                  {assistant.isActive ? '🟢 Active' : '🔴 Inactive'}
                </span>
              </div>
              
              <div className="card-preview">
                <div className="first-message">
                  <strong>First Message:</strong>
                  <p>"{assistant.firstMessage}"</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AssistantManager;