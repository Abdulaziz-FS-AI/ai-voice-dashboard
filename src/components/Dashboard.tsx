import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
  onNavigate: (page: 'dashboard' | 'editor') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const { user, logout } = useAuth();

  // Mock data
  const mockCallLogs: CallLog[] = [
    {
      id: '1',
      date: '2024-01-15',
      time: '09:15',
      duration: '3:45',
      callerName: 'John Smith',
      callerPhone: '+1-555-0123',
      outcome: 'completed',
      satisfaction: 4.5,
      responses: {
        'What service are you interested in?': 'Web development',
        'What is your budget range?': '$5,000 - $10,000',
        'When do you need this completed?': 'Within 2 months'
      }
    },
    {
      id: '2',
      date: '2024-01-15',
      time: '10:30',
      duration: '2:12',
      callerName: 'Sarah Johnson',
      callerPhone: '+1-555-0456',
      outcome: 'completed',
      satisfaction: 5.0,
      responses: {
        'What service are you interested in?': 'Mobile app development',
        'What is your budget range?': '$10,000+',
        'What platform do you need?': 'iOS and Android'
      }
    },
    {
      id: '3',
      date: '2024-01-15',
      time: '14:20',
      duration: '1:05',
      callerName: 'Mike Wilson',
      callerPhone: '+1-555-0789',
      outcome: 'abandoned',
      satisfaction: 2.0,
      responses: {
        'What service are you interested in?': 'SEO services'
      }
    },
    {
      id: '4',
      date: '2024-01-15',
      time: '16:45',
      duration: '4:20',
      callerName: 'Emily Davis',
      callerPhone: '+1-555-0321',
      outcome: 'transferred',
      satisfaction: 4.0,
      responses: {
        'What service are you interested in?': 'E-commerce platform',
        'What is your budget range?': '$15,000+',
        'Do you have existing systems?': 'Yes, legacy system'
      }
    }
  ];

  const stats = {
    totalCalls: mockCallLogs.length,
    completedCalls: mockCallLogs.filter(call => call.outcome === 'completed').length,
    averageDuration: '2:48',
    averageSatisfaction: 3.9,
    conversionRate: 75
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
          <button className="config-button" onClick={() => onNavigate('editor')}>
            Configure AI Agent
          </button>
          {user && (
            <div className="user-section">
              <span className="user-name">Welcome, {user.username}</span>
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
            
            {mockCallLogs.map(call => (
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
            ))}
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
    </div>
  );
};

export default Dashboard;