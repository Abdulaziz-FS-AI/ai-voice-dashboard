import React, { useState } from 'react';
import './PinLogin.css';

interface PinLoginProps {
  onLogin: () => void;
}

const PinLogin: React.FC<PinLoginProps> = ({ onLogin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const CORRECT_PIN = '123456';

  const handlePinChange = (value: string) => {
    if (value.length <= 6) {
      setPin(value);
      setError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      onLogin();
    } else {
      setError('Invalid PIN. Please try again.');
      setPin('');
    }
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
        <h2>AI Voice Dashboard</h2>
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
            disabled={pin.length !== 6}
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default PinLogin;