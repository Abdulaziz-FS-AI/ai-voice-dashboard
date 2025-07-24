import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import PinLogin from './components/PinLogin';
import Dashboard from './components/Dashboard';
import VoiceAgentEditor from './components/VoiceAgentEditor';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import '@aws-amplify/ui-react/styles.css';
import './App.css';

type Page = 'landing' | 'login' | 'dashboard' | 'editor';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [, setAgentConfig] = useState<any>(null);
  const [showTestLogin, setShowTestLogin] = useState(false);
  const { user, loading } = useAuth();

  const handleNavigate = (page: 'dashboard' | 'editor') => {
    setCurrentPage(page);
  };

  const handleGetStarted = () => {
    // This will be handled by Authenticator component
  };

  const handleTestLogin = () => {
    setShowTestLogin(true);
  };

  const handlePinLogin = () => {
    setShowTestLogin(false);
    setCurrentPage('dashboard');
  };

  const handleSaveConfig = (config: any) => {
    setAgentConfig(config);
    console.log('Agent configuration saved:', config);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Show PIN login if test mode is activated
  if (showTestLogin) {
    return <PinLogin onLogin={handlePinLogin} />;
  }

  // Show authenticated content if user is logged in
  if (user) {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'editor':
        return <VoiceAgentEditor onSave={handleSaveConfig} onNavigate={handleNavigate} />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  }

  // Show landing page with Cognito auth for unauthenticated users
  return <LandingPage onGetStarted={handleGetStarted} onTestLogin={handleTestLogin} />;
};

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <AppContent />
      </div>
    </AuthProvider>
  );
}

export default App;
