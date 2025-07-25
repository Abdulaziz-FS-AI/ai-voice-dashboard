import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import '../styles/theme.css';
import '../styles/killer-theme-toggle.css';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  className = '', 
  showLabel = false,
  size = 'medium'
}) => {
  const { toggleTheme, isDark } = useTheme();
  
  const handleToggle = () => {
    // Add haptic feedback if supported
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    // Add visual feedback with particles
    const button = document.querySelector('.killer-theme-toggle');
    if (button) {
      button.classList.add('clicked');
      setTimeout(() => button.classList.remove('clicked'), 600);
    }
    
    toggleTheme();
  };

  return (
    <div className={`killer-theme-toggle-container ${className} ${size}`}>
      {showLabel && (
        <span className="killer-theme-label">
          <span className={`label-text ${isDark ? 'active' : ''}`}>
            🌙 Dark
          </span>
          <span className={`label-text ${!isDark ? 'active' : ''}`}>
            ☀️ Light
          </span>
        </span>
      )}
      
      <button 
        className={`killer-theme-toggle ${isDark ? 'dark' : 'light'}`}
        onClick={handleToggle}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
        title={`Currently ${isDark ? 'dark' : 'light'} mode - click to switch`}
      >
        {/* Background track */}
        <div className="toggle-track">
          <div className="track-bg"></div>
          <div className="track-glow"></div>
        </div>
        
        {/* Icons in track */}
        <div className="toggle-icons">
          <span className="icon-sun">☀️</span>
          <span className="icon-moon">🌙</span>
        </div>
        
        {/* Sliding thumb */}
        <div className="toggle-thumb">
          <div className="thumb-inner">
            <span className="thumb-icon">
              {isDark ? '🌙' : '☀️'}
            </span>
          </div>
          <div className="thumb-glow"></div>
        </div>
        
        {/* Particle effects */}
        <div className="toggle-particles">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`particle particle-${i + 1}`}></div>
          ))}
        </div>
      </button>
    </div>
  );
};

export default ThemeToggle;