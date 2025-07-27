import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AnalyticsDashboard.css';

interface AnalyticsDashboardProps {
  user: any;
  token: string;
  onLogout: () => void;
}

interface TemplateAnalytics {
  templateId: string;
  templateName: string;
  category: string;
  industry: string[];
  period: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageDuration: number;
  averageQualityScore: number;
  totalUsages: number;
  activeAssistants: number;
  deployedAssistants: number;
  escalationsTriggered: number;
  topObjectives: { objective: string; count: number }[];
  successRate: number;
  escalationRate: number;
  uniqueUsers: number;
  averageRating: number;
}

interface EnhancedAnalytics {
  overview: {
    totalCalls: number;
    totalCallsToday: number;
    totalCallsWeek: number;
    averageCallDuration: number;
    averageQualityScore: number;
    overallSuccessRate: number;
    totalEscalations: number;
    totalAssistants: number;
    activeAssistants: number;
    deployedToday: number;
  };
  templateAnalytics: TemplateAnalytics[];
  businessObjectives: {
    objective: string;
    totalAchieved: number;
    successRate: number;
    topTemplates: string[];
  }[];
  trends: {
    callVolumeByHour: Record<string, number>;
    qualityTrends: Record<string, number>;
    escalationTrends: Record<string, number>;
  };
  alerts: {
    type: string;
    message: string;
    timestamp: string;
    severity: 'low' | 'medium' | 'high';
  }[];
}

interface CallLog {
  callId: string;
  assistantId: string;
  assistantName: string;
  templateName: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: string;
  qualityScore: number;
  objectivesAchieved: string[];
  escalated: boolean;
  summary: string;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ user, token, onLogout }) => {
  const [analyticsData, setAnalyticsData] = useState<EnhancedAnalytics | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeframe, setTimeframe] = useState('week');
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timer | null>(null);

  const navigate = useNavigate();
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-api-gateway-url.com';

  useEffect(() => {
    fetchAnalytics();
    if (activeTab === 'calls') {
      fetchCallLogs();
    }

    // Set up auto-refresh every 30 seconds for real-time data
    const interval = setInterval(() => {
      fetchAnalytics();
      if (activeTab === 'calls') {
        fetchCallLogs();
      }
    }, 30000);

    setRefreshInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeframe, activeTab]);

  const fetchAnalytics = async () => {
    try {
      setError('');
      
      // Fetch enhanced analytics from multiple endpoints
      const [overviewRes, templatesRes, objectivesRes, trendsRes, alertsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/analytics/enhanced/overview?period=${timeframe}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE_URL}/analytics/enhanced/templates?period=${timeframe}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE_URL}/analytics/enhanced/objectives?period=${timeframe}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE_URL}/analytics/enhanced/trends?period=${timeframe}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }),
        fetch(`${API_BASE_URL}/analytics/enhanced/alerts`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        })
      ]);

      const enhancedData: EnhancedAnalytics = {
        overview: { totalCalls: 0, totalCallsToday: 0, totalCallsWeek: 0, averageCallDuration: 0, averageQualityScore: 0, overallSuccessRate: 0, totalEscalations: 0, totalAssistants: 0, activeAssistants: 0, deployedToday: 0 },
        templateAnalytics: [],
        businessObjectives: [],
        trends: { callVolumeByHour: {}, qualityTrends: {}, escalationTrends: {} },
        alerts: []
      };

      // Process overview data
      if (overviewRes.ok) {
        const overviewData = await overviewRes.json();
        enhancedData.overview = overviewData.overview || enhancedData.overview;
      }

      // Process template analytics
      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        enhancedData.templateAnalytics = templatesData.analytics || [];
      }

      // Process business objectives
      if (objectivesRes.ok) {
        const objectivesData = await objectivesRes.json();
        enhancedData.businessObjectives = objectivesData.objectives || [];
      }

      // Process trends
      if (trendsRes.ok) {
        const trendsData = await trendsRes.json();
        enhancedData.trends = trendsData.trends || enhancedData.trends;
      }

      // Process alerts
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        enhancedData.alerts = alertsData.alerts || [];
      }

      setAnalyticsData(enhancedData);

    } catch (err) {
      console.error('Error loading enhanced analytics:', err);
      setError('Network error loading analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCallLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/enhanced/calls?limit=20&period=${timeframe}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCallLogs(data.calls || []);
      }
    } catch (err) {
      console.error('Error loading enhanced call logs:', err);
    }
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const renderBarChart = (data: Record<string, number>, title: string) => {
    const maxValue = Math.max(...Object.values(data));
    const entries = Object.entries(data).slice(-10); // Show last 10 entries

    return (
      <div className="chart-container">
        <h4>{title}</h4>
        <div className="bar-chart">
          {entries.map(([key, value]) => (
            <div key={key} className="bar-item">
              <div 
                className="bar"
                style={{ height: `${(value / maxValue) * 100}%` }}
              >
                <span className="bar-value">{value}</span>
              </div>
              <span className="bar-label">{key}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPieChart = (data: Record<string, number>, title: string) => {
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    let currentAngle = 0;

    return (
      <div className="pie-chart-container">
        <h4>{title}</h4>
        <div className="pie-chart">
          <svg viewBox="0 0 100 100" className="pie">
            {Object.entries(data).map(([key, value], index) => {
              const percentage = (value / total) * 100;
              const angle = (percentage / 100) * 360;
              const x1 = 50 + 40 * Math.cos((currentAngle * Math.PI) / 180);
              const y1 = 50 + 40 * Math.sin((currentAngle * Math.PI) / 180);
              const x2 = 50 + 40 * Math.cos(((currentAngle + angle) * Math.PI) / 180);
              const y2 = 50 + 40 * Math.sin(((currentAngle + angle) * Math.PI) / 180);
              const largeArc = angle > 180 ? 1 : 0;
              
              const pathData = [
                'M', 50, 50,
                'L', x1, y1,
                'A', 40, 40, 0, largeArc, 1, x2, y2,
                'Z'
              ].join(' ');

              currentAngle += angle;

              return (
                <path
                  key={key}
                  d={pathData}
                  fill={`hsl(${index * 120}, 70%, 60%)`}
                  stroke="white"
                  strokeWidth="1"
                />
              );
            })}
          </svg>
          <div className="pie-legend">
            {Object.entries(data).map(([key, value], index) => (
              <div key={key} className="legend-item">
                <div 
                  className="legend-color"
                  style={{ backgroundColor: `hsl(${index * 120}, 70%, 60%)` }}
                ></div>
                <span>{key}: {value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getQualityScoreColor = (score: number): string => {
    if (score >= 4.0) return '#48bb78';
    if (score >= 3.0) return '#ed8936';
    return '#e53e3e';
  };

  const getSeverityColor = (severity: 'low' | 'medium' | 'high'): string => {
    switch (severity) {
      case 'high': return '#e53e3e';
      case 'medium': return '#ed8936';
      case 'low': return '#38a169';
      default: return '#4a5568';
    }
  };

  if (error) {
    return (
      <div className="analytics-error">
        <p>{error}</p>
        <button onClick={fetchAnalytics}>Retry</button>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Loading enhanced analytics...</p>
      </div>
    );
  }

  const data = analyticsData;

  return (
    <div className="analytics-dashboard">
      {/* Header */}
      <header className="analytics-header">
        <div className="header-content">
          <div className="header-logo">
            <div className="logo-icon">🎙️</div>
            <span className="logo-text">Voice Matrix</span>
          </div>
          <div className="header-actions">
            <button onClick={() => navigate('/dashboard')} className="back-button">
              ← Back to Dashboard
            </button>
            <button onClick={onLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="analytics-controls">
        <div className="controls-content">
          <div className="timeframe-selector">
            <label>Time Period:</label>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              className="timeframe-select"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          <div className="tab-selector">
            <button 
              className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              📊 Overview
            </button>
            <button 
              className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
              onClick={() => setActiveTab('templates')}
            >
              🎯 Templates
            </button>
            <button 
              className={`tab-button ${activeTab === 'objectives' ? 'active' : ''}`}
              onClick={() => setActiveTab('objectives')}
            >
              ✅ Objectives
            </button>
            <button 
              className={`tab-button ${activeTab === 'calls' ? 'active' : ''}`}
              onClick={() => setActiveTab('calls')}
            >
              📞 Calls
            </button>
            <button 
              className={`tab-button ${activeTab === 'alerts' ? 'active' : ''}`}
              onClick={() => setActiveTab('alerts')}
            >
              🚨 Alerts
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="analytics-main">
        <div className="analytics-container">
          {activeTab === 'overview' && (
            <>
              {/* Enhanced Key Metrics */}
              <section className="metrics-section">
                <h2>Voice Matrix Overview</h2>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-icon">📞</div>
                    <div className="metric-content">
                      <h3>Total Calls</h3>
                      <p className="metric-value">{data.overview.totalCalls.toLocaleString()}</p>
                      <span className="metric-subtitle">
                        {timeframe === 'today' ? `${data.overview.totalCallsToday} today` : 
                         timeframe === 'week' ? `${data.overview.totalCallsWeek} this week` : 'This period'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-icon">⏱️</div>
                    <div className="metric-content">
                      <h3>Avg Duration</h3>
                      <p className="metric-value">{formatDuration(data.overview.averageCallDuration)}</p>
                      <span className="metric-subtitle">Per conversation</span>
                    </div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-icon">⭐</div>
                    <div className="metric-content">
                      <h3>Quality Score</h3>
                      <p className="metric-value" style={{ color: getQualityScoreColor(data.overview.averageQualityScore) }}>
                        {data.overview.averageQualityScore.toFixed(1)}/5.0
                      </p>
                      <span className="metric-subtitle">Average rating</span>
                    </div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-icon">✅</div>
                    <div className="metric-content">
                      <h3>Success Rate</h3>
                      <p className="metric-value">{formatPercentage(data.overview.overallSuccessRate)}</p>
                      <span className="metric-subtitle">Call completion</span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-icon">🤖</div>
                    <div className="metric-content">
                      <h3>Active Assistants</h3>
                      <p className="metric-value">{data.overview.activeAssistants}</p>
                      <span className="metric-subtitle">of {data.overview.totalAssistants} total</span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-icon">🚨</div>
                    <div className="metric-content">
                      <h3>Escalations</h3>
                      <p className="metric-value">{data.overview.totalEscalations}</p>
                      <span className="metric-subtitle">Human interventions</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Enhanced Charts */}
              <section className="charts-section">
                <div className="charts-grid">
                  <div className="chart-card">
                    {renderBarChart(data.trends.callVolumeByHour, "Call Volume by Hour")}
                  </div>
                  
                  <div className="chart-card">
                    {renderBarChart(data.trends.qualityTrends, "Quality Score Trends")}
                  </div>
                  
                  <div className="chart-card">
                    {renderBarChart(data.trends.escalationTrends, "Escalation Trends")}
                  </div>
                </div>
              </section>

              {/* Recent Alerts */}
              {data.alerts.length > 0 && (
                <section className="alerts-preview">
                  <h2>Recent Alerts</h2>
                  <div className="alerts-list">
                    {data.alerts.slice(0, 3).map((alert, index) => (
                      <div key={index} className={`alert-item severity-${alert.severity}`}>
                        <div className="alert-indicator" style={{ backgroundColor: getSeverityColor(alert.severity) }}></div>
                        <div className="alert-content">
                          <div className="alert-type">{alert.type.replace(/_/g, ' ').toUpperCase()}</div>
                          <div className="alert-message">{alert.message}</div>
                          <div className="alert-time">{new Date(alert.timestamp).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {activeTab === 'templates' && (
            <section className="template-analytics-section">
              <h2>Template Performance Analytics</h2>
              <div className="template-analytics-table">
                <div className="table-header">
                  <div className="header-cell">Template</div>
                  <div className="header-cell">Success Rate</div>
                  <div className="header-cell">Calls</div>
                  <div className="header-cell">Quality</div>
                  <div className="header-cell">Assistants</div>
                  <div className="header-cell">Escalations</div>
                  <div className="header-cell">Users</div>
                </div>
                {data.templateAnalytics.map((template) => (
                  <div key={template.templateId} className="table-row">
                    <div className="table-cell template-info">
                      <div className="template-name">{template.templateName}</div>
                      <div className="template-category">{template.category}</div>
                      {template.industry.length > 0 && (
                        <div className="template-industries">
                          {template.industry.slice(0, 2).join(', ')}
                          {template.industry.length > 2 && ` +${template.industry.length - 2}`}
                        </div>
                      )}
                    </div>
                    <div className="table-cell">
                      <span className={`success-rate ${template.successRate >= 0.8 ? 'high' : template.successRate >= 0.6 ? 'medium' : 'low'}`}>
                        {formatPercentage(template.successRate)}
                      </span>
                    </div>
                    <div className="table-cell">
                      <div className="call-stats">
                        <div className="total-calls">{template.totalCalls}</div>
                        <div className="call-breakdown">
                          {template.successfulCalls}✓ {template.failedCalls}✗
                        </div>
                      </div>
                    </div>
                    <div className="table-cell">
                      <span style={{ color: getQualityScoreColor(template.averageQualityScore) }}>
                        {template.averageQualityScore.toFixed(1)}/5.0
                      </span>
                    </div>
                    <div className="table-cell">
                      <div className="assistant-stats">
                        <div>{template.activeAssistants} active</div>
                        <div className="deployed">{template.deployedAssistants} deployed</div>
                      </div>
                    </div>
                    <div className="table-cell">
                      <span className={`escalation-rate ${template.escalationRate <= 0.1 ? 'low' : template.escalationRate <= 0.2 ? 'medium' : 'high'}`}>
                        {formatPercentage(template.escalationRate)}
                      </span>
                    </div>
                    <div className="table-cell">{template.uniqueUsers}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'objectives' && (
            <section className="objectives-section">
              <h2>Business Objectives Performance</h2>
              <div className="objectives-grid">
                {data.businessObjectives.map((objective, index) => (
                  <div key={objective.objective} className="objective-card">
                    <div className="objective-header">
                      <h3>{objective.objective}</h3>
                      <div className="objective-rank">#{index + 1}</div>
                    </div>
                    <div className="objective-metrics">
                      <div className="metric">
                        <span className="label">Achieved</span>
                        <span className="value">{objective.totalAchieved}</span>
                      </div>
                      <div className="metric">
                        <span className="label">Success Rate</span>
                        <span className="value">{formatPercentage(objective.successRate)}</span>
                      </div>
                    </div>
                    <div className="top-templates">
                      <h4>Top Templates</h4>
                      <div className="template-list">
                        {objective.topTemplates.slice(0, 3).map((template, idx) => (
                          <div key={idx} className="template-item">{template}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'calls' && (
            <section className="enhanced-call-logs-section">
              <h2>Enhanced Call Analytics</h2>
              <div className="enhanced-call-logs-table">
                <div className="table-header">
                  <div className="header-cell">Call Details</div>
                  <div className="header-cell">Template</div>
                  <div className="header-cell">Duration</div>
                  <div className="header-cell">Quality</div>
                  <div className="header-cell">Objectives</div>
                  <div className="header-cell">Status</div>
                </div>
                {callLogs.map((call) => (
                  <div key={call.callId} className="table-row">
                    <div className="table-cell call-details">
                      <div className="call-id">{call.callId.slice(-8)}</div>
                      <div className="call-time">{new Date(call.startTime).toLocaleString()}</div>
                      <div className="assistant-name">{call.assistantName}</div>
                    </div>
                    <div className="table-cell">
                      <div className="template-name">{call.templateName}</div>
                    </div>
                    <div className="table-cell">{formatDuration(call.duration)}</div>
                    <div className="table-cell">
                      <span style={{ color: getQualityScoreColor(call.qualityScore) }}>
                        {call.qualityScore.toFixed(1)}/5.0
                      </span>
                    </div>
                    <div className="table-cell objectives-achieved">
                      {call.objectivesAchieved.length > 0 ? (
                        <div className="objectives-list">
                          {call.objectivesAchieved.slice(0, 2).map((obj, idx) => (
                            <span key={idx} className="objective-badge">{obj}</span>
                          ))}
                          {call.objectivesAchieved.length > 2 && (
                            <span className="more-objectives">+{call.objectivesAchieved.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span className="no-objectives">None</span>
                      )}
                    </div>
                    <div className="table-cell">
                      <div className="call-status-container">
                        <span className={`status-badge ${call.status}`}>{call.status}</span>
                        {call.escalated && <span className="escalation-badge">🚨 Escalated</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'alerts' && (
            <section className="alerts-section">
              <h2>System Alerts & Notifications</h2>
              <div className="alerts-container">
                {data.alerts.length === 0 ? (
                  <div className="no-alerts">
                    <div className="no-alerts-icon">✅</div>
                    <h3>All Systems Operational</h3>
                    <p>No alerts or issues detected in your Voice Matrix system.</p>
                  </div>
                ) : (
                  <div className="alerts-list">
                    {data.alerts.map((alert, index) => (
                      <div key={index} className={`alert-card severity-${alert.severity}`}>
                        <div className="alert-header">
                          <div className="alert-severity">
                            <span className={`severity-indicator ${alert.severity}`}>
                              {alert.severity === 'high' ? '🔴' : alert.severity === 'medium' ? '🟡' : '🟢'}
                            </span>
                            <span className="severity-text">{alert.severity.toUpperCase()}</span>
                          </div>
                          <div className="alert-timestamp">
                            {new Date(alert.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="alert-body">
                          <h4>{alert.type.replace(/_/g, ' ').toUpperCase()}</h4>
                          <p>{alert.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Real-time Status Footer */}
      <footer className="dashboard-footer">
        <div className="footer-content">
          <div className="status-indicator">
            <div className="status-dot active"></div>
            <span>Live Analytics • Auto-refresh every 30s</span>
          </div>
          <div className="system-status">
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
            {data.alerts.length > 0 && (
              <span className="alert-count">
                {data.alerts.filter(a => a.severity === 'high').length} critical alerts
              </span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AnalyticsDashboard;