import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Voice Matrix', () => {
  render(<App />);
  const titleElement = screen.getByText(/Voice Matrix/i);
  expect(titleElement).toBeInTheDocument();
});

test('renders PIN login form', () => {
  render(<App />);
  const pinLoginText = screen.getByText(/Enter your PIN to access the dashboard/i);
  expect(pinLoginText).toBeInTheDocument();
});

test('renders login button', () => {
  render(<App />);
  const loginButton = screen.getByRole('button', { name: /login/i });
  expect(loginButton).toBeInTheDocument();
  expect(loginButton).toBeDisabled();
});
