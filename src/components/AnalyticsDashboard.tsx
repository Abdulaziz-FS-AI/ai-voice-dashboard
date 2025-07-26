import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AnalyticsDashboard.css';

interface AnalyticsDashboardProps {
  user: any;
  token: string;
  onLogout: () => void;
}

interface AnalyticsData {
  metrics: {
    totalCalls: number;
    totalDuration: number;
    averageDuration: number;
    successRate: number;
    transferRate: number;
    costTotal: number;
    sentimentDistribution: {
      positive: number;
      neutral: number;
      negative: number;
    };
    callsBy: {
      hour: Record<string, number>;
      day: Record<string, number>;
      week: Record<string, number>;
    };
    topPerformers: Array<{
      assistantId: string;
      assistantName: string;
      callCount: number;
      successRate: number;
      avgDuration: number;
    }>;
  };
  timeframe: string;
  generatedAt: string;
}

interface CallLog {
  id: string;
  callerNumber: string;
  startTime: string;
  endTime: string;
  duration: number;
  outcome: string;
  sentiment: string;
  summary: string;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ user, token, onLogout }) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeframe, setTimeframe] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  const navigate = useNavigate();
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-api-gateway-url.com';

  useEffect(() => {
    fetchAnalytics();
    if (activeTab === 'calls') {
      fetchCallLogs();
    }
  }, [timeframe, activeTab]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/overview?timeframe=${timeframe}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      } else {
        setError('Failed to load analytics');
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Network error loading analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCallLogs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics/calls?limit=20`, {
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
      console.error('Error loading call logs:', err);
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

  if (error) {
    return (
      <div className="analytics-error">
        <p>{error}</p>
        <button onClick={fetchAnalytics}>Retry</button>
      </div>
    );
  }

  const data = analyticsData!;

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
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
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
              className={`tab-button ${activeTab === 'calls' ? 'active' : ''}`}
              onClick={() => setActiveTab('calls')}
            >
              📞 Call Logs
            </button>
            <button 
              className={`tab-button ${activeTab === 'performance' ? 'active' : ''}`}
              onClick={() => setActiveTab('performance')}
            >
              🎯 Performance
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="analytics-main">
        <div className="analytics-container">
          {activeTab === 'overview' && (
            <>
              {/* Key Metrics */}
              <section className="metrics-section">
                <h2>Key Metrics</h2>
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-icon">📞</div>
                    <div className="metric-content">
                      <h3>Total Calls</h3>
                      <p className="metric-value">{data.metrics.totalCalls.toLocaleString()}</p>
                      <span className="metric-change">+12% from last period</span>
                    </div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-icon">⏱️</div>
                    <div className="metric-content">
                      <h3>Avg Duration</h3>
                      <p className="metric-value">{formatDuration(data.metrics.averageDuration)}</p>
                      <span className="metric-change">+5% from last period</span>
                    </div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-icon">✅</div>
                    <div className="metric-content">
                      <h3>Success Rate</h3>
                      <p className="metric-value">{data.metrics.successRate}%</p>
                      <span className="metric-change positive">+3% from last period</span>
                    </div>
                  </div>
                  
                  <div className="metric-card">
                    <div className="metric-icon">💰</div>
                    <div className="metric-content">
                      <h3>Total Cost</h3>
                      <p className="metric-value">{formatCurrency(data.metrics.costTotal)}</p>
                      <span className="metric-change">This period</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Charts */}
              <section className="charts-section">
                <div className="charts-grid">
                  <div className="chart-card">
                    {renderBarChart(data.metrics.callsBy.day, "Daily Call Volume")}
                  </div>
                  
                  <div className="chart-card">
                    {renderPieChart(data.metrics.sentimentDistribution, "Call Sentiment")}
                  </div>
                  
                  <div className="chart-card">
                    {renderBarChart(data.metrics.callsBy.hour, "Calls by Hour")}
                  </div>
                </div>
              </section>

              {/* Top Performers */}
              <section className="performers-section">
                <h2>Top Performing Assistants</h2>
                <div className="performers-list">
                  {data.metrics.topPerformers.map((performer, index) => (
                    <div key={performer.assistantId} className="performer-card">
                      <div className="performer-rank">#{index + 1}</div>
                      <div className="performer-content">
                        <h3>{performer.assistantName}</h3>
                        <div className="performer-stats">
                          <span>Calls: {performer.callCount}</span>
                          <span>Success: {performer.successRate}%</span>
                          <span>Avg Duration: {formatDuration(performer.avgDuration)}</span>
                        </div>
                      </div>
                      <div className="performer-score">
                        <div className="score-circle">
                          {performer.successRate}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {activeTab === 'calls' && (
            <section className="call-logs-section">
              <h2>Recent Call Logs</h2>
              <div className="call-logs-table">
                <div className="table-header">
                  <div className="header-cell">Caller</div>
                  <div className="header-cell">Time</div>
                  <div className="header-cell">Duration</div>
                  <div className="header-cell">Outcome</div>
                  <div className="header-cell">Sentiment</div>
                  <div className="header-cell">Summary</div>
                </div>
                {callLogs.map((call) => (
                  <div key={call.id} className="table-row">
                    <div className="table-cell">{call.callerNumber}</div>
                    <div className="table-cell">
                      {new Date(call.startTime).toLocaleString()}
                    </div>
                    <div className="table-cell">{formatDuration(call.duration)}</div>
                    <div className="table-cell">
                      <span className={`outcome-badge ${call.outcome}`}>
                        {call.outcome}
                      </span>
                    </div>
                    <div className="table-cell">
                      <span className={`sentiment-badge ${call.sentiment}`}>
                        {call.sentiment}
                      </span>
                    </div>
                    <div className="table-cell summary-cell">{call.summary}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'performance' && (
            <section className="performance-section">
              <h2>Performance Analysis</h2>
              <div className="performance-grid">
                <div className="performance-card">
                  <h3>Call Success Trends</h3>
                  <div className="trend-chart">
                    <div className="trend-line"></div>
                    <p>Success rate improved by 8% over the last 30 days</p>
                  </div>
                </div>
                
                <div className="performance-card">
                  <h3>Cost Efficiency</h3>
                  <div className="efficiency-metrics">
                    <div className="efficiency-item">
                      <span>Cost per Call</span>
                      <span>${(data.metrics.costTotal / 100 / data.metrics.totalCalls).toFixed(2)}</span>
                    </div>
                    <div className="efficiency-item">
                      <span>Cost per Minute</span>
                      <span>${(data.metrics.costTotal / 100 / (data.metrics.totalDuration / 60)).toFixed(3)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="performance-card">
                  <h3>Peak Usage</h3>
                  <div className="peak-usage">
                    <p>Busiest Hour: 2:00 PM - 3:00 PM</p>
                    <p>Busiest Day: Wednesday</p>
                    <p>Average Response Time: 1.2 seconds</p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default AnalyticsDashboard;