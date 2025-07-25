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

  const assistants: AssistantType[] = [
    {
      id: 'sales-pro',
      name: 'Sales Professional',
      description: 'Expert at qualifying leads and closing deals',
      icon: '💼',
      personality: 'Professional, persuasive, and results-driven',
      useCase: 'Lead qualification, product demos, sales follow-ups',
      features: [
        'Lead qualification automation',
        'Product knowledge base',
        'Objection handling',
        'Meeting scheduling',
        'CRM integration'
      ],
      sampleQuestions: [
        'What\'s your budget range for this project?',
        'When are you looking to make a decision?',
        'Who else is involved in the decision-making process?',
        'What challenges are you currently facing?'
      ]
    },
    {
      id: 'customer-support',
      name: 'Customer Support',
      description: 'Friendly and helpful customer service specialist',
      icon: '🎧',
      personality: 'Empathetic, patient, and solution-focused',
      useCase: 'Customer inquiries, troubleshooting, support tickets',
      features: [
        'Multi-language support',
        'Knowledge base integration',
        'Ticket creation',
        'Escalation handling',
        'Follow-up scheduling'
      ],
      sampleQuestions: [
        'How can I help you today?',
        'Can you describe the issue you\'re experiencing?',
        'Have you tried any troubleshooting steps?',
        'What\'s your account information?'
      ]
    },
    {
      id: 'appointment-scheduler',
      name: 'Appointment Scheduler',
      description: 'Efficient booking and calendar management',
      icon: '📅',
      personality: 'Organized, efficient, and detail-oriented',
      useCase: 'Appointment booking, rescheduling, reminders',
      features: [
        'Calendar integration',
        'Automated reminders',
        'Booking confirmations',
        'Availability checking',
        'Rescheduling handling'
      ],
      sampleQuestions: [
        'What type of appointment would you like to schedule?',
        'What\'s your preferred date and time?',
        'Should I send you a confirmation email?',
        'Would you like to set up a reminder?'
      ]
    },
    {
      id: 'market-researcher',
      name: 'Market Researcher',
      description: 'Professional survey and research conductor',
      icon: '📊',
      personality: 'Analytical, thorough, and neutral',
      useCase: 'Surveys, market research, data collection',
      features: [
        'Survey automation',
        'Data collection',
        'Response analytics',
        'Follow-up questions',
        'Report generation'
      ],
      sampleQuestions: [
        'On a scale of 1-10, how satisfied are you?',
        'What factors influenced your decision?',
        'How did you hear about our product?',
        'What improvements would you suggest?'
      ]
    },
    {
      id: 'receptionist',
      name: 'Virtual Receptionist',
      description: 'Professional front desk and call routing',
      icon: '📞',
      personality: 'Professional, welcoming, and organized',
      useCase: 'Call routing, information providing, message taking',
      features: [
        'Call routing',
        'Message taking',
        'Directory assistance',
        'Business hours info',
        'Transfer handling'
      ],
      sampleQuestions: [
        'How may I direct your call?',
        'Who would you like to speak with?',
        'Can I take a message for them?',
        'What is this regarding?'
      ]
    }
  ];

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
        {assistants.map((assistant) => (
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
        ))}
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