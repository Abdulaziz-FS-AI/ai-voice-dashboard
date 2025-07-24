import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import PinLogin from './components/PinLogin';
import Dashboard from './components/Dashboard';
import VoiceAgentEditor from './components/VoiceAgentEditor';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import './App.css';

type Page = 'landing' | 'test-login' | 'dashboard' | 'editor';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [, setAgentConfig] = useState<any>(null);
  const [isTestMode, setIsTestMode] = useState(false);

  const handleNavigate = (page: 'dashboard' | 'editor') => {
    setCurrentPage(page);
  };

  const handleTestLogin = () => {
    setCurrentPage('test-login');
  };

  const handlePinLogin = () => {
    setIsTestMode(true);
    setCurrentPage('dashboard');
  };

  const handleSaveConfig = (config: any) => {
    setAgentConfig(config);
    console.log('Agent configuration saved:', config);
  };

  const renderAuthenticatedContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'editor':
        return <VoiceAgentEditor onSave={handleSaveConfig} onNavigate={handleNavigate} />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="App">
      <SignedOut>
        {currentPage === 'test-login' ? (
          <PinLogin onLogin={handlePinLogin} />
        ) : isTestMode && currentPage === 'dashboard' ? (
          renderAuthenticatedContent()
        ) : isTestMode && currentPage === 'editor' ? (
          renderAuthenticatedContent()
        ) : (
          <LandingPage onTestLogin={handleTestLogin} />
        )}
      </SignedOut>
      <SignedIn>
        {renderAuthenticatedContent()}
      </SignedIn>
    </div>
  );
}

export default App;
