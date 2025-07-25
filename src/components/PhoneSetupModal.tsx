import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { apiCall, API_CONFIG } from '../config/api';
import './PhoneSetupModal.css';

interface PhoneSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhoneCreated: (phoneNumber: string, phoneId: string) => void;
  customerId: string;
}

interface CreatePhoneRequest {
  number: string;
  provider: 'twilio' | 'vapi' | 'vonage' | 'telnyx';
  credentialId?: string;
  assistantId?: string;
}

const PhoneSetupModal: React.FC<PhoneSetupModalProps> = ({
  isOpen,
  onClose,
  onPhoneCreated,
  customerId
}) => {
  const { isDark } = useTheme();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [provider, setProvider] = useState<'twilio' | 'vapi'>('twilio');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'input' | 'confirm' | 'success'>('input');

  const formatPhoneNumber = (value: string) => {
    const phone = value.replace(/\D/g, '');
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

  const createVapiPhoneNumber = async (phoneData: CreatePhoneRequest) => {
    try {
      // Call your backend API which will call VAPI with your master account
      const response = await apiCall(API_CONFIG.ENDPOINTS.VAPI_PHONE_NUMBERS, {
        method: 'POST',
        body: JSON.stringify({
          ...phoneData,
          customerId: customerId,
          number: phoneData.number.replace(/\D/g, '') // Send clean digits
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create phone number');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('VAPI phone creation error:', error);
      throw error;
    }
  };

  const handleCreatePhone = async () => {
    if (!validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const phoneData: CreatePhoneRequest = {
        number: `+1${phoneNumber.replace(/\D/g, '')}`,
        provider: provider,
        // credentialId will be handled by your backend
      };

      const result = await createVapiPhoneNumber(phoneData);
      
      setStep('success');
      
      // Wait a moment to show success, then callback
      setTimeout(() => {
        onPhoneCreated(phoneNumber, result.id);
        handleClose();
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to create phone number. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPhoneNumber('');
    setError('');
    setStep('input');
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div 
        className={`modal-content ${isDark ? 'theme-bg-secondary' : 'theme-bg-primary'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="theme-text-primary">
            {step === 'success' ? '🎉 Phone Number Created!' : '📱 Get Your Phone Number'}
          </h2>
          <button 
            className="modal-close theme-text-secondary"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {step === 'input' && (
            <>
              <p className="theme-text-secondary mb-4">
                Enter the phone number you'd like for your AI assistant. 
                We'll provision it in our system for you.
              </p>

              <div className="form-field mb-4">
                <label className="theme-text-primary mb-2 block">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                  maxLength={14}
                  className={`w-full p-3 border rounded-lg theme-bg-primary theme-text-primary ${
                    error ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {error && (
                  <span className="text-red-500 text-sm mt-1 block">{error}</span>
                )}
              </div>

              <div className="form-field mb-6">
                <label className="theme-text-primary mb-2 block">
                  Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as 'twilio' | 'vapi')}
                  className="w-full p-3 border border-gray-300 rounded-lg theme-bg-primary theme-text-primary"
                >
                  <option value="twilio">Twilio (Recommended)</option>
                  <option value="vapi">VAPI Native</option>
                </select>
              </div>

              <div className="phone-info mb-6">
                <div className="info-item flex items-center mb-2">
                  <span className="mr-2">🔒</span>
                  <span className="theme-text-secondary">Secure and encrypted</span>
                </div>
                <div className="info-item flex items-center mb-2">
                  <span className="mr-2">⚡</span>
                  <span className="theme-text-secondary">Instant provisioning</span>
                </div>
                <div className="info-item flex items-center">
                  <span className="mr-2">📞</span>
                  <span className="theme-text-secondary">Ready for customer calls</span>
                </div>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="text-center">
              <div className="success-icon text-6xl mb-4">📱</div>
              <p className="theme-text-primary text-lg mb-2">
                Your phone number <strong>{phoneNumber}</strong> is ready!
              </p>
              <p className="theme-text-secondary">
                Redirecting you back to the dashboard...
              </p>
            </div>
          )}
        </div>

        {step === 'input' && (
          <div className="modal-footer">
            <button
              onClick={handleClose}
              className="btn-secondary mr-3"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePhone}
              disabled={loading || !validatePhoneNumber(phoneNumber)}
              className="theme-button"
            >
              {loading ? (
                <>
                  <span className="spinner mr-2"></span>
                  Creating...
                </>
              ) : (
                'Create Phone Number'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhoneSetupModal;