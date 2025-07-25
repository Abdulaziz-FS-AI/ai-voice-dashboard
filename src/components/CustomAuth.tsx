import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './CustomAuth.css';

interface CustomAuthProps {
  onSuccess: () => void;
  onBack: () => void;
}

type AuthState = 'signin' | 'signup';

const CustomAuth: React.FC<CustomAuthProps> = ({ onSuccess, onBack }) => {
  const { login, register } = useAuth();
  const [authState, setAuthState] = useState<AuthState>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  // Form data
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await login(email, password);
      setMessage('Successfully signed in!');
      onSuccess();
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Sign in failed');
    }
    setLoading(false);
  };


  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await register({
        email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim()
      });
      setMessage('Account created successfully! You are now signed in.');
      onSuccess();
    } catch (err: any) {
      console.error('Sign up error:', err);
      setError(err.message || 'Registration failed');
    }
    setLoading(false);
  };


  const renderSignIn = () => (
    <div className="auth-form-container">
      <div className="auth-header">
        <h2 className="auth-title">Welcome Back</h2>
        <p className="auth-subtitle">Sign in to your Voice Matrix account</p>
      </div>
      
      <form onSubmit={handleSignIn} className="auth-form">
        <div className="form-field">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
        </div>
        
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </div>
        
        <button type="submit" className="auth-button primary" disabled={loading}>
          {loading ? <span className="spinner"></span> : 'Sign In'}
          <span className="button-arrow">→</span>
        </button>
      </form>
      
      
      <div className="auth-links">
        <div className="auth-separator">
          <span>Don't have an account?</span>
          <button type="button" className="link-button primary" onClick={() => setAuthState('signup')}>
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );

  const renderSignUp = () => (
    <div className="auth-form-container">
      <div className="auth-header">
        <h2 className="auth-title">Create Account</h2>
        <p className="auth-subtitle">Join Voice Matrix today</p>
      </div>
      
      <form onSubmit={handleSignUp} className="auth-form">
        <div className="form-field">
          <label htmlFor="signup-firstname">First Name</label>
          <input
            id="signup-firstname"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Enter your first name"
            required
          />
        </div>
        
        <div className="form-field">
          <label htmlFor="signup-lastname">Last Name</label>
          <input
            id="signup-lastname"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Enter your last name"
          />
        </div>
        
        <div className="form-field">
          <label htmlFor="signup-email">Email Address</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
        </div>
        
        <div className="form-field">
          <label htmlFor="signup-password">Password (minimum 8 characters)</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password (minimum 8 characters)"
            minLength={8}
            required
          />
        </div>
        
        <div className="form-field">
          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            required
          />
        </div>
        
        <button type="submit" className="auth-button primary" disabled={loading}>
          {loading ? <span className="spinner"></span> : 'Create Account'}
          <span className="button-arrow">→</span>
        </button>
      </form>
      
      
      <div className="auth-links">
        <div className="auth-separator">
          <span>Already have an account?</span>
          <button type="button" className="link-button primary" onClick={() => setAuthState('signin')}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  );

  const renderCurrentForm = () => {
    switch (authState) {
      case 'signin': return renderSignIn();
      case 'signup': return renderSignUp();
      default: return renderSignIn();
    }
  };

  return (
    <div className="custom-auth-container">
      <div className="auth-background">
        <div className="auth-particles"></div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="auth-card">
          <div className="auth-logo">
            <div className="logo-icon">🎙️</div>
            <span className="logo-text">Voice Matrix</span>
          </div>
        
        {error && (
          <div className="auth-message error">
            <span className="message-icon">⚠️</span>
            {error}
          </div>
        )}
        
        {message && (
          <div className="auth-message success">
            <span className="message-icon">✅</span>
            {message}
          </div>
        )}
        
          {renderCurrentForm()}
        </div>
        
        <button 
          className="back-to-landing" 
          onClick={() => {
            console.log('🔙 Back button clicked');
            onBack();
          }}
        >
          <span>←</span>
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default CustomAuth;