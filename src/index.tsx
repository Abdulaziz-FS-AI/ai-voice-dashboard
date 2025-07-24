import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { Amplify } from 'aws-amplify';
import awsconfig from './aws-exports';

console.log('🔧 Amplify Configuration:');
console.log('Environment Variables:');
console.log('- REACT_APP_USER_POOL_ID:', process.env.REACT_APP_USER_POOL_ID);
console.log('- REACT_APP_USER_POOL_WEB_CLIENT_ID:', process.env.REACT_APP_USER_POOL_WEB_CLIENT_ID);

// Check for problematic environment variable
if (process.env.REACT_APP_USER_POOL_WEB_CLIENT_ID === '7645g8ltvu8mqc3sobft1ns2pa') {
  console.error('🚨 DETECTED OLD CLIENT ID IN ENVIRONMENT VARIABLE!');
  console.error('🚨 AWS Amplify environment variable needs to be updated!');
  console.error('🚨 Forcing override to new client ID...');
}

console.log('Final Config:');
console.log('- Client ID:', awsconfig.Auth.Cognito.userPoolClientId);
console.log('- Pool ID:', awsconfig.Auth.Cognito.userPoolId);

if (awsconfig.Auth.Cognito.userPoolClientId !== '74d2vmmqkhkaeqva03duv4h8r0') {
  console.error('🚨 WRONG CLIENT ID IN FINAL CONFIG!');
  console.error('🚨 Expected: 74d2vmmqkhkaeqva03duv4h8r0');
  console.error('🚨 Got:', awsconfig.Auth.Cognito.userPoolClientId);
}

console.log('Full config:', JSON.stringify(awsconfig, null, 2));

// Clear any existing Amplify cache before configuring
console.log('🧹 Clearing Amplify cache...');
localStorage.removeItem('aws-amplify-cache');
sessionStorage.removeItem('aws-amplify-cache');

// Clear all keys that might contain old auth data
Object.keys(localStorage).forEach(key => {
  if (key.includes('amplify') || key.includes('cognito') || key.includes('7645g8ltvu8mqc3sobft1ns2pa')) {
    console.log('🗑️  Removing cached key:', key);
    localStorage.removeItem(key);
  }
});

// Force a complete reconfiguration
try {
  Amplify.configure(awsconfig);
  console.log('✅ Amplify configured with new client ID');
  
  // Verify configuration took effect
  const currentConfig = Amplify.getConfig();
  console.log('🔍 Verification - Current client ID:', currentConfig.Auth?.Cognito?.userPoolClientId);
} catch (error) {
  console.error('❌ Amplify configuration failed:', error);
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
