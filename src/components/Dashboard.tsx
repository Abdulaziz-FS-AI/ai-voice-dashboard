import React, { useState, useEffect, useCallback } from 'react';
import './Dashboard.css';

interface DashboardProps {
  user: any;
  token: string;
  onLogout: () => void;
}

interface DashboardData {
  user: {
    name: string;
    email: string;
    subscription: {
      plan: string;
      status: string;
    };
  };
  setup: {
    profileComplete: boolean;
    vapiConfigured: boolean;
    assistantsCreated: number;
    phoneNumbersLinked: number;
  };
  stats: {
    totalCalls: number;
    successfulCalls: number;
    averageDuration: string;
    satisfactionScore: string;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
  }>;
}

const Dashboard: React.FC<DashboardProps> = ({ user, token, onLogout }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-api-gateway-url.com';

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/overview`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else {
        setError('Failed to load dashboard data');
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Network error loading dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [token, API_BASE_URL]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleLogout = () => {
    localStorage.removeItem('voiceMatrixToken');
    onLogout();
  };

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <p>{error}</p>
        <button onClick={fetchDashboardData}>Retry</button>
      </div>
    );
  }

  const data = dashboardData!;

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-logo">
            <div className="logo-icon">🎙️</div>
            <span className="logo-text">Voice Matrix</span>
          </div>
          <div className="header-actions">
            <div className="user-info">
              <span className="user-name">{data.user.name}</span>
              <span className="user-plan">{data.user.subscription.plan}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-container">
          {/* Welcome Section */}
          <section className="welcome-section">
            <h1>Welcome back, {data.user.name.split(' ')[0] || 'User'}!</h1>
            <p>Here's what's happening with your voice assistants today.</p>
          </section>

          {/* Setup Progress */}
          {(!data.setup.profileComplete || !data.setup.vapiConfigured) && (
            <section className="setup-section">
              <div className="setup-card">
                <h2>🚀 Complete Your Setup</h2>
                <div className="setup-items">
                  {!data.setup.profileComplete && (
                    <div className="setup-item">
                      <span className="setup-icon">👤</span>
                      <span>Complete your profile</span>
                      <button className="setup-btn">Complete</button>
                    </div>
                  )}
                  {!data.setup.vapiConfigured && (
                    <div className="setup-item">
                      <span className="setup-icon">🔑</span>
                      <span>Configure VAPI integration</span>
                      <button className="setup-btn">Setup</button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Stats Grid */}
          <section className="stats-section">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📞</div>
                <div className="stat-content">
                  <h3>Total Calls</h3>
                  <p className="stat-number">{data.stats.totalCalls}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">✅</div>
                <div className="stat-content">
                  <h3>Successful Calls</h3>
                  <p className="stat-number">{data.stats.successfulCalls}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-content">
                  <h3>Avg Duration</h3>
                  <p className="stat-number">{data.stats.averageDuration}</p>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⭐</div>
                <div className="stat-content">
                  <h3>Satisfaction</h3>
                  <p className="stat-number">{data.stats.satisfactionScore}/5</p>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section className="actions-section">
            <h2>Quick Actions</h2>
            <div className="actions-grid">
              <button className="action-card">
                <div className="action-icon">🤖</div>
                <div className="action-content">
                  <h3>Create Assistant</h3>
                  <p>Build a new AI voice assistant</p>
                </div>
              </button>
              <button className="action-card">
                <div className="action-icon">📊</div>
                <div className="action-content">
                  <h3>View Analytics</h3>
                  <p>Analyze call performance</p>
                </div>
              </button>
              <button className="action-card">
                <div className="action-icon">📞</div>
                <div className="action-content">
                  <h3>Manage Numbers</h3>
                  <p>Configure phone numbers</p>
                </div>
              </button>
              <button className="action-card">
                <div className="action-icon">⚙️</div>
                <div className="action-content">
                  <h3>Settings</h3>
                  <p>Update your preferences</p>
                </div>
              </button>
            </div>
          </section>

          {/* Recent Activity */}
          <section className="activity-section">
            <h2>Recent Activity</h2>
            <div className="activity-list">
              {data.recentActivity.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-icon">
                    {activity.type === 'call_completed' ? '📞' : 
                     activity.type === 'assistant_created' ? '🤖' : '📋'}
                  </div>
                  <div className="activity-content">
                    <p>{activity.message}</p>
                    <span className="activity-time">
                      {new Date(activity.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;