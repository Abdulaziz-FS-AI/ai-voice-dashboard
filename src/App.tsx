import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import PinLogin from './components/PinLogin';
import PhoneSetup from './components/PhoneSetup';
import AssistantSelection from './components/AssistantSelection';
import Dashboard from './components/Dashboard';
import VoiceAgentEditor from './components/VoiceAgentEditor';
import DiagnosticPage from './components/DiagnosticPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import '@aws-amplify/ui-react/styles.css';
import './App.css';

type Page = 'landing' | 'login' | 'phone-setup' | 'assistant-selection' | 'dashboard' | 'editor' | 'diagnostic';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [, setAgentConfig] = useState<any>(null);
  const [showTestLogin, setShowTestLogin] = useState(false);
  const [testMode, setTestMode] = useState(false);
  
  // Onboarding state
  const [userPhone, setUserPhone] = useState<string>('');
  const [, setSelectedAssistant] = useState<any>(null);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  
  const { user, loading } = useAuth();

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

  const handleNavigate = (page: 'dashboard' | 'editor' | 'diagnostic') => {
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
    setIsOnboardingComplete(true);
    setCurrentPage('dashboard');
  };

  const handleBackToPhoneSetup = () => {
    setCurrentPage('phone-setup');
  };

  // Check if user needs onboarding
  const needsOnboarding = (user || testMode) && !isOnboardingComplete && !userPhone;

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // Show PIN login if test mode is activated
  if (showTestLogin) {
    return <PinLogin onLogin={handlePinLogin} onBack={() => setShowTestLogin(false)} />;
  }

  // Show authenticated content if user is logged in OR in test mode
  if (user || testMode) {
    // Handle onboarding flow
    if (needsOnboarding) {
      return <PhoneSetup onNext={handlePhoneSetup} testMode={testMode} />;
    }

    switch (currentPage) {
      case 'phone-setup':
        return <PhoneSetup onNext={handlePhoneSetup} testMode={testMode} />;
      case 'assistant-selection':
        return (
          <AssistantSelection 
            onNext={handleAssistantSelection} 
            onBack={handleBackToPhoneSetup}
            testMode={testMode} 
          />
        );
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} testMode={testMode} />;
      case 'editor':
        return <VoiceAgentEditor onSave={handleSaveConfig} onNavigate={handleNavigate} testMode={testMode} />;
      case 'diagnostic':
        return <DiagnosticPage />;
      default:
        return <Dashboard onNavigate={handleNavigate} testMode={testMode} />;
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
