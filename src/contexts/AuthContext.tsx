import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, signOut, AuthUser, fetchUserAttributes } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

interface AuthContextType {
  user: AuthUser | null;
  userName: string | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Clear any cached authentication data that might be using old client ID
    const clearOldAuthCache = () => {
      const keysToCheck = Object.keys(localStorage).filter(key => 
        key.includes('amplify') || key.includes('cognito') || key.includes('7645g8ltvu8mqc3sobft1ns2pa')
      );
      if (keysToCheck.length > 0) {
        console.log('Clearing old authentication cache...');
        localStorage.clear();
        sessionStorage.clear();
      }
    };
    
    clearOldAuthCache();
    checkAuthState();
    
    // Listen for auth events
    const authListener = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          checkAuthState();
          break;
        case 'signedOut':
          setUser(null);
          setUserName(null);
          break;
        default:
          break;
      }
    });

    return () => authListener();
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      // Fetch user attributes to get the name
      try {
        const attributes = await fetchUserAttributes();
        const name = attributes.name || attributes.email?.split('@')[0] || currentUser.username;
        setUserName(name);
        console.log('📝 User attributes:', attributes);
      } catch (attrError) {
        console.log('⚠️ Could not fetch user attributes:', attrError);
        // Fallback to username or email
        const fallbackName = currentUser.signInDetails?.loginId?.split('@')[0] || currentUser.username;
        setUserName(fallbackName);
      }
    } catch (error) {
      setUser(null);
      setUserName(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut();
      setUser(null);
      setUserName(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userName, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};