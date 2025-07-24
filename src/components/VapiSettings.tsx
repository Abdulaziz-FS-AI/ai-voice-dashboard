import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchAuthSession } from 'aws-amplify/auth';
import './VapiSettings.css';

interface VapiCredentials {
  hasVapiKey: boolean;
  vapiOrgId?: string;
  phoneNumbers?: string[];
  vapiConfiguredAt?: string;
}

const VapiSettings: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [orgId, setOrgId] = useState('');
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<VapiCredentials | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    if (!user) return;
    
    setLoading(true);
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
        setCredentials(data);
        setOrgId(data.vapiOrgId || '');
        setPhoneNumbers(data.phoneNumbers?.length > 0 ? data.phoneNumbers : ['']);
      }
    } catch (error) {
      console.error('Error fetching VAPI credentials:', error);
      setMessage({ type: 'error', text: 'Failed to load VAPI credentials' });
    } finally {
      setLoading(false);
    }
  };

  const saveCredentials = async () => {
    if (!user || !apiKey.trim()) {
      setMessage({ type: 'error', text: 'API key is required' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/user/vapi-credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          orgId: orgId.trim() || null,
          phoneNumbers: phoneNumbers.filter(p => p.trim()).map(p => p.trim())
        })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'VAPI credentials saved successfully!' });
        setApiKey(''); // Clear the API key input for security
        await fetchCredentials(); // Refresh the credentials info
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save credentials' });
      }
    } catch (error) {
      console.error('Error saving VAPI credentials:', error);
      setMessage({ type: 'error', text: 'Failed to save VAPI credentials' });
    } finally {
      setSaving(false);
    }
  };

  const removeCredentials = async () => {
    if (!user || !window.confirm('Are you sure you want to remove your VAPI credentials?')) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const response = await fetch(`${process.env.REACT_APP_API_URL}/user/vapi-credentials`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'VAPI credentials removed successfully' });
        setCredentials(null);
        setApiKey('');
        setOrgId('');
        setPhoneNumbers(['']);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to remove credentials' });
      }
    } catch (error) {
      console.error('Error removing VAPI credentials:', error);
      setMessage({ type: 'error', text: 'Failed to remove VAPI credentials' });
    } finally {
      setSaving(false);
    }
  };

  const addPhoneNumber = () => {
    setPhoneNumbers([...phoneNumbers, '']);
  };

  const removePhoneNumber = (index: number) => {
    if (phoneNumbers.length > 1) {
      setPhoneNumbers(phoneNumbers.filter((_, i) => i !== index));
    }
  };

  const updatePhoneNumber = (index: number, value: string) => {
    const updated = [...phoneNumbers];
    updated[index] = value;
    setPhoneNumbers(updated);
  };

  if (loading) {
    return (
      <div className="vapi-settings">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading VAPI settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vapi-settings">
      <div className="settings-header">
        <h2>🎯 VAPI Integration</h2>
        <p>Connect your VAPI account to manage voice assistants and track real call data.</p>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {credentials?.hasVapiKey && (
        <div className="current-credentials">
          <div className="credential-item">
            <span className="status-indicator connected">✓ Connected</span>
            <div className="credential-info">
              <strong>VAPI Account Connected</strong>
              {credentials.vapiConfiguredAt && (
                <p>Configured on {new Date(credentials.vapiConfiguredAt).toLocaleDateString()}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="settings-form">
        <div className="form-group">
          <label htmlFor="apiKey">
            VAPI API Key <span className="required">*</span>
          </label>
          <input
            id="apiKey"
            type="password"
            placeholder="Enter your VAPI API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="form-input"
          />
          <small className="form-help">
            Get your API key from the <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer">VAPI Dashboard</a>
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="orgId">Organization ID (Optional)</label>
          <input
            id="orgId"
            type="text"
            placeholder="Enter your VAPI organization ID"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Phone Numbers (Optional)</label>
          <div className="phone-numbers">
            {phoneNumbers.map((phone, index) => (
              <div key={index} className="phone-input-group">
                <input
                  type="tel"
                  placeholder="+1234567890"
                  value={phone}
                  onChange={(e) => updatePhoneNumber(index, e.target.value)}
                  className="form-input"
                />
                {phoneNumbers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePhoneNumber(index)}
                    className="remove-phone-btn"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addPhoneNumber}
              className="add-phone-btn"
            >
              + Add Phone Number
            </button>
          </div>
          <small className="form-help">
            Phone numbers help map incoming calls to your account
          </small>
        </div>

        <div className="form-actions">
          <button
            onClick={saveCredentials}
            disabled={saving || !apiKey.trim()}
            className="save-btn"
          >
            {saving ? 'Saving...' : credentials?.hasVapiKey ? 'Update Credentials' : 'Save Credentials'}
          </button>

          {credentials?.hasVapiKey && (
            <button
              onClick={removeCredentials}
              disabled={saving}
              className="remove-btn"
            >
              Remove Credentials
            </button>
          )}
        </div>
      </div>

      <div className="settings-info">
        <h3>📋 What happens next?</h3>
        <ul>
          <li>Your API key is encrypted and stored securely</li>
          <li>Voice Matrix will sync your VAPI assistants</li>
          <li>Real call data will appear in your dashboard</li>
          <li>Configure webhook URL in VAPI dashboard for real-time updates</li>
        </ul>
      </div>
    </div>
  );
};

export default VapiSettings;