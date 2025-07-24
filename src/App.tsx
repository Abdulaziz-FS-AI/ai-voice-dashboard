import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import VoiceAgentEditor from './components/VoiceAgentEditor';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import './App.css';

type Page = 'landing' | 'dashboard' | 'editor';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [, setAgentConfig] = useState<any>(null);

  const handleNavigate = (page: 'dashboard' | 'editor') => {
    setCurrentPage(page);
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
        <LandingPage onGetStarted={() => {}} />
      </SignedOut>
      <SignedIn>
        {renderAuthenticatedContent()}
      </SignedIn>
    </div>
  );
}

export default App;
