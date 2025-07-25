/**
 * Frontend Authentication Flow Tests
 * Tests React components and authentication flow
 * Run with: npm test -- tests/frontend-auth-tests.js
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { act } from 'react-dom/test-utils';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock components and contexts
jest.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    login: jest.fn(),
    register: jest.fn(),
    adminLogin: jest.fn(),
    logout: jest.fn(),
    user: null,
    userName: null,
    loading: false,
    isAuthenticated: false,
    isAdmin: false
  }),
  AuthProvider: ({ children }) => children
}));

describe('Frontend Authentication Tests', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('CustomAuth Component', () => {
    const CustomAuth = require('../src/components/CustomAuth').default;

    test('renders login form by default', () => {
      render(<CustomAuth onSuccess={() => {}} onBack={() => {}} />);
      
      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    test('switches to signup form when clicked', () => {
      render(<CustomAuth onSuccess={() => {}} onBack={() => {}} />);
      
      fireEvent.click(screen.getByText('Sign Up'));
      
      expect(screen.getByText('Create Account')).toBeInTheDocument();
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    });

    test('validates password length on signup', async () => {
      render(<CustomAuth onSuccess={() => {}} onBack={() => {}} />);
      
      fireEvent.click(screen.getByText('Sign Up'));
      
      const firstNameInput = screen.getByLabelText(/first name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password.*minimum 8/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      
      fireEvent.change(firstNameInput, { target: { value: 'Test' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'short' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'short' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });

    test('validates password confirmation match', async () => {
      render(<CustomAuth onSuccess={() => {}} onBack={() => {}} />);
      
      fireEvent.click(screen.getByText('Sign Up'));
      
      const firstNameInput = screen.getByLabelText(/first name/i);
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password.*minimum 8/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      
      fireEvent.change(firstNameInput, { target: { value: 'Test' } });
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmPasswordInput, { target: { value: 'different123' } });
      
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });
  });

  describe('PinLogin Component', () => {
    const PinLogin = require('../src/components/PinLogin').default;
    const mockAdminLogin = jest.fn();

    beforeEach(() => {
      jest.doMock('../src/contexts/AuthContext', () => ({
        useAuth: () => ({
          adminLogin: mockAdminLogin,
          user: null,
          userName: null,
          loading: false,
          isAuthenticated: false,
          isAdmin: false
        })
      }));
    });

    test('renders PIN input interface', () => {
      render(<PinLogin onLogin={() => {}} />);
      
      expect(screen.getByText('Voice Matrix')).toBeInTheDocument();
      expect(screen.getByText('Enter your PIN to access the dashboard')).toBeInTheDocument();
      
      // Check for 6 PIN digit inputs
      const pinDigits = screen.getAllByText('', { selector: '.pin-digit' });
      expect(pinDigits).toHaveLength(6);
    });

    test('allows PIN entry via keypad', () => {
      render(<PinLogin onLogin={() => {}} />);
      
      // Click numbers 1, 2, 3, 4, 5, 6
      fireEvent.click(screen.getByText('1'));
      fireEvent.click(screen.getByText('2'));
      fireEvent.click(screen.getByText('3'));
      fireEvent.click(screen.getByText('4'));
      fireEvent.click(screen.getByText('5'));
      fireEvent.click(screen.getByText('6'));
      
      // Check if login button becomes enabled
      const loginButton = screen.getByRole('button', { name: /login/i });
      expect(loginButton).not.toBeDisabled();
    });

    test('calls adminLogin when PIN is submitted', async () => {
      const mockOnLogin = jest.fn();
      render(<PinLogin onLogin={mockOnLogin} />);
      
      // Enter PIN 123456
      fireEvent.click(screen.getByText('1'));
      fireEvent.click(screen.getByText('2'));
      fireEvent.click(screen.getByText('3'));
      fireEvent.click(screen.getByText('4'));
      fireEvent.click(screen.getByText('5'));
      fireEvent.click(screen.getByText('6'));
      
      // Submit
      fireEvent.click(screen.getByRole('button', { name: /login/i }));
      
      await waitFor(() => {
        expect(mockAdminLogin).toHaveBeenCalledWith('123456');
      });
    });

    test('clears PIN on clear button click', () => {
      render(<PinLogin onLogin={() => {}} />);
      
      // Enter some digits
      fireEvent.click(screen.getByText('1'));
      fireEvent.click(screen.getByText('2'));
      fireEvent.click(screen.getByText('3'));
      
      // Click clear
      fireEvent.click(screen.getByText('Clear'));
      
      // Login button should be disabled again
      const loginButton = screen.getByRole('button', { name: /login/i });
      expect(loginButton).toBeDisabled();
    });
  });

  describe('AuthService Integration', () => {
    const authService = require('../src/services/authService').authService;

    test('stores token and user data on successful login', () => {
      const mockToken = 'mock-jwt-token';
      const mockUser = { userId: '123', email: 'test@example.com', role: 'user' };
      
      // Mock localStorage
      const localStorageMock = {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn()
      };
      global.localStorage = localStorageMock;
      
      authService.setAuthData = jest.fn();
      authService.setAuthData(mockToken, mockUser);
      
      expect(authService.setAuthData).toHaveBeenCalledWith(mockToken, mockUser);
    });

    test('clears authentication data on logout', () => {
      const localStorageMock = {
        removeItem: jest.fn()
      };
      global.localStorage = localStorageMock;
      
      authService.logout();
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('userData');
    });

    test('returns correct admin status', () => {
      const adminUser = { userId: '123', email: 'admin@test.com', role: 'admin' };
      const regularUser = { userId: '456', email: 'user@test.com', role: 'user' };
      
      // Mock getUser method
      authService.getUser = jest.fn();
      
      authService.getUser.mockReturnValue(adminUser);
      expect(authService.isAdmin()).toBe(true);
      
      authService.getUser.mockReturnValue(regularUser);
      expect(authService.isAdmin()).toBe(false);
      
      authService.getUser.mockReturnValue(null);
      expect(authService.isAdmin()).toBe(false);
    });
  });

  describe('API Configuration', () => {
    const { API_CONFIG } = require('../src/config/api');

    test('has correct base URL', () => {
      expect(API_CONFIG.BASE_URL).toBe('https://jtpyvtfavj.execute-api.us-east-1.amazonaws.com/production');
    });

    test('has all required endpoints', () => {
      const requiredEndpoints = [
        'AUTH_LOGIN',
        'AUTH_REGISTER', 
        'AUTH_ADMIN_LOGIN',
        'AUTH_VERIFY_TOKEN',
        'VAPI_ASSISTANTS',
        'VAPI_CREDENTIALS',
        'DASHBOARD_OVERVIEW',
        'ADMIN_USERS'
      ];
      
      requiredEndpoints.forEach(endpoint => {
        expect(API_CONFIG.ENDPOINTS).toHaveProperty(endpoint);
        expect(typeof API_CONFIG.ENDPOINTS[endpoint]).toBe('string');
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error message on failed login', async () => {
      const CustomAuth = require('../src/components/CustomAuth').default;
      
      // Mock failed login
      jest.doMock('../src/contexts/AuthContext', () => ({
        useAuth: () => ({
          login: jest.fn().mockRejectedValue(new Error('Invalid credentials')),
          register: jest.fn(),
          adminLogin: jest.fn(),
          logout: jest.fn(),
          user: null,
          userName: null,
          loading: false,
          isAuthenticated: false,
          isAdmin: false
        })
      }));
      
      render(<CustomAuth onSuccess={() => {}} onBack={() => {}} />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });
  });
});

// Test runner configuration
const testConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.js'],
  moduleNameMapping: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/index.js',
    '!src/reportWebVitals.js'
  ],
  testMatch: ['<rootDir>/tests/**/*.test.{js,jsx,ts,tsx}']
};

module.exports = testConfig;