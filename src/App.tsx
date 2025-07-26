import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import PinLogin from './components/PinLogin';
import Dashboard from './components/Dashboard';
import AssistantBuilder from './components/AssistantBuilder';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import './App.css';

interface User {
  userId: string;
  email: string;
  role: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    company?: string;
  };
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'none' | 'auth' | 'pin'>('none');
  const [shouldRedirectToDashboard, setShouldRedirectToDashboard] = useState(false);

  // Check for existing token on app load
  useEffect(() => {
    const savedToken = localStorage.getItem('voiceMatrixToken');
    if (savedToken) {
      verifyToken(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Handle redirect to dashboard after successful authentication
  useEffect(() => {
    if (shouldRedirectToDashboard && user && token) {
      setShouldRedirectToDashboard(false);
      // The component will re-render and show the dashboard route
    }
  }, [shouldRedirectToDashboard, user, token]);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-api-gateway-url.com';
      const response = await fetch(`${API_BASE_URL}/auth/verify-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setUser(data.user);
          setToken(tokenToVerify);
        } else {
          localStorage.removeItem('voiceMatrixToken');
        }
      } else {
        localStorage.removeItem('voiceMatrixToken');
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('voiceMatrixToken');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetStarted = () => {
    setAuthMode('auth');
  };

  const handleTestLogin = () => {
    setAuthMode('pin');
  };

  const handleAuthSuccess = (userData: User, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    setAuthMode('none');
    setShouldRedirectToDashboard(true);
  };

  const handlePinSuccess = (userData: User, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    setAuthMode('none');
    setShouldRedirectToDashboard(true);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('voiceMatrixToken');
    setAuthMode('none');
  };

  const handleBackToLanding = () => {
    setAuthMode('none');
  };

  // Loading screen
  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading Voice Matrix...</p>
      </div>
    );
  }

  // Show auth modals over routes
  if (authMode === 'auth') {
    return <Auth onAuthSuccess={handleAuthSuccess} onBack={handleBackToLanding} />;
  }
  
  if (authMode === 'pin') {
    return <PinLogin onPinSuccess={handlePinSuccess} onBack={handleBackToLanding} />;
  }

  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          {/* Public routes */}
          <Route 
            path="/" 
            element={
              user && token ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LandingPage onGetStarted={handleGetStarted} onTestLogin={handleTestLogin} />
              )
            } 
          />
          
          {/* Protected routes - require authentication */}
          <Route
            path="/dashboard"
            element={
              user && token ? (
                <Dashboard user={user} token={token} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          
          <Route
            path="/create-assistant"
            element={
              user && token ? (
                <AssistantBuilder user={user} token={token} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          
          <Route
            path="/analytics"
            element={
              user && token ? (
                <AnalyticsDashboard user={user} token={token} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
