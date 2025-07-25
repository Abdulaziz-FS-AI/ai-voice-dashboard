import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from './ThemeToggle';
import './AdminDashboard.css';

interface User {
  id: string;
  username: string;
  email: string;
  phone: string;
  selectedAssistant: string;
  callsCount: number;
  lastActive: string;
  status: 'active' | 'inactive';
}

interface Assistant {
  id: string;
  name: string;
  description: string;
  icon: string;
  usageCount: number;
  isActive: boolean;
}

interface AdminDashboardProps {
  onNavigate: (page: 'dashboard' | 'editor' | 'admin') => void;
  onAdminLogout?: () => void;
  isCodeUnlocked?: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate, onAdminLogout, isCodeUnlocked = false }) => {
  const [currentView, setCurrentView] = useState<'overview' | 'users' | 'assistants' | 'analytics'>('overview');
  const { userName, logout } = useAuth();
  const { } = useTheme();

  // Mock admin data
  const mockUsers: User[] = [
    {
      id: '1',
      username: 'john_doe',
      email: 'john@example.com',
      phone: '+1-555-0123',
      selectedAssistant: 'Sales Professional',
      callsCount: 45,
      lastActive: '2024-01-15',
      status: 'active'
    },
    {
      id: '2',
      username: 'sarah_smith',
      email: 'sarah@example.com',
      phone: '+1-555-0456',
      selectedAssistant: 'Customer Support',
      callsCount: 32,
      lastActive: '2024-01-14',
      status: 'active'
    },
    {
      id: '3',
      username: 'mike_wilson',
      email: 'mike@example.com',
      phone: '+1-555-0789',
      selectedAssistant: 'Appointment Scheduler',
      callsCount: 18,
      lastActive: '2024-01-10',
      status: 'inactive'
    }
  ];

  const mockAssistants: Assistant[] = [
    {
      id: 'sales-pro',
      name: 'Sales Professional',
      description: 'Expert at qualifying leads and closing deals',
      icon: '💼',
      usageCount: 45,
      isActive: true
    },
    {
      id: 'customer-support',
      name: 'Customer Support',
      description: 'Friendly and helpful support specialist',
      icon: '🎧',
      usageCount: 32,
      isActive: true
    },
    {
      id: 'appointment-scheduler',
      name: 'Appointment Scheduler',
      description: 'Efficient scheduling and calendar management',
      icon: '📅',
      usageCount: 18,
      isActive: true
    },
    {
      id: 'market-researcher',
      name: 'Market Researcher',
      description: 'Gathers insights and conducts surveys',
      icon: '📊',
      usageCount: 12,
      isActive: false
    },
    {
      id: 'virtual-receptionist',
      name: 'Virtual Receptionist',
      description: 'Professional call handling and routing',
      icon: '📞',
      usageCount: 8,
      isActive: true
    }
  ];

  const adminStats = {
    totalUsers: mockUsers.length,
    activeUsers: mockUsers.filter(u => u.status === 'active').length,
    totalCalls: mockUsers.reduce((sum, user) => sum + user.callsCount, 0),
    totalAssistants: mockAssistants.length,
    activeAssistants: mockAssistants.filter(a => a.isActive).length
  };

  const renderOverview = () => (
    <div className="admin-overview">
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-number">{adminStats.totalUsers}</div>
            <div className="stat-label">Total Users</div>
            <div className="stat-detail">{adminStats.activeUsers} active</div>
          </div>
        </div>
        
        <div className="admin-stat-card">
          <div className="stat-icon">📞</div>
          <div className="stat-content">
            <div className="stat-number">{adminStats.totalCalls}</div>
            <div className="stat-label">Total Calls</div>
            <div className="stat-detail">All time</div>
          </div>
        </div>
        
        <div className="admin-stat-card">
          <div className="stat-icon">🤖</div>
          <div className="stat-content">
            <div className="stat-number">{adminStats.totalAssistants}</div>
            <div className="stat-label">Assistants</div>
            <div className="stat-detail">{adminStats.activeAssistants} active</div>
          </div>
        </div>
      </div>

      <div className="recent-activity">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          <div className="activity-item">
            <span className="activity-icon">📞</span>
            <span>john_doe completed a call with Sales Professional</span>
            <span className="activity-time">2 hours ago</span>
          </div>
          <div className="activity-item">
            <span className="activity-icon">👤</span>
            <span>sarah_smith updated phone number</span>
            <span className="activity-time">1 day ago</span>
          </div>
          <div className="activity-item">
            <span className="activity-icon">🤖</span>
            <span>Market Researcher assistant was deactivated</span>
            <span className="activity-time">2 days ago</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="admin-users">
      <div className="section-header">
        <h3>User Management</h3>
        <button className="add-button">+ Add User</button>
      </div>
      
      <div className="users-table">
        <div className="table-header">
          <div>User</div>
          <div>Phone</div>
          <div>Assistant</div>
          <div>Calls</div>
          <div>Last Active</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        
        {mockUsers.map(user => (
          <div key={user.id} className="table-row">
            <div className="user-cell">
              <div className="user-name">{user.username}</div>
              <div className="user-email">{user.email}</div>
            </div>
            <div>{user.phone}</div>
            <div>{user.selectedAssistant}</div>
            <div>{user.callsCount}</div>
            <div>{user.lastActive}</div>
            <div>
              <span className={`status-badge ${user.status}`}>
                {user.status}
              </span>
            </div>
            <div className="actions-cell">
              <button className="action-btn edit">Edit</button>
              <button className="action-btn delete">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAssistants = () => (
    <div className="admin-assistants">
      <div className="section-header">
        <h3>Assistant Configuration</h3>
        <button className="add-button">+ Create Assistant</button>
      </div>
      
      <div className="assistants-grid">
        {mockAssistants.map(assistant => (
          <div key={assistant.id} className="assistant-admin-card">
            <div className="assistant-header">
              <span className="assistant-icon">{assistant.icon}</span>
              <h4>{assistant.name}</h4>
              <div className="status-toggle">
                <input 
                  type="checkbox" 
                  checked={assistant.isActive}
                  onChange={() => {}}
                />
                <span>Active</span>
              </div>
            </div>
            
            <p className="assistant-description">{assistant.description}</p>
            
            <div className="assistant-stats">
              <div className="stat">
                <span className="stat-label">Usage Count:</span>
                <span className="stat-value">{assistant.usageCount}</span>
              </div>
            </div>
            
            <div className="assistant-actions">
              <button className="action-btn edit">Configure</button>
              <button className="action-btn settings">Settings</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="admin-analytics">
      <h3>Usage Analytics</h3>
      
      <div className="analytics-charts">
        <div className="chart-card">
          <h4>Most Popular Assistants</h4>
          <div className="chart-bars">
            {mockAssistants
              .sort((a, b) => b.usageCount - a.usageCount)
              .map(assistant => (
                <div key={assistant.id} className="chart-bar-item">
                  <span className="bar-label">{assistant.name}</span>
                  <div className="bar-container">
                    <div 
                      className="bar-fill"
                      style={{ width: `${(assistant.usageCount / Math.max(...mockAssistants.map(a => a.usageCount))) * 100}%` }}
                    ></div>
                  </div>
                  <span className="bar-value">{assistant.usageCount}</span>
                </div>
              ))
            }
          </div>
        </div>
        
        <div className="chart-card">
          <h4>User Activity</h4>
          <div className="activity-chart">
            <div className="chart-placeholder">
              📈 User activity chart would go here
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-dashboard-container theme-bg-primary">
      <div className="admin-header theme-bg-card">
        <div className="admin-title">
          <h1>👑 Admin Dashboard</h1>
          <span className="admin-subtitle">Voice Matrix Administration</span>
          {isCodeUnlocked && (
            <div className="demo-mode-badge">
              🎯 Demo Mode Active (PIN: 123456)
            </div>
          )}
        </div>
        <div className="admin-controls">
          <ThemeToggle className="admin-theme-toggle" />
          <button className="back-to-dashboard-btn theme-button-secondary" onClick={() => onNavigate('dashboard')}>
            ← Back to Dashboard
          </button>
          <div className="admin-user-section">
            <span className="admin-user-name">
              Admin: {userName}
              {isCodeUnlocked && <span className="code-access-badge">Code Access</span>}
            </span>
            <div className="admin-logout-buttons">
              {isCodeUnlocked && onAdminLogout && (
                <button className="admin-logout-button" onClick={onAdminLogout}>
                  Exit Admin
                </button>
              )}
              <button className="logout-button" onClick={logout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-navigation">
        <button 
          className={`nav-tab ${currentView === 'overview' ? 'active' : ''}`}
          onClick={() => setCurrentView('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`nav-tab ${currentView === 'users' ? 'active' : ''}`}
          onClick={() => setCurrentView('users')}
        >
          👥 Users
        </button>
        <button 
          className={`nav-tab ${currentView === 'assistants' ? 'active' : ''}`}
          onClick={() => setCurrentView('assistants')}
        >
          🤖 Assistants
        </button>
        <button 
          className={`nav-tab ${currentView === 'analytics' ? 'active' : ''}`}
          onClick={() => setCurrentView('analytics')}
        >
          📈 Analytics
        </button>
      </div>

      <div className="admin-content">
        {currentView === 'overview' && renderOverview()}
        {currentView === 'users' && renderUsers()}
        {currentView === 'assistants' && renderAssistants()}
        {currentView === 'analytics' && renderAnalytics()}
      </div>
    </div>
  );
};

export default AdminDashboard;