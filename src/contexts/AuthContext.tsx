import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, User } from '../services/authService';

interface AuthContextType {
  user: User | null;
  userName: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  adminLogin: (pin: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Clear any old Amplify authentication cache
    const clearOldAuthCache = () => {
      const keysToCheck = Object.keys(localStorage).filter(key => 
        key.includes('amplify') || key.includes('cognito') || key.includes('7645g8ltvu8mqc3sobft1ns2pa')
      );
      if (keysToCheck.length > 0) {
        console.log('Clearing old Amplify authentication cache...');
        keysToCheck.forEach(key => localStorage.removeItem(key));
        sessionStorage.clear();
      }
    };
    
    clearOldAuthCache();
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const { valid, user: verifiedUser } = await authService.verifyToken();
      if (valid && verifiedUser) {
        setUser(verifiedUser);
        setUserName(getUserDisplayName(verifiedUser));
      } else {
        setUser(null);
        setUserName(null);
      }
    } catch (error) {
      console.error('Auth state check failed:', error);
      setUser(null);
      setUserName(null);
    } finally {
      setLoading(false);
    }
  };

  const getUserDisplayName = (user: User): string => {
    if (user.profile?.firstName && user.profile?.lastName) {
      return `${user.profile.firstName} ${user.profile.lastName}`;
    }
    if (user.profile?.firstName) {
      return user.profile.firstName;
    }
    return user.email.split('@')[0];
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);
      setUser(response.user);
      setUserName(getUserDisplayName(response.user));
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData: any) => {
    try {
      const response = await authService.register(userData);
      setUser(response.user);
      setUserName(getUserDisplayName(response.user));
    } catch (error) {
      throw error;
    }
  };

  const adminLogin = async (pin: string) => {
    try {
      const response = await authService.adminLogin(pin);
      setUser(response.user);
      setUserName(getUserDisplayName(response.user));
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      authService.logout();
      setUser(null);
      setUserName(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userName, 
      loading, 
      login,
      register,
      adminLogin,
      logout,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin'
    }}>
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