import React, { useState } from 'react';
import './PinLogin.css';

interface PinLoginProps {
  onPinSuccess: (user: any, token: string) => void;
  onBack: () => void;
}

const PinLogin: React.FC<PinLoginProps> = ({ onPinSuccess, onBack }) => {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-api-gateway-url.com';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('voiceMatrixToken', data.token);
        onPinSuccess(data.user, data.token);
      } else {
        setError(data.error || 'Invalid PIN');
      }
    } catch (err) {
      console.error('PIN login error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6); // Only digits, max 6
    setPin(value);
  };

  return (
    <div className="pin-container">
      <button className="back-button" onClick={onBack}>
        ← Back to Landing
      </button>
      <div className="pin-card">
        <div className="pin-header">
          <div className="pin-logo">
            <div className="logo-icon">🎯</div>
            <span className="logo-text">Demo Access</span>
          </div>
        </div>

        <div className="pin-content">
          <div className="pin-info">
            <h2>Try Voice Matrix Demo</h2>
            <p>Enter the demo PIN to explore the full dashboard experience</p>
            <div className="pin-hint">
              <span className="hint-label">Demo PIN:</span>
              <span className="hint-value">123456</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="pin-form">
            <div className="pin-input-group">
              <input
                type="text"
                value={pin}
                onChange={handlePinChange}
                placeholder="Enter 6-digit PIN"
                className="pin-input"
                maxLength={6}
                autoFocus
              />
              <div className="pin-display">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className={`pin-dot ${i < pin.length ? 'filled' : ''}`}
                  >
                    {i < pin.length ? '●' : '○'}
                  </div>
                ))}
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button 
              type="submit" 
              className="pin-submit"
              disabled={isLoading || pin.length !== 6}
            >
              {isLoading ? 'Verifying...' : 'Access Demo'}
            </button>
          </form>

          <div className="pin-footer">
            <div className="demo-features">
              <h3>What you'll see in the demo:</h3>
              <ul>
                <li>✅ Complete dashboard with analytics</li>
                <li>✅ Voice assistant management</li>
                <li>✅ Call logs and performance metrics</li>
                <li>✅ Admin management tools</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PinLogin;