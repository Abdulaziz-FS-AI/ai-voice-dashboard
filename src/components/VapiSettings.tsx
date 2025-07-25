import React, { useState, useEffect, useCallback } from 'react';
import { createVapiClient, validateVapiApiKey, assistantTemplates, VapiAssistant } from '../utils/vapiConfig';
import { useAuth } from '../contexts/AuthContext';
import { fetchAuthSession } from 'aws-amplify/auth';
import './VapiSettings.css';

interface VapiSettingsProps {
  onBack: () => void;
  testMode?: boolean;
  isAdmin?: boolean;
}

const VapiSettings: React.FC<VapiSettingsProps> = ({ onBack, testMode = false, isAdmin = false }) => {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedAssistant, setSelectedAssistant] = useState<VapiAssistant | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [editingAssistant, setEditingAssistant] = useState<VapiAssistant | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAssistant, setNewAssistant] = useState<Partial<VapiAssistant>>({
    name: '',
    model: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      systemMessage: '',
      temperature: 0.7
    },
    voice: {
      provider: 'elevenlabs',
      voiceId: 'rachel'
    },
    firstMessage: '',
    recordingEnabled: true,
    endCallMessage: ''
  });

  // Save API key to backend
  const saveApiKeyToBackend = async (key: string) => {
    if (!user || testMode) return;
    
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/user/vapi-credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey: key })
      });

      if (!response.ok) {
        throw new Error('Failed to save API key to backend');
      }
    } catch (err) {
      console.error('Error saving API key to backend:', err);
      setError('API key validated but failed to save to backend');
    }
  };

  // Load API key from backend
  const loadApiKeyFromBackend = async () => {
    if (!user || testMode) return null;
    
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/user/vapi-credentials`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.apiKey;
      }
    } catch (err) {
      console.error('Error loading API key from backend:', err);
    }
    
    return null;
  };

  const loadAssistants = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const client = createVapiClient({ apiKey: key });
      const vapiAssistants = await client.getAssistants();
      setAssistants(vapiAssistants);
    } catch (err) {
      setError('Failed to load assistants from VAPI');
      console.error('Error loading assistants:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAccountInfo = useCallback(async (key: string) => {
    try {
      const client = createVapiClient({ apiKey: key });
      const account = await client.getAccount();
      setAccountInfo(account);
    } catch (err) {
      console.error('Error loading account info:', err);
    }
  }, []);

  const validateAndLoadAssistants = useCallback(async (key: string) => {
    setIsValidating(true);
    setError('');
    
    try {
      const valid = await validateVapiApiKey(key);
      setIsValid(valid);
      
      if (valid) {
        localStorage.setItem('vapi_api_key', key);
        await saveApiKeyToBackend(key);
        await Promise.all([
          loadAssistants(key),
          loadAccountInfo(key)
        ]);
      } else {
        setError('Invalid VAPI API key');
      }
    } catch (err) {
      setError('Failed to validate API key');
      setIsValid(false);
    } finally {
      setIsValidating(false);
    }
  }, [loadAssistants, loadAccountInfo, saveApiKeyToBackend]);

  // Load saved API key on mount
  useEffect(() => {
    const initializeApiKey = async () => {
      // First try to load from backend
      const backendKey = await loadApiKeyFromBackend();
      if (backendKey) {
        setApiKey(backendKey);
        validateAndLoadAssistants(backendKey);
        return;
      }
      
      // Fallback to localStorage
      const savedApiKey = localStorage.getItem('vapi_api_key');
      if (savedApiKey) {
        setApiKey(savedApiKey);
        validateAndLoadAssistants(savedApiKey);
      }
    };

    initializeApiKey();
  }, [validateAndLoadAssistants, loadApiKeyFromBackend]);

  const handleApiKeySubmit = () => {
    if (apiKey.trim()) {
      validateAndLoadAssistants(apiKey.trim());
    }
  };

  const createAssistantFromTemplate = async (template: Omit<VapiAssistant, 'id'>) => {
    if (!apiKey || !isValid) {
      setError('Please set a valid VAPI API key first');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const client = createVapiClient({ apiKey });
      const newAssistant = await client.createAssistant(template);
      setAssistants(prev => [...prev, newAssistant]);
      setError('');
      alert(`Assistant "${template.name}" created successfully!`);
    } catch (err: any) {
      setError(`Failed to create assistant: ${err.message || err}`);
    } finally {
      setIsCreating(false);
    }
  };

  const createCustomAssistant = async () => {
    if (!apiKey || !isValid) {
      setError('Please set a valid VAPI API key first');
      return;
    }

    if (!newAssistant.name || !newAssistant.model?.systemMessage) {
      setError('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const client = createVapiClient({ apiKey });
      const createdAssistant = await client.createAssistant(newAssistant as Omit<VapiAssistant, 'id'>);
      setAssistants(prev => [...prev, createdAssistant]);
      setShowCreateForm(false);
      setNewAssistant({
        name: '',
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          systemMessage: '',
          temperature: 0.7
        },
        voice: {
          provider: 'elevenlabs',
          voiceId: 'rachel'
        },
        firstMessage: '',
        recordingEnabled: true,
        endCallMessage: ''
      });
      alert(`Assistant "${createdAssistant.name}" created successfully!`);
    } catch (err: any) {
      setError(`Failed to create assistant: ${err.message || err}`);
    } finally {
      setIsCreating(false);
    }
  };

  const updateAssistant = async (assistantId: string, updates: Partial<VapiAssistant>) => {
    if (!apiKey || !isValid) {
      setError('Please set a valid VAPI API key first');
      return;
    }

    try {
      const client = createVapiClient({ apiKey });
      const updatedAssistant = await client.updateAssistant(assistantId, updates);
      setAssistants(prev => prev.map(a => a.id === assistantId ? updatedAssistant : a));
      setEditingAssistant(null);
      alert('Assistant updated successfully!');
    } catch (err: any) {
      setError(`Failed to update assistant: ${err.message || err}`);
    }
  };

  const deleteAssistant = async (assistantId: string) => {
    if (!window.confirm('Are you sure you want to delete this assistant?')) {
      return;
    }

    try {
      const client = createVapiClient({ apiKey });
      await client.deleteAssistant(assistantId);
      setAssistants(prev => prev.filter(a => a.id !== assistantId));
      alert('Assistant deleted successfully!');
    } catch (err: any) {
      setError(`Failed to delete assistant: ${err.message || err}`);
    }
  };

  const clearApiKey = async () => {
    setApiKey('');
    setIsValid(null);
    setAssistants([]);
    setAccountInfo(null);
    localStorage.removeItem('vapi_api_key');
    
    // Also remove from backend
    if (!testMode && user) {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        
        await fetch(`${process.env.REACT_APP_API_URL}/user/vapi-credentials`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (err) {
        console.error('Error removing API key from backend:', err);
      }
    }
  };

  return (
    <div className="vapi-settings-container">
      <div className="vapi-settings-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="header-title">
          <h2>🎯 VAPI Integration Settings</h2>
          <p>Connect your VAPI account to manage AI voice assistants</p>
        </div>
      </div>

      {/* API Key Configuration */}
      <div className="settings-section">
        <h3>🔑 VAPI API Key Configuration</h3>
        <div className="api-key-setup">
          <div className="api-key-input-group">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your VAPI API Key"
              className="api-key-input"
            />
            <button 
              onClick={handleApiKeySubmit}
              disabled={isValidating || !apiKey.trim()}
              className="validate-btn"
            >
              {isValidating ? 'Validating...' : 'Connect'}
            </button>
          </div>
          
          {isValid !== null && (
            <div className={`validation-status ${isValid ? 'valid' : 'invalid'}`}>
              {isValid ? '✅ API Key Valid & Saved' : '❌ Invalid API Key'}
            </div>
          )}
          
          {apiKey && isValid && (
            <button onClick={clearApiKey} className="clear-key-btn">
              Clear API Key
            </button>
          )}
        </div>

        <div className="api-key-help">
          <h4>How to get your VAPI API Key:</h4>
          <ol>
            <li>Go to <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer">VAPI Dashboard</a></li>
            <li>Navigate to Settings → API Keys</li>
            <li>Create a new API key or copy an existing one</li>
            <li>Paste it above and click "Connect"</li>
          </ol>
          <div className="api-key-note">
            <strong>Note:</strong> {isAdmin ? 'As an admin, your API key will be used for all assistant management.' : 'Your API key is securely stored and encrypted.'}
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {/* Account Information */}
      {accountInfo && isValid && (
        <div className="settings-section">
          <h3>Account Information</h3>
          <div className="account-info">
            <div className="info-item">
              <strong>Organization:</strong> {accountInfo.name || 'N/A'}
            </div>
            <div className="info-item">
              <strong>Plan:</strong> {accountInfo.plan || 'N/A'}
            </div>
            <div className="info-item">
              <strong>Status:</strong> 
              <span className={`status ${accountInfo.status === 'active' ? 'active' : 'inactive'}`}>
                {accountInfo.status || 'Unknown'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Assistant Templates (Admin Only) */}
      {isAdmin && isValid && (
        <div className="settings-section">
          <h3>👑 Create Voice Matrix Assistants</h3>
          <p>Create pre-configured assistants optimized for Voice Matrix platform:</p>
          
          <div className="templates-grid">
            {assistantTemplates.map((template, index) => (
              <div key={index} className="template-card">
                <div className="template-header">
                  <h4>{template.name}</h4>
                  <span className="template-badge">Template</span>
                </div>
                <p className="template-description">
                  {template.model.systemMessage.substring(0, 120)}...
                </p>
                <div className="template-details">
                  <div className="detail-item">
                    <span className="detail-label">Voice:</span>
                    <span className="detail-value">{template.voice.voiceId}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Model:</span>
                    <span className="detail-value">{template.model.model}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Provider:</span>
                    <span className="detail-value">{template.voice.provider}</span>
                  </div>
                </div>
                <button 
                  onClick={() => createAssistantFromTemplate(template)}
                  disabled={isCreating}
                  className="create-template-btn"
                >
                  {isCreating ? 'Creating...' : 'Create Assistant'}
                </button>
              </div>
            ))}
          </div>

          {/* Custom Assistant Creation */}
          <div className="custom-assistant-section">
            <div className="section-header">
              <h4>Create Custom Assistant</h4>
              <button 
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="toggle-form-btn"
              >
                {showCreateForm ? 'Cancel' : '+ Create Custom'}
              </button>
            </div>

            {showCreateForm && (
              <div className="create-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Assistant Name *</label>
                    <input
                      type="text"
                      value={newAssistant.name}
                      onChange={(e) => setNewAssistant(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter assistant name"
                    />
                  </div>

                  <div className="form-group">
                    <label>Voice Provider</label>
                    <select
                      value={newAssistant.voice?.provider}
                      onChange={(e) => setNewAssistant(prev => ({
                        ...prev,
                        voice: { ...prev.voice!, provider: e.target.value }
                      }))}
                    >
                      <option value="elevenlabs">ElevenLabs</option>
                      <option value="playht">PlayHT</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Voice ID</label>
                    <input
                      type="text"
                      value={newAssistant.voice?.voiceId}
                      onChange={(e) => setNewAssistant(prev => ({
                        ...prev,
                        voice: { ...prev.voice!, voiceId: e.target.value }
                      }))}
                      placeholder="e.g., rachel, sam, bella"
                    />
                  </div>

                  <div className="form-group">
                    <label>Model Provider</label>
                    <select
                      value={newAssistant.model?.provider}
                      onChange={(e) => setNewAssistant(prev => ({
                        ...prev,
                        model: { ...prev.model!, provider: e.target.value }
                      }))}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Model</label>
                    <select
                      value={newAssistant.model?.model}
                      onChange={(e) => setNewAssistant(prev => ({
                        ...prev,
                        model: { ...prev.model!, model: e.target.value }
                      }))}
                    >
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Temperature</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={newAssistant.model?.temperature}
                      onChange={(e) => setNewAssistant(prev => ({
                        ...prev,
                        model: { ...prev.model!, temperature: parseFloat(e.target.value) }
                      }))}
                    />
                  </div>
                </div>

                <div className="form-group full-width">
                  <label>System Message *</label>
                  <textarea
                    value={newAssistant.model?.systemMessage}
                    onChange={(e) => setNewAssistant(prev => ({
                      ...prev,
                      model: { ...prev.model!, systemMessage: e.target.value }
                    }))}
                    placeholder="Enter the system prompt for your assistant..."
                    rows={4}
                  />
                </div>

                <div className="form-group full-width">
                  <label>First Message</label>
                  <input
                    type="text"
                    value={newAssistant.firstMessage}
                    onChange={(e) => setNewAssistant(prev => ({ ...prev, firstMessage: e.target.value }))}
                    placeholder="Hello! How can I help you today?"
                  />
                </div>

                <div className="form-group full-width">
                  <label>End Call Message</label>
                  <input
                    type="text"
                    value={newAssistant.endCallMessage}
                    onChange={(e) => setNewAssistant(prev => ({ ...prev, endCallMessage: e.target.value }))}
                    placeholder="Thank you for calling. Have a great day!"
                  />
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={newAssistant.recordingEnabled}
                      onChange={(e) => setNewAssistant(prev => ({ ...prev, recordingEnabled: e.target.checked }))}
                    />
                    Enable Recording
                  </label>
                </div>

                <div className="form-actions">
                  <button 
                    onClick={createCustomAssistant}
                    disabled={isCreating}
                    className="create-btn"
                  >
                    {isCreating ? 'Creating...' : 'Create Assistant'}
                  </button>
                  <button 
                    onClick={() => setShowCreateForm(false)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Existing Assistants */}
      {isValid && (
        <div className="settings-section">
          <h3>🤖 Your VAPI Assistants ({assistants.length})</h3>
          
          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
              <span>Loading assistants...</span>
            </div>
          ) : assistants.length > 0 ? (
            <div className="assistants-list">
              {assistants.map((assistant) => (
                <div key={assistant.id} className="assistant-item">
                  <div className="assistant-info">
                    <h4>{assistant.name}</h4>
                    <p className="assistant-id">ID: {assistant.id}</p>
                    <div className="assistant-meta">
                      <span>🎙️ {assistant.voice?.voiceId || 'Default'}</span>
                      <span>🤖 {assistant.model?.model || 'Default'}</span>
                      <span>📝 {assistant.recordingEnabled ? 'Recording On' : 'Recording Off'}</span>
                    </div>
                    {assistant.firstMessage && (
                      <p className="first-message">"{assistant.firstMessage}"</p>
                    )}
                  </div>
                  <div className="assistant-actions">
                    <button 
                      onClick={() => setSelectedAssistant(assistant)}
                      className="view-btn"
                    >
                      View Details
                    </button>
                    {isAdmin && (
                      <>
                        <button 
                          onClick={() => setEditingAssistant(assistant)}
                          className="edit-btn"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => deleteAssistant(assistant.id!)}
                          className="delete-btn"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-assistants">
              <div className="no-assistants-icon">🤖</div>
              <h4>No assistants found</h4>
              <p>No assistants found in your VAPI account.</p>
              {isAdmin && <p>Use the templates above to create your first Voice Matrix assistants.</p>}
            </div>
          )}
        </div>
      )}

      {/* Edit Assistant Modal */}
      {editingAssistant && (
        <div className="modal-overlay" onClick={() => setEditingAssistant(null)}>
          <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Assistant: {editingAssistant.name}</h3>
              <button onClick={() => setEditingAssistant(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="edit-form">
                <div className="form-group">
                  <label>Assistant Name</label>
                  <input
                    type="text"
                    value={editingAssistant.name}
                    onChange={(e) => setEditingAssistant(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </div>

                <div className="form-group">
                  <label>First Message</label>
                  <input
                    type="text"
                    value={editingAssistant.firstMessage || ''}
                    onChange={(e) => setEditingAssistant(prev => prev ? { ...prev, firstMessage: e.target.value } : null)}
                  />
                </div>

                <div className="form-group">
                  <label>End Call Message</label>
                  <input
                    type="text"
                    value={editingAssistant.endCallMessage || ''}
                    onChange={(e) => setEditingAssistant(prev => prev ? { ...prev, endCallMessage: e.target.value } : null)}
                  />
                </div>

                <div className="form-group">
                  <label>System Message</label>
                  <textarea
                    value={editingAssistant.model?.systemMessage || ''}
                    onChange={(e) => setEditingAssistant(prev => prev ? {
                      ...prev,
                      model: { ...prev.model!, systemMessage: e.target.value }
                    } : null)}
                    rows={6}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Voice Provider</label>
                    <select
                      value={editingAssistant.voice?.provider || 'elevenlabs'}
                      onChange={(e) => setEditingAssistant(prev => prev ? {
                        ...prev,
                        voice: { ...prev.voice!, provider: e.target.value }
                      } : null)}
                    >
                      <option value="elevenlabs">ElevenLabs</option>
                      <option value="playht">PlayHT</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Voice ID</label>
                    <input
                      type="text"
                      value={editingAssistant.voice?.voiceId || ''}
                      onChange={(e) => setEditingAssistant(prev => prev ? {
                        ...prev,
                        voice: { ...prev.voice!, voiceId: e.target.value }
                      } : null)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Model Provider</label>
                    <select
                      value={editingAssistant.model?.provider || 'openai'}
                      onChange={(e) => setEditingAssistant(prev => prev ? {
                        ...prev,
                        model: { ...prev.model!, provider: e.target.value }
                      } : null)}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Model</label>
                    <select
                      value={editingAssistant.model?.model || 'gpt-3.5-turbo'}
                      onChange={(e) => setEditingAssistant(prev => prev ? {
                        ...prev,
                        model: { ...prev.model!, model: e.target.value }
                      } : null)}
                    >
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={editingAssistant.recordingEnabled || false}
                      onChange={(e) => setEditingAssistant(prev => prev ? {
                        ...prev,
                        recordingEnabled: e.target.checked
                      } : null)}
                    />
                    Enable Recording
                  </label>
                </div>

                <div className="modal-actions">
                  <button 
                    onClick={() => updateAssistant(editingAssistant.id!, editingAssistant)}
                    className="save-btn"
                  >
                    Save Changes
                  </button>
                  <button 
                    onClick={() => setEditingAssistant(null)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assistant Details Modal */}
      {selectedAssistant && (
        <div className="modal-overlay" onClick={() => setSelectedAssistant(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedAssistant.name}</h3>
              <button onClick={() => setSelectedAssistant(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="assistant-detail">
                <strong>Assistant ID:</strong> 
                <code>{selectedAssistant.id}</code>
              </div>
              <div className="assistant-detail">
                <strong>First Message:</strong> 
                <p>{selectedAssistant.firstMessage}</p>
              </div>
              <div className="assistant-detail">
                <strong>End Call Message:</strong> 
                <p>{selectedAssistant.endCallMessage}</p>
              </div>
              <div className="assistant-detail">
                <strong>System Message:</strong> 
                <div className="system-message">{selectedAssistant.model?.systemMessage}</div>
              </div>
              <div className="assistant-detail">
                <strong>Voice Configuration:</strong> 
                <p>{selectedAssistant.voice?.voiceId} ({selectedAssistant.voice?.provider})</p>
              </div>
              <div className="assistant-detail">
                <strong>Model Configuration:</strong> 
                <p>{selectedAssistant.model?.model} ({selectedAssistant.model?.provider})</p>
              </div>
              <div className="assistant-detail">
                <strong>Recording:</strong> 
                <span className={`status ${selectedAssistant.recordingEnabled ? 'active' : 'inactive'}`}>
                  {selectedAssistant.recordingEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {selectedAssistant.endCallPhrases && selectedAssistant.endCallPhrases.length > 0 && (
                <div className="assistant-detail">
                  <strong>End Call Phrases:</strong> 
                  <div className="phrases">
                    {selectedAssistant.endCallPhrases.map((phrase, i) => (
                      <span key={i} className="phrase">{phrase}</span>
                    ))}
                  </div>
                </div>
              )}
              {isAdmin && (
                <div className="modal-actions">
                  <button 
                    onClick={() => {
                      setSelectedAssistant(null);
                      setEditingAssistant(selectedAssistant);
                    }}
                    className="edit-btn"
                  >
                    Edit Assistant
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {testMode && (
        <div className="test-mode-banner">
          🧪 Test Mode - VAPI integration available in production
        </div>
      )}
    </div>
  );
};

export default VapiSettings;