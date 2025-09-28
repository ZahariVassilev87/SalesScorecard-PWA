import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { performanceAnalytics, PerformanceStats, PerformanceAlert } from '../services/performanceAnalytics';

interface PerformanceStatisticsProps {
  isVisible: boolean;
  onClose: () => void;
}

const PerformanceStatistics: React.FC<PerformanceStatisticsProps> = ({ isVisible, onClose }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'alerts' | 'reports'>('overview');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVisible) {
      loadStatistics();
    }
  }, [isVisible]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const statistics = performanceAnalytics.generateStats();
      const performanceAlerts = performanceAnalytics.getStoredAlerts();
      setStats(statistics);
      setAlerts(performanceAlerts);
    } catch (error) {
      console.error('Failed to load performance statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    const reportData = performanceAnalytics.generateDownloadableReport();
    const blob = new Blob([reportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportData = () => {
    const data = performanceAnalytics.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-data-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearData = () => {
    if (window.confirm('Are you sure you want to clear all performance data? This action cannot be undone.')) {
      performanceAnalytics.clearAllData();
      loadStatistics();
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return '#4CAF50';
    if (score >= 70) return '#FF9800';
    return '#F44336';
  };

  const getAlertTypeColor = (type: string): string => {
    switch (type) {
      case 'error': return '#F44336';
      case 'warning': return '#FF9800';
      case 'info': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  if (!isVisible) return null;

  return (
    <div className="performance-statistics-overlay">
      <div className="performance-statistics">
        <div className="performance-statistics-header">
          <h2>📊 Performance Statistics</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="performance-statistics-content">
          {/* Tab Navigation */}
          <div className="stats-tabs">
            <button 
              className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              📈 Overview
            </button>
            <button 
              className={`tab-button ${activeTab === 'trends' ? 'active' : ''}`}
              onClick={() => setActiveTab('trends')}
            >
              📊 Trends
            </button>
            <button 
              className={`tab-button ${activeTab === 'alerts' ? 'active' : ''}`}
              onClick={() => setActiveTab('alerts')}
            >
              🚨 Alerts ({alerts.filter(a => !a.resolved).length})
            </button>
            <button 
              className={`tab-button ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              📋 Reports
            </button>
          </div>

          {loading ? (
            <div className="loading-spinner">Loading statistics...</div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && stats && (
                <div className="stats-overview">
                  <div className="stats-summary">
                    <div className="stat-card">
                      <div className="stat-value" style={{ color: getScoreColor(stats.averageScore) }}>
                        {stats.averageScore.toFixed(1)}
                      </div>
                      <div className="stat-label">Average Score</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{stats.totalSessions}</div>
                      <div className="stat-label">Total Sessions</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{alerts.filter(a => !a.resolved).length}</div>
                      <div className="stat-label">Active Alerts</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">
                        {new Date(stats.lastUpdated).toLocaleDateString()}
                      </div>
                      <div className="stat-label">Last Updated</div>
                    </div>
                  </div>

                  {/* Score Distribution */}
                  <div className="score-distribution">
                    <h3>Score Distribution</h3>
                    <div className="distribution-chart">
                      {Object.entries(stats.scoreDistribution).map(([range, count]) => (
                        <div key={range} className="distribution-bar">
                          <div className="bar-label">{range}</div>
                          <div className="bar-container">
                            <div 
                              className="bar-fill" 
                              style={{ 
                                width: `${(count / stats.totalSessions) * 100}%`,
                                backgroundColor: getScoreColor(parseInt(range.split('-')[0]))
                              }}
                            />
                          </div>
                          <div className="bar-count">{count}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Issues */}
                  {stats.topIssues.length > 0 && (
                    <div className="top-issues">
                      <h3>Top Performance Issues</h3>
                      <div className="issues-list">
                        {stats.topIssues.map((issue, index) => (
                          <div key={index} className="issue-item">
                            <div className="issue-metric">{issue.metric.toUpperCase()}</div>
                            <div className="issue-count">{issue.count} occurrences</div>
                            <div className={`issue-severity ${issue.severity}`}>
                              {issue.severity}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trends Tab */}
              {activeTab === 'trends' && stats && (
                <div className="stats-trends">
                  <h3>Performance Trends (Last 30 Days)</h3>
                  {stats.trends.length > 0 ? (
                    <div className="trends-chart">
                      {stats.trends.map((trend, index) => (
                        <div key={index} className="trend-point">
                          <div className="trend-date">{trend.date}</div>
                          <div 
                            className="trend-score"
                            style={{ color: getScoreColor(trend.score) }}
                          >
                            {trend.score.toFixed(0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-data">No trend data available</div>
                  )}
                </div>
              )}

              {/* Alerts Tab */}
              {activeTab === 'alerts' && (
                <div className="stats-alerts">
                  <h3>Performance Alerts</h3>
                  {alerts.length > 0 ? (
                    <div className="alerts-list">
                      {alerts.map((alert) => (
                        <div key={alert.id} className={`alert-item ${alert.type} ${alert.resolved ? 'resolved' : ''}`}>
                          <div className="alert-header">
                            <div className="alert-type" style={{ color: getAlertTypeColor(alert.type) }}>
                              {alert.type.toUpperCase()}
                            </div>
                            <div className="alert-time">{formatDate(alert.timestamp)}</div>
                          </div>
                          <div className="alert-message">{alert.message}</div>
                          <div className="alert-details">
                            <span>Metric: {alert.metric}</span>
                            <span>Value: {alert.value.toFixed(2)}</span>
                            <span>Threshold: {alert.threshold}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-data">No alerts found</div>
                  )}
                </div>
              )}

              {/* Reports Tab */}
              {activeTab === 'reports' && (
                <div className="stats-reports">
                  <h3>Report Actions</h3>
                  <div className="report-actions">
                    <button className="action-button primary" onClick={downloadReport}>
                      📊 Download Report
                    </button>
                    <button className="action-button secondary" onClick={exportData}>
                      💾 Export All Data
                    </button>
                    <button className="action-button danger" onClick={clearData}>
                      🗑️ Clear All Data
                    </button>
                  </div>
                  
                  <div className="report-info">
                    <h4>Report Information</h4>
                    <ul>
                      <li>Total Sessions: {stats?.totalSessions || 0}</li>
                      <li>Average Score: {stats?.averageScore.toFixed(1) || 'N/A'}</li>
                      <li>Active Alerts: {alerts.filter(a => !a.resolved).length}</li>
                      <li>Data Range: Last 30 days</li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceStatistics;
