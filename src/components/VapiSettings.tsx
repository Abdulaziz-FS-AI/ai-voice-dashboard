import React, { useState, useEffect, useCallback } from 'react';
import { createVapiClient, validateVapiApiKey, assistantTemplates, VapiAssistant } from '../utils/vapiConfig';
import './VapiSettings.css';

interface VapiSettingsProps {
  onBack: () => void;
  testMode?: boolean;
  isAdmin?: boolean;
}

const VapiSettings: React.FC<VapiSettingsProps> = ({ onBack, testMode = false, isAdmin = false }) => {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedAssistant, setSelectedAssistant] = useState<VapiAssistant | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [accountInfo, setAccountInfo] = useState<any>(null);

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
  }, [loadAssistants, loadAccountInfo]);

  // Load saved API key on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('vapi_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      validateAndLoadAssistants(savedApiKey);
    }
  }, [validateAndLoadAssistants]);

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
      alert(`Assistant "${template.name}" created successfully!`);
    } catch (err: any) {
      setError(`Failed to create assistant: ${err.message || err}`);
    } finally {
      setIsCreating(false);
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

  const clearApiKey = () => {
    setApiKey('');
    setIsValid(null);
    setAssistants([]);
    setAccountInfo(null);
    localStorage.removeItem('vapi_api_key');
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
        <h3>VAPI API Key Configuration</h3>
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
              {isValid ? '✅ API Key Valid' : '❌ Invalid API Key'}
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
        </div>
      )}

      {/* Existing Assistants */}
      {isValid && (
        <div className="settings-section">
          <h3>Your VAPI Assistants ({assistants.length})</h3>
          
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
                  </div>
                  <div className="assistant-actions">
                    <button 
                      onClick={() => setSelectedAssistant(assistant)}
                      className="view-btn"
                    >
                      View Details
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={() => deleteAssistant(assistant.id!)}
                        className="delete-btn"
                      >
                        Delete
                      </button>
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