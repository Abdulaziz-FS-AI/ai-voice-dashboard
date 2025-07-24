import React, { useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import awsconfig from '../aws-exports';

const DiagnosticPage: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<any>({});

  useEffect(() => {
    const runDiagnostics = () => {
      const currentConfig = Amplify.getConfig();
      
      const diagnosticData = {
        // Environment variables
        env: {
          REACT_APP_USER_POOL_ID: process.env.REACT_APP_USER_POOL_ID,
          REACT_APP_USER_POOL_WEB_CLIENT_ID: process.env.REACT_APP_USER_POOL_WEB_CLIENT_ID,
          NODE_ENV: process.env.NODE_ENV,
        },
        
        // Static configuration
        staticConfig: {
          userPoolId: awsconfig.Auth.Cognito.userPoolId,
          userPoolClientId: awsconfig.Auth.Cognito.userPoolClientId,
        },
        
        // Current Amplify configuration
        amplifyConfig: {
          userPoolId: currentConfig.Auth?.Cognito?.userPoolId,
          userPoolClientId: currentConfig.Auth?.Cognito?.userPoolClientId,
        },
        
        // Local storage keys
        localStorageKeys: Object.keys(localStorage).filter(key => 
          key.includes('amplify') || key.includes('cognito') || key.includes('aws')
        ),
        
        // Session storage keys
        sessionStorageKeys: Object.keys(sessionStorage).filter(key => 
          key.includes('amplify') || key.includes('cognito') || key.includes('aws')
        ),
        
        // Check for old client ID references
        oldClientIdFound: {
          inLocalStorage: Object.keys(localStorage).some(key => 
            localStorage.getItem(key)?.includes('7645g8ltvu8mqc3sobft1ns2pa')
          ),
          inSessionStorage: Object.keys(sessionStorage).some(key => 
            sessionStorage.getItem(key)?.includes('7645g8ltvu8mqc3sobft1ns2pa')
          ),
        },
        
        // Browser info
        browser: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }
      };
      
      setDiagnostics(diagnosticData);
      console.log('🔍 Complete Diagnostics:', diagnosticData);
    };
    
    runDiagnostics();
  }, []);

  const clearAllStorage = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', backgroundColor: '#1a1a2e', color: '#fff', minHeight: '100vh' }}>
      <h1>🔍 Authentication Diagnostics</h1>
      
      <button 
        onClick={clearAllStorage}
        style={{ 
          padding: '10px 20px', 
          backgroundColor: '#ff6b6b', 
          color: 'white', 
          border: 'none', 
          borderRadius: '5px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        🧹 Clear All Storage & Reload
      </button>
      
      <div style={{ backgroundColor: '#2d2d4a', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h2>📊 Current Status</h2>
        <p><strong>Expected Client ID:</strong> 2rusigajolp05bnl2hmgb34ku9</p>
        <p><strong>Actual Client ID:</strong> {diagnostics.amplifyConfig?.userPoolClientId}</p>
        <p><strong>Status:</strong> {
          diagnostics.amplifyConfig?.userPoolClientId === '2rusigajolp05bnl2hmgb34ku9' 
            ? '✅ CORRECT' 
            : '❌ WRONG'
        }</p>
      </div>

      <pre style={{ 
        backgroundColor: '#2d2d4a', 
        padding: '15px', 
        borderRadius: '8px', 
        overflow: 'auto',
        fontSize: '12px',
        lineHeight: '1.4'
      }}>
        {JSON.stringify(diagnostics, null, 2)}
      </pre>
    </div>
  );
};

export default DiagnosticPage;