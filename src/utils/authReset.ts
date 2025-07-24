import { Amplify } from 'aws-amplify';
import awsconfig from '../aws-exports';

/**
 * Force a complete authentication reset and reconfiguration
 * This clears all cached data and reconfigures Amplify
 */
export const forceAuthReset = async (): Promise<void> => {
  console.log('🔄 Starting complete authentication reset...');
  
  try {
    // 1. Clear all browser storage
    console.log('🧹 Clearing all browser storage...');
    localStorage.clear();
    sessionStorage.clear();
    
    // 2. Clear IndexedDB (where Amplify sometimes stores data)
    if ('indexedDB' in window) {
      try {
        const databases = await indexedDB.databases();
        await Promise.all(
          databases.map(db => {
            if (db.name?.includes('amplify') || db.name?.includes('cognito')) {
              return new Promise<void>((resolve, reject) => {
                const deleteReq = indexedDB.deleteDatabase(db.name!);
                deleteReq.onsuccess = () => resolve();
                deleteReq.onerror = () => reject(deleteReq.error);
              });
            }
            return Promise.resolve();
          })
        );
        console.log('🗑️  Cleared IndexedDB');
      } catch (e) {
        console.log('⚠️  Could not clear IndexedDB:', e);
      }
    }
    
    // 3. Reconfigure Amplify with fresh config
    console.log('⚙️  Reconfiguring Amplify...');
    Amplify.configure(awsconfig);
    
    // 4. Verify configuration
    const config = Amplify.getConfig();
    const clientId = config.Auth?.Cognito?.userPoolClientId;
    console.log('✅ Reset complete! Current client ID:', clientId);
    
    if (clientId === '2rusigajolp05bnl2hmgb34ku9') {
      console.log('✅ Correct client ID confirmed (no client secret)');
      return;
    } else {
      throw new Error(`Wrong client ID: expected 2rusigajolp05bnl2hmgb34ku9, got ${clientId}`);
    }
    
  } catch (error) {
    console.error('❌ Auth reset failed:', error);
    throw error;
  }
};

/**
 * Check if we're using the old problematic client ID
 */
export const isUsingOldClientId = (): boolean => {
  try {
    const config = Amplify.getConfig();
    const clientId = config.Auth?.Cognito?.userPoolClientId;
    return clientId === '7645g8ltvu8mqc3sobft1ns2pa';
  } catch {
    return false;
  }
};