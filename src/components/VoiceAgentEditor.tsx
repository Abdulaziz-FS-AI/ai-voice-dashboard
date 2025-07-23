import React, { useState } from 'react';
import './VoiceAgentEditor.css';

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
  const [config, setConfig] = useState<AgentConfig>({
    companyName: '',
    welcomeMessage: '',
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

  const handleSave = () => {
    onSave(config);
    alert('Voice agent configuration saved successfully!');
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

  return (
    <div className="voice-editor-container">
      <div className="editor-header">
        <h1>AI Voice Agent Configuration</h1>
        <div className="header-buttons">
          <button className="nav-button" onClick={() => onNavigate('dashboard')}>
            Dashboard
          </button>
          <button className="save-button" onClick={handleSave}>
            Save Configuration
          </button>
        </div>
      </div>

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