import React, { useState } from 'react';
import './AssistantSelection.css';

interface AssistantType {
  id: string;
  name: string;
  description: string;
  icon: string;
  features: string[];
  useCase: string;
  personality: string;
  sampleQuestions: string[];
}

interface AssistantSelectionProps {
  onNext: (assistant: AssistantType) => void;
  onBack: () => void;
  userPhone?: string;
  testMode?: boolean;
}

const AssistantSelection: React.FC<AssistantSelectionProps> = ({ onNext, onBack, userPhone, testMode = false }) => {
  const [selectedAssistant, setSelectedAssistant] = useState<AssistantType | null>(null);

  // Users will create their own assistants in VAPI
  const assistants: AssistantType[] = [];

  const handleSelectAssistant = (assistant: AssistantType) => {
    setSelectedAssistant(assistant);
  };

  const handleContinue = () => {
    if (selectedAssistant) {
      onNext(selectedAssistant);
    }
  };

  return (
    <div className="assistant-selection-container">
      <div className="selection-header">
        <button className="back-button" onClick={onBack}>
          <span>←</span>
          Back
        </button>
        <div className="header-content">
          <h2 className="selection-title">Choose Your AI Assistant</h2>
          <p className="selection-subtitle">
            Select the assistant that best fits your business needs
          </p>
        </div>
      </div>

      <div className="assistants-grid">
        {assistants.length > 0 ? (
          assistants.map((assistant) => (
          <div
            key={assistant.id}
            className={`assistant-card ${selectedAssistant?.id === assistant.id ? 'selected' : ''}`}
            onClick={() => handleSelectAssistant(assistant)}
          >
            <div className="assistant-header">
              <div className="assistant-icon">{assistant.icon}</div>
              <div className="assistant-info">
                <h3 className="assistant-name">{assistant.name}</h3>
                <p className="assistant-description">{assistant.description}</p>
              </div>
              <div className="selection-indicator">
                {selectedAssistant?.id === assistant.id && <span className="checkmark">✓</span>}
              </div>
            </div>

            <div className="assistant-details">
              <div className="detail-section">
                <h4>Personality</h4>
                <p>{assistant.personality}</p>
              </div>

              <div className="detail-section">
                <h4>Best For</h4>
                <p>{assistant.useCase}</p>
              </div>

              <div className="detail-section">
                <h4>Key Features</h4>
                <ul className="features-list">
                  {assistant.features.slice(0, 3).map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                  {assistant.features.length > 3 && (
                    <li className="more-features">+{assistant.features.length - 3} more</li>
                  )}
                </ul>
              </div>

              <div className="detail-section sample-questions">
                <h4>Sample Questions</h4>
                <div className="questions-preview">
                  {assistant.sampleQuestions.slice(0, 2).map((question, index) => (
                    <div key={index} className="question-bubble">
                      "{question}"
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🤖</div>
            <h3>No AI Assistants Available</h3>
            <p>Please configure your assistants in VAPI Settings first</p>
            <button 
              className="setup-button"
              onClick={() => {
                // Navigate to VAPI settings
                window.history.back();
              }}
            >
              Go to VAPI Settings
            </button>
          </div>
        )}
      </div>

      <div className="selection-footer">
        <div className="selection-info">
          <p>
            <span className="info-icon">💡</span>
            You can customize your assistant's questions and behavior in the next step
          </p>
        </div>

        <button
          className="continue-button"
          onClick={handleContinue}
          disabled={!selectedAssistant}
        >
          Continue with {selectedAssistant?.name || 'Selected Assistant'}
          <span className="button-arrow">→</span>
        </button>
      </div>

      {testMode && (
        <div className="test-mode-banner">
          <span>🧪 Test Mode - Assistant selection for demonstration only</span>
        </div>
      )}
    </div>
  );
};

export default AssistantSelection;