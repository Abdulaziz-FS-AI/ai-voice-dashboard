import React, { useState } from 'react';
import { signIn, signUp, confirmSignUp, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import './CustomAuth.css';

interface CustomAuthProps {
  onSuccess: () => void;
  onBack: () => void;
}

type AuthState = 'signin' | 'signup' | 'confirm' | 'forgot' | 'reset';

const CustomAuth: React.FC<CustomAuthProps> = ({ onSuccess, onBack }) => {
  const [authState, setAuthState] = useState<AuthState>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  // Form data
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await signIn({ username: email, password });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    
    try {
      await signIn({ provider: 'Google' });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Google sign in failed');
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 7) {
      setError('Password must be at least 7 characters long');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email
          }
        }
      });
      setMessage('Please check your email for verification code');
      setAuthState('confirm');
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
    }
    setLoading(false);
  };

  const handleConfirmSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await confirmSignUp({
        username: email,
        confirmationCode
      });
      setMessage('Account confirmed! Please sign in.');
      setAuthState('signin');
    } catch (err: any) {
      setError(err.message || 'Confirmation failed');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await resetPassword({ username: email });
      setMessage('Password reset code sent to your email');
      setAuthState('reset');
    } catch (err: any) {
      setError(err.message || 'Reset failed');
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 7) {
      setError('Password must be at least 7 characters long');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode,
        newPassword: password
      });
      setMessage('Password reset successful! Please sign in.');
      setAuthState('signin');
    } catch (err: any) {
      setError(err.message || 'Password reset failed');
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
      
      <div className="auth-divider">
        <span>or</span>
      </div>
      
      <button 
        type="button" 
        className="auth-button google" 
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        <span className="google-icon">🇬</span>
        {loading ? <span className="spinner"></span> : 'Continue with Google'}
      </button>
      
      <div className="auth-links">
        <button type="button" className="link-button" onClick={() => setAuthState('forgot')}>
          Forgot your password?
        </button>
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
          <label htmlFor="signup-password">Password (minimum 7 characters)</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password (minimum 7 characters)"
            minLength={7}
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

  const renderConfirm = () => (
    <div className="auth-form-container">
      <div className="auth-header">
        <h2 className="auth-title">Verify Your Email</h2>
        <p className="auth-subtitle">Enter the verification code sent to {email}</p>
      </div>
      
      <form onSubmit={handleConfirmSignUp} className="auth-form">
        <div className="form-field">
          <label htmlFor="confirmation-code">Verification Code</label>
          <input
            id="confirmation-code"
            type="text"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            placeholder="Enter 6-digit code"
            required
          />
        </div>
        
        <button type="submit" className="auth-button primary" disabled={loading}>
          {loading ? <span className="spinner"></span> : 'Verify Email'}
          <span className="button-arrow">→</span>
        </button>
      </form>
      
      <div className="auth-links">
        <button type="button" className="link-button" onClick={() => setAuthState('signup')}>
          ← Back to Sign Up
        </button>
      </div>
    </div>
  );

  const renderForgot = () => (
    <div className="auth-form-container">
      <div className="auth-header">
        <h2 className="auth-title">Reset Password</h2>
        <p className="auth-subtitle">Enter your email to receive a reset code</p>
      </div>
      
      <form onSubmit={handleForgotPassword} className="auth-form">
        <div className="form-field">
          <label htmlFor="reset-email">Email Address</label>
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
        </div>
        
        <button type="submit" className="auth-button primary" disabled={loading}>
          {loading ? <span className="spinner"></span> : 'Send Reset Code'}
          <span className="button-arrow">→</span>
        </button>
      </form>
      
      <div className="auth-links">
        <button type="button" className="link-button" onClick={() => setAuthState('signin')}>
          ← Back to Sign In
        </button>
      </div>
    </div>
  );

  const renderReset = () => (
    <div className="auth-form-container">
      <div className="auth-header">
        <h2 className="auth-title">Set New Password</h2>
        <p className="auth-subtitle">Enter the code and your new password</p>
      </div>
      
      <form onSubmit={handleResetPassword} className="auth-form">
        <div className="form-field">
          <label htmlFor="reset-code">Reset Code</label>
          <input
            id="reset-code"
            type="text"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            placeholder="Enter reset code"
            required
          />
        </div>
        
        <div className="form-field">
          <label htmlFor="new-password">New Password (minimum 7 characters)</label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password (minimum 7 characters)"
            minLength={7}
            required
          />
        </div>
        
        <div className="form-field">
          <label htmlFor="confirm-new-password">Confirm New Password</label>
          <input
            id="confirm-new-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
          />
        </div>
        
        <button type="submit" className="auth-button primary" disabled={loading}>
          {loading ? <span className="spinner"></span> : 'Reset Password'}
          <span className="button-arrow">→</span>
        </button>
      </form>
      
      <div className="auth-links">
        <button type="button" className="link-button" onClick={() => setAuthState('signin')}>
          ← Back to Sign In
        </button>
      </div>
    </div>
  );

  const renderCurrentForm = () => {
    switch (authState) {
      case 'signin': return renderSignIn();
      case 'signup': return renderSignUp();
      case 'confirm': return renderConfirm();
      case 'forgot': return renderForgot();
      case 'reset': return renderReset();
      default: return renderSignIn();
    }
  };

  return (
    <div className="custom-auth-container">
      <div className="auth-background">
        <div className="auth-particles"></div>
      </div>
      
      <div className="auth-card">
        <button className="back-to-landing" onClick={onBack}>
          ← Back to Landing
        </button>
        
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
    </div>
  );
};

export default CustomAuth;