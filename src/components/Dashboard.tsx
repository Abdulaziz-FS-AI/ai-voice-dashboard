import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isAuthorizedAdmin, hasVapiPermission } from '../utils/adminConfig';
import { apiCall, API_CONFIG } from '../config/api';
import VapiSettings from './VapiSettings';
import PhoneSetupModal from './PhoneSetupModal';
import AssistantManager from './AssistantManager';
import './Dashboard.css';

interface CallLog {
  id: string;
  date: string;
  time: string;
  duration: string;
  callerName: string;
  callerPhone: string;
  outcome: 'completed' | 'abandoned' | 'transferred';
  responses: { [key: string]: string };
  satisfaction: number;
}

interface DashboardProps {
  onNavigate: (page: 'dashboard' | 'editor' | 'admin') => void;
  onStartAssistantSetup?: () => void;
  hasCompletedSetup?: boolean;
  userPhone?: string;
  isAdmin?: boolean;
  testMode?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  onNavigate, 
  onStartAssistantSetup,
  hasCompletedSetup = false,
  userPhone = '',
  isAdmin: propIsAdmin = false,
  testMode = false 
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'vapi-settings' | 'assistant-manager'>('dashboard');
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [customerPhoneNumber, setCustomerPhoneNumber] = useState<string>(userPhone);
  const { user, userName, logout } = useAuth();

  // Determine if user is admin
  const isUserAdmin = propIsAdmin || isAuthorizedAdmin(user, userName);

  // Load user's phone number and dashboard data on mount
  useEffect(() => {
    if (user?.userId) {
      loadUserPhoneNumber();
      loadDashboardData();
    }
  }, [user]);

  const loadUserPhoneNumber = async () => {
    try {
      const response = await apiCall(API_CONFIG.ENDPOINTS.VAPI_PHONE_NUMBERS);

      if (response.ok) {
        const phoneData = await response.json();
        setCustomerPhoneNumber(phoneData.phoneNumber);
      }
    } catch (error) {
      console.log('No phone number found or error loading:', error);
    }
  };

  const handlePhoneCreated = (phoneNumber: string, phoneId: string) => {
    setCustomerPhoneNumber(phoneNumber);
    console.log('✅ Phone number created:', phoneNumber, phoneId);
  };

  const loadDashboardData = async () => {
    try {
      const response = await apiCall(API_CONFIG.ENDPOINTS.DASHBOARD);
      
      if (response.ok) {
        const data = await response.json();
        // Update call logs if available in the response
        if (data.recentActivity) {
          setCallLogs(data.recentActivity);
        }
      }
    } catch (error) {
      console.log('Error loading dashboard data:', error);
    }
  };

  // Call logs state
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);

  const stats = {
    totalCalls: callLogs.length,
    completedCalls: callLogs.filter(call => call.outcome === 'completed').length,
    averageDuration: callLogs.length > 0 ? 'N/A' : '0:00',
    averageSatisfaction: callLogs.length > 0 ? 
      (callLogs.reduce((acc, call) => acc + call.satisfaction, 0) / callLogs.length).toFixed(1) : 
      '0.0',
    conversionRate: callLogs.length > 0 ? 
      Math.round((callLogs.filter(call => call.outcome === 'completed').length / callLogs.length) * 100) : 
      0
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'completed': return '#28a745';
      case 'abandoned': return '#dc3545';
      case 'transferred': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const getSatisfactionColor = (rating: number) => {
    if (rating >= 4.5) return '#28a745';
    if (rating >= 3.5) return '#ffc107';
    return '#dc3545';
  };

  if (currentView === 'vapi-settings') {
    return <VapiSettings onBack={() => setCurrentView('dashboard')} testMode={testMode} isAdmin={isUserAdmin} />;
  }

  if (currentView === 'assistant-manager') {
    return <AssistantManager onBack={() => setCurrentView('dashboard')} />;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-logo">
          <img 
            src="/voice-matrix-logo.png" 
            alt="Voice Matrix" 
            className="dashboard-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="header-title">
            <h1>Voice Matrix Dashboard</h1>
            <span className="dashboard-subtitle">Call Analytics & Management</span>
          </div>
        </div>
        <div className="header-controls">
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="period-selector"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          
          {!hasCompletedSetup && onStartAssistantSetup && (
            <button className="get-started-button" onClick={onStartAssistantSetup}>
              🚀 Get Started with Assistant
            </button>
          )}
          
          {hasCompletedSetup && (
            <>
              <button className="config-button" onClick={() => setCurrentView('assistant-manager')}>
                🤖 Manage Assistants
              </button>
              
              {!customerPhoneNumber ? (
                <button 
                  className="phone-setup-button" 
                  onClick={() => setIsPhoneModalOpen(true)}
                >
                  📱 Get Phone Number
                </button>
              ) : (
                <div className="phone-display">
                  <span className="phone-number">📱 {customerPhoneNumber}</span>
                  <button 
                    className="change-phone-button" 
                    onClick={() => setIsPhoneModalOpen(true)}
                    title="Change phone number"
                  >
                    ⚙️
                  </button>
                </div>
              )}
              
              <button className="settings-button" onClick={() => setCurrentView('vapi-settings')}>
                🔑 VAPI Settings {isUserAdmin && '(Admin)'}
              </button>
            </>
          )}
          
          {isUserAdmin && (
            <button className="admin-button" onClick={() => onNavigate('admin')}>
              👑 Admin Panel
            </button>
          )}
          
          {testMode && (
            <div className="test-mode-notice">
              🎯 Demo Mode: Full admin access enabled (PIN: 123456)
            </div>
          )}
          
          {user && (
            <div className="user-section">
              <span className="user-name">Welcome, {userName || 'User'}{isUserAdmin && ' (Admin)'}</span>
              <button className="logout-button" onClick={logout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalCalls}</div>
          <div className="stat-label">Total Calls</div>
          <div className="stat-change">+12% from yesterday</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{stats.completedCalls}</div>
          <div className="stat-label">Completed</div>
          <div className="stat-change">+8% from yesterday</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{stats.averageDuration}</div>
          <div className="stat-label">Avg Duration</div>
          <div className="stat-change">-5% from yesterday</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{stats.averageSatisfaction}/5</div>
          <div className="stat-label">Satisfaction</div>
          <div className="stat-change">+0.2 from yesterday</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{stats.conversionRate}%</div>
          <div className="stat-label">Conversion</div>
          <div className="stat-change">+15% from yesterday</div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="calls-section">
          <h2>Recent Calls</h2>
          <div className="calls-table">
            <div className="table-header">
              <div>Time</div>
              <div>Caller</div>
              <div>Duration</div>
              <div>Outcome</div>
              <div>Satisfaction</div>
              <div>Actions</div>
            </div>
            
            {callLogs.length > 0 ? (
              callLogs.map(call => (
                <div key={call.id} className="table-row">
                <div className="time-cell">
                  <div className="call-time">{call.time}</div>
                  <div className="call-date">{call.date}</div>
                </div>
                <div className="caller-cell">
                  <div className="caller-name">{call.callerName}</div>
                  <div className="caller-phone">{call.callerPhone}</div>
                </div>
                <div className="duration-cell">{call.duration}</div>
                <div className="outcome-cell">
                  <span 
                    className="outcome-badge"
                    style={{ backgroundColor: getOutcomeColor(call.outcome) }}
                  >
                    {call.outcome}
                  </span>
                </div>
                <div className="satisfaction-cell">
                  <span 
                    className="satisfaction-rating"
                    style={{ color: getSatisfactionColor(call.satisfaction) }}
                  >
                    ★ {call.satisfaction}
                  </span>
                </div>
                <div className="actions-cell">
                  <button 
                    className="view-button"
                    onClick={() => setSelectedCall(call)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📞</div>
                <h3>No calls yet</h3>
                <p>Once you start receiving calls, they'll appear here</p>
              </div>
            )}
          </div>
        </div>

        <div className="analytics-section">
          <h2>Performance Insights</h2>
          <div className="insights-grid">
            <div className="insight-card">
              <h3>Peak Hours</h3>
              <p>Most calls received between 2-4 PM</p>
              <div className="insight-chart">
                <div className="chart-bar" style={{ height: '60%' }}>9AM</div>
                <div className="chart-bar" style={{ height: '80%' }}>12PM</div>
                <div className="chart-bar" style={{ height: '100%' }}>3PM</div>
                <div className="chart-bar" style={{ height: '70%' }}>6PM</div>
              </div>
            </div>
            
            <div className="insight-card">
              <h3>Common Requests</h3>
              <div className="request-list">
                <div className="request-item">
                  <span>Web Development</span>
                  <span className="request-count">45%</span>
                </div>
                <div className="request-item">
                  <span>Mobile Apps</span>
                  <span className="request-count">30%</span>
                </div>
                <div className="request-item">
                  <span>SEO Services</span>
                  <span className="request-count">25%</span>
                </div>
              </div>
            </div>
            
            <div className="insight-card">
              <h3>AI Performance</h3>
              <div className="performance-metrics">
                <div className="metric">
                  <span>Response Accuracy</span>
                  <div className="metric-bar">
                    <div className="metric-fill" style={{ width: '92%' }}></div>
                  </div>
                  <span>92%</span>
                </div>
                <div className="metric">
                  <span>Call Completion</span>
                  <div className="metric-bar">
                    <div className="metric-fill" style={{ width: '87%' }}></div>
                  </div>
                  <span>87%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedCall && (
        <div className="modal-overlay" onClick={() => setSelectedCall(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Call Details - {selectedCall.callerName}</h3>
              <button className="close-button" onClick={() => setSelectedCall(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="call-info">
                <div className="info-row">
                  <strong>Date & Time:</strong> {selectedCall.date} at {selectedCall.time}
                </div>
                <div className="info-row">
                  <strong>Duration:</strong> {selectedCall.duration}
                </div>
                <div className="info-row">
                  <strong>Phone:</strong> {selectedCall.callerPhone}
                </div>
                <div className="info-row">
                  <strong>Outcome:</strong> 
                  <span 
                    className="outcome-badge"
                    style={{ backgroundColor: getOutcomeColor(selectedCall.outcome), marginLeft: '10px' }}
                  >
                    {selectedCall.outcome}
                  </span>
                </div>
              </div>
              
              <div className="responses-section">
                <h4>Collected Information:</h4>
                {Object.entries(selectedCall.responses).map(([question, answer], index) => (
                  <div key={index} className="response-item">
                    <div className="question">{question}</div>
                    <div className="answer">{answer}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <PhoneSetupModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        onPhoneCreated={handlePhoneCreated}
        customerId={user?.userId || 'demo-customer'}
      />
    </div>
  );
};

export default Dashboard;