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
import { isAuthorizedAdmin, validateAdminAccessCode } from './utils/adminConfig';
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
  
  // Admin access state
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminAccessCode, setAdminAccessCode] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  
  const { user, userName, loading } = useAuth();

  // Check if user is authorized admin
  const isAuthorizedAdminUser = isAuthorizedAdmin(user, userName);
  const isAdmin = isAuthorizedAdminUser || isAdminUnlocked;

  // Secret access shortcuts
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Diagnostic access
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        console.log('🔍 Opening diagnostic page...');
        setCurrentPage('diagnostic');
      }
      
      // Admin access shortcut
      if (event.ctrlKey && event.shiftKey && event.key === 'A') {
        console.log('👑 Admin access requested...');
        setShowAdminLogin(true);
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

  // Admin access handlers
  const handleAdminCodeSubmit = () => {
    if (validateAdminAccessCode(adminAccessCode)) {
      setIsAdminUnlocked(true);
      setShowAdminLogin(false);
      setAdminAccessCode('');
      console.log('✅ Admin access granted');
    } else {
      alert('Invalid admin access code');
      setAdminAccessCode('');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminUnlocked(false);
    setCurrentPage('dashboard');
  };

  const handleTestLogin = () => {
    setShowTestLogin(true);
  };

  const handlePinLogin = () => {
    setShowTestLogin(false);
    setTestMode(true);
    setIsAdminUnlocked(true); // Grant admin access for test demo
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
        return <AdminDashboard onNavigate={handleNavigate} onAdminLogout={handleAdminLogout} isCodeUnlocked={isAdminUnlocked} />;
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

  // Admin access modal
  if (showAdminLogin) {
    return (
      <div className="admin-login-overlay">
        <div className="admin-login-modal">
          <div className="admin-login-header">
            <h3>👑 Admin Access</h3>
            <button className="close-btn" onClick={() => setShowAdminLogin(false)}>×</button>
          </div>
          <div className="admin-login-content">
            <p>Enter the admin access code to unlock admin privileges:</p>
            <input
              type="password"
              value={adminAccessCode}
              onChange={(e) => setAdminAccessCode(e.target.value)}
              placeholder="Admin Access Code"
              onKeyPress={(e) => e.key === 'Enter' && handleAdminCodeSubmit()}
              autoFocus
            />
            <div className="admin-login-actions">
              <button onClick={() => setShowAdminLogin(false)}>Cancel</button>
              <button onClick={handleAdminCodeSubmit} disabled={!adminAccessCode}>
                Unlock Admin
              </button>
            </div>
            {isAuthorizedAdminUser && (
              <div className="authorized-admin-notice">
                ✅ You are already an authorized admin user
              </div>
            )}
          </div>
        </div>
      </div>
    );
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
