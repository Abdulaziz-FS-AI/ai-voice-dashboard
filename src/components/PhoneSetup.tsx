import React, { useState } from 'react';
import './PhoneSetup.css';

interface PhoneSetupProps {
  onNext: (phoneNumber: string) => void;
  testMode?: boolean;
}

const PhoneSetup: React.FC<PhoneSetupProps> = ({ onNext, testMode = false }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const phone = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (phone.length <= 3) {
      return phone;
    } else if (phone.length <= 6) {
      return `(${phone.slice(0, 3)}) ${phone.slice(3)}`;
    } else {
      return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 10)}`;
    }
  };

  const validatePhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // TODO: Save phone number to user profile
      console.log('📱 Saving phone number:', phoneNumber);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onNext(phoneNumber);
    } catch (err: any) {
      setError('Failed to save phone number. Please try again.');
      console.error('Phone setup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="phone-setup-container">
      <div className="phone-setup-card">
        <div className="setup-header">
          <div className="setup-icon">📱</div>
          <h2 className="setup-title">Set Up Your Phone Number</h2>
          <p className="setup-subtitle">
            This number will be used for your AI voice assistant calls
          </p>
        </div>

        <form onSubmit={handleSubmit} className="phone-setup-form">
          <div className="form-field">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              maxLength={14}
              required
              className={error ? 'error' : ''}
            />
            {error && <span className="error-text">{error}</span>}
          </div>

          <div className="phone-info">
            <div className="info-item">
              <span className="info-icon">🔒</span>
              <span>Your number is encrypted and secure</span>
            </div>
            <div className="info-item">
              <span className="info-icon">📞</span>
              <span>Used only for your AI assistant calls</span>
            </div>
            <div className="info-item">
              <span className="info-icon">✅</span>
              <span>No spam or marketing calls</span>
            </div>
          </div>

          <button 
            type="submit" 
            className="setup-button"
            disabled={loading || !validatePhoneNumber(phoneNumber)}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Saving...
              </>
            ) : (
              <>
                Continue
                <span className="button-arrow">→</span>
              </>
            )}
          </button>
        </form>

        {testMode && (
          <div className="test-mode-banner">
            <span>🧪 Test Mode - No actual phone number will be saved</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhoneSetup;