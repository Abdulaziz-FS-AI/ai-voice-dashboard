import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiCall, API_CONFIG } from '../config/api';
import './VapiSettings.css';

interface VapiSettingsProps {
  onBack: () => void;
  testMode?: boolean;
  isAdmin?: boolean;
}

interface VapiAssistant {
  id: string;
  name: string;
  model: any;
  voice: any;
  firstMessage: string;
  recordingEnabled: boolean;
  endCallMessage: string;
  createdAt: string;
}

const VapiSettings: React.FC<VapiSettingsProps> = ({ onBack, testMode = false, isAdmin = false }) => {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [assistants, setAssistants] = useState<VapiAssistant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  // Load existing API key from backend
  const loadExistingApiKey = useCallback(async () => {
    if (!user || testMode) return;
    
    try {
      const response = await apiCall(API_CONFIG.ENDPOINTS.VAPI_CREDENTIALS);
      
      if (response.ok) {
        const data = await response.json();
        if (data.hasCredentials) {
          setHasExistingKey(true);
          setIsValid(true);
          setApiKey('••••••••••••••••'); // Masked display
          await loadAssistants();
          await loadAccountInfo();
        }
      }
    } catch (err) {
      console.error('Error loading existing API key:', err);
    }
  }, [user, testMode]);

  // Save API key to backend
  const saveApiKey = async (key: string) => {
    try {
      const response = await apiCall(API_CONFIG.ENDPOINTS.VAPI_CREDENTIALS, {
        method: 'POST',
        body: JSON.stringify({ apiKey: key.trim() })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save API key');
      }

      return true;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to save API key');
    }
  };

  // Delete API key from backend
  const deleteApiKey = async () => {
    try {
      const response = await apiCall(API_CONFIG.ENDPOINTS.VAPI_CREDENTIALS, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete API key');
      }

      setApiKey('');
      setIsValid(null);
      setHasExistingKey(false);
      setAssistants([]);
      setAccountInfo(null);
      setSuccess('VAPI credentials removed successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to delete API key');
    }
  };

  // Load assistants from backend
  const loadAssistants = async () => {
    setLoading(true);
    try {
      const response = await apiCall(API_CONFIG.ENDPOINTS.VAPI_ASSISTANTS);
      
      if (response.ok) {
        const assistantList = await response.json();
        setAssistants(assistantList);
      }
    } catch (err) {
      console.error('Error loading assistants:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load account info from backend
  const loadAccountInfo = async () => {
    try {
      const response = await apiCall(API_CONFIG.ENDPOINTS.VAPI_ACCOUNT);
      
      if (response.ok) {
        const account = await response.json();
        setAccountInfo(account);
      }
    } catch (err) {
      console.error('Error loading account info:', err);
    }
  };

  // Validate and save API key
  const handleSaveApiKey = async () => {
    if (!apiKey || apiKey.includes('••••')) {
      setError('Please enter a valid API key');
      return;
    }

    setIsValidating(true);
    setError('');
    setSuccess('');
    
    try {
      await saveApiKey(apiKey);
      setIsValid(true);
      setHasExistingKey(true);
      setSuccess('VAPI API key saved successfully!');
      
      // Load assistants and account info
      await loadAssistants();
      await loadAccountInfo();
      
      // Mask the displayed key
      setApiKey('••••••••••••••••');
    } catch (err: any) {
      setError(err.message);
      setIsValid(false);
    } finally {
      setIsValidating(false);
    }
  };

  // Load existing key on component mount
  useEffect(() => {
    loadExistingApiKey();
  }, [loadExistingApiKey]);

  // Clear messages after a few seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="vapi-settings">
      <div className="vapi-settings-header">
        <button onClick={onBack} className="back-button">
          ← Back
        </button>
        <h2>VAPI Integration Settings</h2>
      </div>

      <div className="vapi-settings-content">
        {/* VAPI Key Section */}
        <div className="vapi-key-section">
          <h3>🔑 VAPI API Key</h3>
          <p className="vapi-key-description">
            Connect your VAPI account to enable real AI voice assistants and phone calls.
            {' '}
            <a 
              href="https://dashboard.vapi.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="vapi-link"
            >
              Get your API key from VAPI Dashboard →
            </a>
          </p>

          <div className="vapi-key-input-group">
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your VAPI API key..."
              className={`vapi-key-input ${isValid === true ? 'valid' : isValid === false ? 'invalid' : ''}`}
              disabled={isValidating}
            />
            <div className="vapi-key-buttons">
              <button
                onClick={handleSaveApiKey}
                disabled={isValidating || !apiKey || apiKey.includes('••••')}
                className="save-key-button"
              >
                {isValidating ? 'Validating...' : hasExistingKey ? 'Update Key' : 'Save Key'}
              </button>
              {hasExistingKey && (
                <button
                  onClick={deleteApiKey}
                  className="delete-key-button"
                >
                  Remove Key
                </button>
              )}
            </div>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="vapi-message error">
              ❌ {error}
            </div>
          )}
          
          {success && (
            <div className="vapi-message success">
              ✅ {success}
            </div>
          )}

          {/* Connection Status */}
          <div className="vapi-status">
            <div className={`status-indicator ${isValid ? 'connected' : 'disconnected'}`}>
              <div className="status-dot"></div>
              <span className="status-text">
                {isValid ? 'Connected to VAPI' : 'Not Connected'}
              </span>
            </div>
            {!isValid && (
              <div className="demo-mode-notice">
                <p>🧪 <strong>Demo Mode Active</strong> - You can explore the interface, but no real calls will be made.</p>
              </div>
            )}
          </div>
        </div>

        {/* Account Info Section */}
        {isValid && accountInfo && (
          <div className="vapi-account-section">
            <h3>📊 Account Information</h3>
            <div className="account-info-grid">
              <div className="account-info-item">
                <label>Account ID:</label>
                <span>{accountInfo.id || 'N/A'}</span>
              </div>
              <div className="account-info-item">
                <label>Account Name:</label>
                <span>{accountInfo.name || 'N/A'}</span>
              </div>
              <div className="account-info-item">
                <label>Credits:</label>
                <span>{accountInfo.credits || 0}</span>
              </div>
              <div className="account-info-item">
                <label>Subscription:</label>
                <span>{accountInfo.subscription || 'Free'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Assistants Section */}
        {isValid && (
          <div className="vapi-assistants-section">
            <h3>🤖 Your AI Assistants</h3>
            {loading ? (
              <div className="loading-state">Loading assistants...</div>
            ) : assistants.length > 0 ? (
              <div className="assistants-grid">
                {assistants.map((assistant) => (
                  <div key={assistant.id} className="assistant-card">
                    <h4>{assistant.name}</h4>
                    <p className="assistant-message">"{assistant.firstMessage}"</p>
                    <div className="assistant-meta">
                      <span className="model-tag">{assistant.model?.model || 'GPT-3.5'}</span>
                      <span className="voice-tag">{assistant.voice?.voiceId || 'Default'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-assistants">
                <p>No assistants found. Create your first assistant in the Voice Agent Editor!</p>
                <button 
                  onClick={() => window.history.pushState({}, '', '/editor')}
                  className="create-assistant-button"
                >
                  Create Assistant
                </button>
              </div>
            )}
          </div>
        )}

        {/* Help Section */}
        <div className="vapi-help-section">
          <h3>❓ Need Help?</h3>
          <div className="help-content">
            <div className="help-item">
              <strong>Where do I get a VAPI API key?</strong>
              <p>Sign up at <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer">dashboard.vapi.ai</a> and find your API key in the dashboard.</p>
            </div>
            <div className="help-item">
              <strong>Is my API key secure?</strong>
              <p>Yes! Your API key is encrypted and stored securely in our database. It's never exposed in the frontend.</p>
            </div>
            <div className="help-item">
              <strong>What can I do without a VAPI key?</strong>
              <p>You can explore the interface and create assistant templates, but no real phone calls will be made.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VapiSettings;