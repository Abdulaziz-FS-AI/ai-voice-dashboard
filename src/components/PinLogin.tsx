import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './PinLogin.css';

interface PinLoginProps {
  onLogin: () => void;
  onBack?: () => void;
}

const PinLogin: React.FC<PinLoginProps> = ({ onLogin, onBack }) => {
  const { adminLogin } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await adminLogin(pin);
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Invalid PIN. Please try again.');
      setPin('');
    }
    setLoading(false);
  };

  const handleKeyPress = (digit: string) => {
    if (pin.length < 6) {
      setPin(pin + digit);
      setError('');
    }
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  return (
    <div className="pin-login-container">
      <div className="pin-login-card">
        {onBack && (
          <button className="pin-back-button" onClick={onBack}>
            ← Back to Landing
          </button>
        )}
        <div className="logo-container">
          <img 
            src="/voice-matrix-logo.png" 
            alt="Voice Matrix - Artificial Intelligence" 
            className="logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        <h2>Voice Matrix</h2>
        <p className="tagline">Artificial Intelligence</p>
        <p>Enter your PIN to access the dashboard</p>
        
        <form onSubmit={handleSubmit}>
          <div className="pin-display">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`pin-digit ${i < pin.length ? 'filled' : ''}`}>
                {i < pin.length ? '•' : ''}
              </div>
            ))}
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <div className="keypad">
            {Array.from({ length: 9 }, (_, i) => (
              <button
                key={i + 1}
                type="button"
                className="keypad-button"
                onClick={() => handleKeyPress((i + 1).toString())}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              className="keypad-button clear"
              onClick={handleClear}
            >
              Clear
            </button>
            <button
              type="button"
              className="keypad-button"
              onClick={() => handleKeyPress('0')}
            >
              0
            </button>
            <button
              type="button"
              className="keypad-button backspace"
              onClick={handleBackspace}
            >
              ←
            </button>
          </div>
          
          <button
            type="submit"
            className="login-button"
            disabled={pin.length !== 6 || loading}
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PinLogin;