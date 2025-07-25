import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

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
      const response = await fetch('/api/vapi/phone-numbers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
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

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          width: 90%;
          max-width: 500px;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 24px 0 24px;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 24px;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }

        .modal-close:hover {
          background-color: #f3f4f6;
        }

        .modal-body {
          padding: 0 24px 24px 24px;
        }

        .modal-footer {
          padding: 24px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: flex-end;
        }

        .form-field label {
          font-weight: 500;
        }

        .btn-secondary {
          padding: 10px 20px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 6px;
          cursor: pointer;
        }

        .btn-secondary:hover {
          background-color: #f9fafb;
        }

        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .mb-2 { margin-bottom: 0.5rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mr-2 { margin-right: 0.5rem; }
        .mr-3 { margin-right: 0.75rem; }
        .w-full { width: 100%; }
        .p-3 { padding: 0.75rem; }
        .block { display: block; }
        .flex { display: flex; }
        .items-center { align-items: center; }
        .text-center { text-align: center; }
        .text-lg { font-size: 1.125rem; }
        .text-6xl { font-size: 4rem; }
        .text-sm { font-size: 0.875rem; }
        .text-red-500 { color: #ef4444; }
        .border-red-500 { border-color: #ef4444; }
        .border-gray-300 { border-color: #d1d5db; }
      `}</style>
    </div>
  );
};

export default PhoneSetupModal;