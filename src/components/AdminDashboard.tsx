import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiCall, API_CONFIG } from '../config/api';
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
  const { user, userName, logout } = useAuth();
  const [loading, setLoading] = useState(true);

  // Data states
  const [users, setUsers] = useState<User[]>([]);
  const [assistants, setAssistants] = useState<Assistant[]>([]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAdminData();
    }
  }, [user]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      // Load users
      const usersResponse = await apiCall(API_CONFIG.ENDPOINTS.ADMIN_USERS);
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData);
      }

      // Load assistants
      const assistantsResponse = await apiCall(API_CONFIG.ENDPOINTS.VAPI_ASSISTANTS);
      if (assistantsResponse.ok) {
        const assistantsData = await assistantsResponse.json();
        setAssistants(assistantsData.map((a: any) => ({
          id: a.id,
          name: a.name,
          description: a.firstMessage || 'AI Assistant',
          icon: '🤖',
          usageCount: 0,
          isActive: true
        })));
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const adminStats = {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.status === 'active').length,
    totalCalls: users.reduce((sum, user) => sum + user.callsCount, 0),
    totalAssistants: assistants.length,
    activeAssistants: assistants.filter(a => a.isActive).length
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
        
        {users.length > 0 ? (
          users.map(user => (
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
        ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No users yet</h3>
            <p>Users will appear here once they sign up</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderAssistants = () => (
    <div className="admin-assistants">
      <div className="section-header">
        <h3>Assistant Configuration</h3>
        <button 
          className="add-button"
          onClick={() => onNavigate('editor')}
        >
          + Create Assistant
        </button>
      </div>
      
      <div className="assistants-grid">
        {assistants.length > 0 ? (
          assistants.map(assistant => (
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
              <button 
                className="action-btn edit"
                onClick={() => onNavigate('editor')}
              >
                Configure
              </button>
              <button className="action-btn settings">Settings</button>
            </div>
          </div>
        ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">🤖</div>
            <h3>No assistants created</h3>
            <p>Create your first assistant to get started</p>
          </div>
        )}
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
            {assistants.length > 0 ? (
              assistants
                .sort((a, b) => b.usageCount - a.usageCount)
                .map(assistant => (
                  <div key={assistant.id} className="chart-bar-item">
                    <span className="bar-label">{assistant.name}</span>
                    <div className="bar-container">
                      <div 
                        className="bar-fill"
                        style={{ width: `${(assistant.usageCount / Math.max(...assistants.map(a => a.usageCount), 1)) * 100}%` }}
                      ></div>
                  </div>
                  <span className="bar-value">{assistant.usageCount}</span>
                </div>
              ))
            ) : (
              <div className="empty-chart">
                <p>No assistant data available</p>
              </div>
            )}
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
          <button className="back-to-dashboard-btn" onClick={() => onNavigate('dashboard')}>
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