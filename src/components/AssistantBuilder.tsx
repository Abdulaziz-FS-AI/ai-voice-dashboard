import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AssistantBuilder.css';

interface AssistantBuilderProps {
  user: any;
  token: string;
  onLogout: () => void;
}

interface PromptSegment {
  id: string;
  type: 'original' | 'dynamic';
  label: string;
  content: string;
  editable: boolean;
  placeholder?: string;
  required?: boolean;
  validation?: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  segments: PromptSegment[];
  voiceDefaults: {
    provider: string;
    voiceId: string;
    speed: number;
    stability: number;
  };
}

interface AssistantConfig {
  name: string;
  templateId: string;
  dynamicSegments: Record<string, string>;
  voiceSettings: {
    provider: string;
    voiceId: string;
    speed: number;
    stability: number;
  };
}

const AssistantBuilder: React.FC<AssistantBuilderProps> = ({ user, token, onLogout }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [assistantConfig, setAssistantConfig] = useState<AssistantConfig>({
    name: '',
    templateId: '',
    dynamicSegments: {},
    voiceSettings: {
      provider: 'elevenlabs',
      voiceId: 'ErXwobaYiN019PkySvjV',
      speed: 1.0,
      stability: 0.7
    }
  });
  const [assembledPrompt, setAssembledPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [deploymentStatus, setDeploymentStatus] = useState<'idle' | 'creating' | 'deploying' | 'success' | 'error'>('idle');
  const [createdAssistant, setCreatedAssistant] = useState<any>(null);

  const navigate = useNavigate();
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-api-gateway-url.com';

  // Load templates on component mount
  useEffect(() => {
    setError(''); // Clear any previous errors
    fetchTemplates();
  }, [token]);

  // Update assembled prompt when template or segments change
  useEffect(() => {
    if (selectedTemplate && assistantConfig.dynamicSegments) {
      const assembled = assemblePrompt(selectedTemplate, assistantConfig.dynamicSegments);
      setAssembledPrompt(assembled);
    }
  }, [selectedTemplate, assistantConfig.dynamicSegments]);

  const fetchTemplates = async () => {
    try {
      console.log('Fetching templates from:', `${API_BASE_URL}/assistants/templates`);
      console.log('Using token:', token ? 'Token present' : 'No token');
      
      const response = await fetch(`${API_BASE_URL}/assistants/templates`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Templates response:', data);
        
        // Handle both response formats
        const templatesArray = data.templates || data;
        if (Array.isArray(templatesArray) && templatesArray.length > 0) {
          setTemplates(templatesArray);
          setError(''); // Clear any previous errors
        } else {
          setError('No templates available');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to load templates:', response.status, errorData);
        setError(`Failed to load templates: ${response.status}`);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Network error loading templates');
    }
  };

  const assemblePrompt = (template: PromptTemplate, dynamicSegments: Record<string, string>): string => {
    return template.segments.map(segment => {
      if (segment.type === 'original') {
        return segment.content;
      } else {
        const value = dynamicSegments[segment.id];
        return value || `[${segment.label}]`;
      }
    }).filter(content => content.trim().length > 0).join('\n\n');
  };

  const handleTemplateSelect = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setAssistantConfig(prev => ({
      ...prev,
      templateId: template.id,
      voiceSettings: template.voiceDefaults,
      dynamicSegments: {}
    }));
    setCurrentStep(2);
  };

  const handleDynamicSegmentChange = (segmentId: string, value: string) => {
    setAssistantConfig(prev => ({
      ...prev,
      dynamicSegments: {
        ...prev.dynamicSegments,
        [segmentId]: value
      }
    }));
  };

  const handleVoiceSettingChange = (setting: string, value: any) => {
    setAssistantConfig(prev => ({
      ...prev,
      voiceSettings: {
        ...prev.voiceSettings,
        [setting]: value
      }
    }));
  };

  const validateForm = (): boolean => {
    if (!assistantConfig.name.trim()) {
      setError('Assistant name is required');
      return false;
    }

    if (!selectedTemplate) {
      setError('Please select a template');
      return false;
    }

    // Check required dynamic segments
    const requiredSegments = selectedTemplate.segments.filter(s => s.type === 'dynamic' && s.required);
    for (const segment of requiredSegments) {
      if (!assistantConfig.dynamicSegments[segment.id]?.trim()) {
        setError(`${segment.label} is required`);
        return false;
      }
    }

    setError('');
    return true;
  };

  const handleCreateAssistant = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setDeploymentStatus('creating');
    setError(''); // Clear any previous errors

    try {
      console.log('Creating assistant with config:', assistantConfig);
      
      const response = await fetch(`${API_BASE_URL}/assistants/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assistantConfig)
      });

      console.log('Create assistant response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Assistant created successfully:', data);
        setCreatedAssistant(data.assistant);
        setCurrentStep(5);
        setError(''); // Clear any errors on success
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to create assistant:', response.status, errorData);
        setError(errorData.error || errorData.details || `Failed to create assistant (${response.status})`);
        setDeploymentStatus('error');
      }
    } catch (err) {
      console.error('Error creating assistant:', err);
      setError('Network error creating assistant');
      setDeploymentStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeployToVapi = async () => {
    if (!createdAssistant) return;

    setIsLoading(true);
    setDeploymentStatus('deploying');

    try {
      const response = await fetch(`${API_BASE_URL}/assistants/deploy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assistantId: createdAssistant.id })
      });

      if (response.ok) {
        const data = await response.json();
        setCreatedAssistant(data.assistant);
        setDeploymentStatus('success');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to deploy assistant');
        setDeploymentStatus('error');
      }
    } catch (err) {
      console.error('Error deploying assistant:', err);
      setError('Network error deploying assistant');
      setDeploymentStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="step-indicator">
      <div className={`step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
        <div className="step-number">1</div>
        <div className="step-label">Choose Template</div>
      </div>
      <div className={`step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
        <div className="step-number">2</div>
        <div className="step-label">Configure Details</div>
      </div>
      <div className={`step ${currentStep >= 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}>
        <div className="step-number">3</div>
        <div className="step-label">Voice Settings</div>
      </div>
      <div className={`step ${currentStep >= 4 ? 'active' : ''} ${currentStep > 4 ? 'completed' : ''}`}>
        <div className="step-number">4</div>
        <div className="step-label">Review & Create</div>
      </div>
      <div className={`step ${currentStep >= 5 ? 'active' : ''}`}>
        <div className="step-number">5</div>
        <div className="step-label">Deploy</div>
      </div>
    </div>
  );

  const renderTemplateSelection = () => (
    <div className="template-selection">
      <h2>Choose Your Assistant Template</h2>
      <p>Select a pre-built template that matches your business needs. You'll customize it in the next step.</p>
      
      {error && (
        <div className="error-banner">
          <div className="error-message">{error}</div>
          <button 
            onClick={() => {
              setError('');
              fetchTemplates();
            }}
            className="retry-button"
          >
            Retry Loading Templates
          </button>
        </div>
      )}
      
      {templates.length === 0 && !error && (
        <div className="loading-message">
          Loading templates...
        </div>
      )}
      
      <div className="templates-grid">
        {templates.map(template => (
          <div
            key={template.id}
            className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
            onClick={() => handleTemplateSelect(template)}
          >
            <div className="template-header">
              <h3>{template.name}</h3>
              <span className="template-category">{template.category}</span>
            </div>
            <p className="template-description">{template.description}</p>
            <div className="template-features">
              <div className="feature-count">
                {template.segments.filter(s => s.type === 'dynamic').length} customizable fields
              </div>
              <div className="voice-provider">
                Voice: {template.voiceDefaults.provider}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderConfigurationForm = () => (
    <div className="configuration-form">
      <div className="form-section">
        <h2>Assistant Configuration</h2>
        <p>Fill in the details to personalize your {selectedTemplate?.name}</p>

        <div className="form-group">
          <label>Assistant Name *</label>
          <input
            type="text"
            value={assistantConfig.name}
            onChange={(e) => setAssistantConfig(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Customer Service Bot"
            className="form-input"
          />
        </div>

        {selectedTemplate?.segments
          .filter(segment => segment.type === 'dynamic')
          .map(segment => (
            <div key={segment.id} className="form-group">
              <label>
                {segment.label} {segment.required && '*'}
              </label>
              <input
                type="text"
                value={assistantConfig.dynamicSegments[segment.id] || ''}
                onChange={(e) => handleDynamicSegmentChange(segment.id, e.target.value)}
                placeholder={segment.placeholder}
                className="form-input"
                required={segment.required}
              />
            </div>
          ))}
      </div>

      <div className="preview-section">
        <h3>Live Preview</h3>
        <div className="prompt-preview">
          <pre>{assembledPrompt}</pre>
        </div>
      </div>
    </div>
  );

  const renderVoiceSettings = () => (
    <div className="voice-settings">
      <h2>Voice Configuration</h2>
      <p>Customize how your assistant sounds during conversations</p>

      <div className="voice-form">
        <div className="form-group">
          <label>Voice Provider</label>
          <select
            value={assistantConfig.voiceSettings.provider}
            onChange={(e) => handleVoiceSettingChange('provider', e.target.value)}
            className="form-select"
          >
            <option value="elevenlabs">ElevenLabs (Recommended)</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>

        <div className="form-group">
          <label>Speech Speed: {assistantConfig.voiceSettings.speed}</label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={assistantConfig.voiceSettings.speed}
            onChange={(e) => handleVoiceSettingChange('speed', parseFloat(e.target.value))}
            className="form-range"
          />
        </div>

        <div className="form-group">
          <label>Voice Stability: {assistantConfig.voiceSettings.stability}</label>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.1"
            value={assistantConfig.voiceSettings.stability}
            onChange={(e) => handleVoiceSettingChange('stability', parseFloat(e.target.value))}
            className="form-range"
          />
        </div>
      </div>
    </div>
  );

  const renderReviewAndCreate = () => (
    <div className="review-section">
      <h2>Review Your Assistant</h2>
      
      <div className="review-card">
        <div className="review-item">
          <strong>Name:</strong> {assistantConfig.name}
        </div>
        <div className="review-item">
          <strong>Template:</strong> {selectedTemplate?.name}
        </div>
        <div className="review-item">
          <strong>Voice:</strong> {assistantConfig.voiceSettings.provider} 
          (Speed: {assistantConfig.voiceSettings.speed}, Stability: {assistantConfig.voiceSettings.stability})
        </div>
      </div>

      <div className="final-prompt">
        <h3>Complete Prompt</h3>
        <div className="prompt-preview final">
          <pre>{assembledPrompt}</pre>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <button
        className="create-button"
        onClick={handleCreateAssistant}
        disabled={isLoading}
      >
        {isLoading ? 'Creating Assistant...' : 'Create Assistant'}
      </button>
    </div>
  );

  const renderDeployment = () => (
    <div className="deployment-section">
      <h2>Deploy Your Assistant</h2>
      
      {deploymentStatus === 'creating' && (
        <div className="deployment-status">
          <div className="spinner"></div>
          <p>Creating your assistant...</p>
        </div>
      )}

      {deploymentStatus === 'deploying' && (
        <div className="deployment-status">
          <div className="spinner"></div>
          <p>Deploying to VAPI...</p>
        </div>
      )}

      {deploymentStatus === 'success' && (
        <div className="deployment-success">
          <div className="success-icon">✅</div>
          <h3>Assistant Successfully Deployed!</h3>
          <div className="deployment-details">
            <p><strong>Assistant ID:</strong> {createdAssistant?.vapiAssistantId}</p>
            {createdAssistant?.phoneNumber && (
              <p><strong>Phone Number:</strong> {createdAssistant.phoneNumber}</p>
            )}
          </div>
          <div className="deployment-actions">
            <button onClick={() => navigate('/dashboard')} className="primary-button">
              Back to Dashboard
            </button>
            <button onClick={() => navigate('/analytics')} className="secondary-button">
              View Analytics
            </button>
          </div>
        </div>
      )}

      {createdAssistant && deploymentStatus !== 'success' && deploymentStatus !== 'deploying' && (
        <div className="deployment-ready">
          <h3>Assistant Created Successfully!</h3>
          <p>Your assistant is ready to be deployed to VAPI for live calling.</p>
          <button
            className="deploy-button"
            onClick={handleDeployToVapi}
            disabled={isLoading}
          >
            {isLoading ? 'Deploying...' : 'Deploy to VAPI'}
          </button>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );

  return (
    <div className="assistant-builder">
      {/* Header */}
      <header className="builder-header">
        <div className="header-content">
          <div className="header-logo">
            <div className="logo-icon">🎙️</div>
            <span className="logo-text">Voice Matrix</span>
          </div>
          <div className="header-actions">
            <button onClick={() => navigate('/dashboard')} className="back-button">
              ← Back to Dashboard
            </button>
            <button onClick={onLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Main Content */}
      <main className="builder-main">
        <div className="builder-container">
          {currentStep === 1 && renderTemplateSelection()}
          {currentStep === 2 && renderConfigurationForm()}
          {currentStep === 3 && renderVoiceSettings()}
          {currentStep === 4 && renderReviewAndCreate()}
          {currentStep === 5 && renderDeployment()}
        </div>

        {/* Navigation */}
        {currentStep > 1 && currentStep < 5 && (
          <div className="builder-navigation">
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="nav-button secondary"
            >
              Previous
            </button>
            {currentStep < 4 && (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="nav-button primary"
                disabled={currentStep === 2 && !assistantConfig.name.trim()}
              >
                Next
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AssistantBuilder;