import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import PinLogin from './components/PinLogin';
import PhoneSetup from './components/PhoneSetup';
import AssistantSelection from './components/AssistantSelection';
import Dashboard from './components/Dashboard';
import VoiceAgentEditor from './components/VoiceAgentEditor';
import DiagnosticPage from './components/DiagnosticPage';
import AdminDashboard from './components/AdminDashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import '@aws-amplify/ui-react/styles.css';
import './App.css';

type Page = 'landing' | 'login' | 'phone-setup' | 'assistant-selection' | 'dashboard' | 'editor' | 'diagnostic' | 'admin';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [, setAgentConfig] = useState<any>(null);
  const [showTestLogin, setShowTestLogin] = useState(false);
  const [testMode, setTestMode] = useState(false);
  
  // Assistant setup state (not automatic onboarding)
  const [userPhone, setUserPhone] = useState<string>('');
  const [, setSelectedAssistant] = useState<any>(null);
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);
  
  const { user, userName, loading } = useAuth();

  // Check if user is admin
  const isAdmin = userName === 'admin' || user?.username === 'admin';

  // Secret diagnostic access
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        console.log('🔍 Opening diagnostic page...');
        setCurrentPage('diagnostic');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleNavigate = (page: 'dashboard' | 'editor' | 'diagnostic' | 'admin' | 'phone-setup' | 'assistant-selection') => {
    setCurrentPage(page);
  };

  const handleGetStarted = () => {
    // This will be handled by Authenticator component
  };

  // Start assistant setup flow from dashboard
  const handleStartAssistantSetup = () => {
    setCurrentPage('phone-setup');
  };

  const handleTestLogin = () => {
    setShowTestLogin(true);
  };

  const handlePinLogin = () => {
    setShowTestLogin(false);
    setTestMode(true);
    setCurrentPage('dashboard');
  };

  const handleSaveConfig = (config: any) => {
    setAgentConfig(config);
    console.log('Agent configuration saved:', config);
  };

  // Onboarding handlers
  const handlePhoneSetup = (phone: string) => {
    setUserPhone(phone);
    setCurrentPage('assistant-selection');
  };

  const handleAssistantSelection = (assistant: any) => {
    setSelectedAssistant(assistant);
    setHasCompletedSetup(true);
    setCurrentPage('dashboard');
  };

  const handleBackToPhoneSetup = () => {
    setCurrentPage('phone-setup');
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
  };

  // After authentication, navigate to dashboard
  React.useEffect(() => {
    if (user && currentPage === 'landing') {
      setCurrentPage('dashboard');
    }
  }, [user, currentPage]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Show PIN login if test mode is activated
  if (showTestLogin) {
    return <PinLogin onLogin={handlePinLogin} onBack={() => setShowTestLogin(false)} />;
  }

  // Show authenticated content if user is logged in OR in test mode
  if (user || testMode) {
    switch (currentPage) {
      case 'phone-setup':
        return <PhoneSetup onNext={handlePhoneSetup} onBack={handleBackToDashboard} testMode={testMode} />;
      case 'assistant-selection':
        return (
          <AssistantSelection 
            onNext={handleAssistantSelection} 
            onBack={handleBackToPhoneSetup}
            userPhone={userPhone}
            testMode={testMode} 
          />
        );
      case 'dashboard':
        return (
          <Dashboard 
            onNavigate={handleNavigate} 
            onStartAssistantSetup={handleStartAssistantSetup}
            hasCompletedSetup={hasCompletedSetup}
            userPhone={userPhone}
            isAdmin={isAdmin}
            testMode={testMode} 
          />
        );
      case 'editor':
        return <VoiceAgentEditor onSave={handleSaveConfig} onNavigate={handleNavigate} testMode={testMode} />;
      case 'admin':
        if (!isAdmin) {
          setCurrentPage('dashboard');
          return null;
        }
        return <AdminDashboard onNavigate={handleNavigate} />;
      case 'diagnostic':
        return <DiagnosticPage />;
      case 'landing':
        // If authenticated user somehow gets to landing, redirect to dashboard
        setCurrentPage('dashboard');
        return null;
      default:
        return <Dashboard onNavigate={handleNavigate} onStartAssistantSetup={handleStartAssistantSetup} hasCompletedSetup={hasCompletedSetup} userPhone={userPhone} isAdmin={isAdmin} testMode={testMode} />;
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
