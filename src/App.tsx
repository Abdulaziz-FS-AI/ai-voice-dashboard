import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import PinLogin from './components/PinLogin';
import Dashboard from './components/Dashboard';
import './App.css';

type AppView = 'landing' | 'auth' | 'pinLogin' | 'dashboard';

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
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on app load
  useEffect(() => {
    const savedToken = localStorage.getItem('voiceMatrixToken');
    if (savedToken) {
      verifyToken(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

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
          setCurrentView('dashboard');
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
    setCurrentView('auth');
  };

  const handleTestLogin = () => {
    setCurrentView('pinLogin');
  };

  const handleAuthSuccess = (userData: User, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    setCurrentView('dashboard');
  };

  const handlePinSuccess = (userData: User, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('voiceMatrixToken');
    setCurrentView('landing');
  };

  const handleBackToLanding = () => {
    setCurrentView('landing');
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

  // Render current view
  switch (currentView) {
    case 'auth':
      return <Auth onAuthSuccess={handleAuthSuccess} onBack={handleBackToLanding} />;
    
    case 'pinLogin':
      return <PinLogin onPinSuccess={handlePinSuccess} onBack={handleBackToLanding} />;
    
    case 'dashboard':
      return user && token ? (
        <Dashboard user={user} token={token} onLogout={handleLogout} />
      ) : (
        <div>Error: Missing user data</div>
      );
    
    default:
      return (
        <div className="App">
          <LandingPage onGetStarted={handleGetStarted} onTestLogin={handleTestLogin} />
        </div>
      );
  }
};

export default App;
