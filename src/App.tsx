import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import PinLogin from './components/PinLogin';
import Dashboard from './components/Dashboard';
import VoiceAgentEditor from './components/VoiceAgentEditor';
import './App.css';

type Page = 'landing' | 'login' | 'dashboard' | 'editor';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [, setAgentConfig] = useState<any>(null);

  const handleGetStarted = () => {
    setCurrentPage('login');
  };

  const handleLogin = () => {
    setCurrentPage('dashboard');
  };

  const handleNavigate = (page: 'dashboard' | 'editor') => {
    setCurrentPage(page);
  };

  const handleSaveConfig = (config: any) => {
    setAgentConfig(config);
    console.log('Agent configuration saved:', config);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'landing':
        return <LandingPage onGetStarted={handleGetStarted} />;
      case 'login':
        return <PinLogin onLogin={handleLogin} />;
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'editor':
        return <VoiceAgentEditor onSave={handleSaveConfig} onNavigate={handleNavigate} />;
      default:
        return <LandingPage onGetStarted={handleGetStarted} />;
    }
  };

  return (
    <div className="App">
      {renderCurrentPage()}
    </div>
  );
}

export default App;
