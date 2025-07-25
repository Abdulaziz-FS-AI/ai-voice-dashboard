import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import '../styles/theme.css';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { toggleTheme, isDark } = useTheme();

  return (
    <div className={`theme-toggle-container ${className}`}>
      {showLabel && (
        <span className="theme-toggle-label">
          {isDark ? '🌙 Dark' : '☀️ Light'}
        </span>
      )}
      <button 
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
        title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      >
        <span className="theme-toggle-icon">☀️</span>
        <span className="theme-toggle-icon">🌙</span>
        <div className="theme-toggle-slider">
          {isDark ? '🌙' : '☀️'}
        </div>
      </button>
    </div>
  );
};

export default ThemeToggle;