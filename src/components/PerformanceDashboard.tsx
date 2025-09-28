import React, { useState, useEffect } from 'react';
import { performanceMonitor, PerformanceMetrics } from '../utils/performanceMonitor';
import { useTranslation } from 'react-i18next';
import PerformanceStatistics from './PerformanceStatistics';

interface PerformanceDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ isVisible, onClose }) => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});
  const [score, setScore] = useState<number>(0);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [showStatistics, setShowStatistics] = useState<boolean>(false);

  useEffect(() => {
    if (isVisible) {
      const currentMetrics = performanceMonitor.getMetrics();
      const currentScore = performanceMonitor.getPerformanceScore();
      const currentRecommendations = performanceMonitor.getPerformanceRecommendations();
      
      setMetrics(currentMetrics);
      setScore(currentScore);
      setRecommendations(currentRecommendations);
    }
  }, [isVisible]);

  const formatMetric = (value: number | undefined, unit: string = 'ms'): string => {
    if (value === undefined) return 'N/A';
    return `${value.toFixed(2)}${unit}`;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return '#4CAF50'; // Green
    if (score >= 70) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getMetricColor = (value: number | undefined, thresholds: { good: number; poor: number }): string => {
    if (value === undefined) return '#9E9E9E'; // Gray
    if (value <= thresholds.good) return '#4CAF50'; // Green
    if (value <= thresholds.poor) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  if (!isVisible) return null;

  return (
    <div className="performance-dashboard-overlay">
      <div className="performance-dashboard">
        <div className="performance-dashboard-header">
          <h2>🚀 Performance Dashboard</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="performance-dashboard-content">
          {/* Overall Score */}
          <div className="performance-score-section">
            <div className="score-circle" style={{ borderColor: getScoreColor(score) }}>
              <span className="score-value" style={{ color: getScoreColor(score) }}>
                {score}
              </span>
              <span className="score-label">Performance Score</span>
            </div>
          </div>

          {/* Core Web Vitals */}
          <div className="metrics-section">
            <h3>📊 Core Web Vitals</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">First Contentful Paint</div>
                <div 
                  className="metric-value" 
                  style={{ color: getMetricColor(metrics.fcp, { good: 1800, poor: 3000 }) }}
                >
                  {formatMetric(metrics.fcp)}
                </div>
                <div className="metric-description">Time to first content</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Largest Contentful Paint</div>
                <div 
                  className="metric-value" 
                  style={{ color: getMetricColor(metrics.lcp, { good: 2500, poor: 4000 }) }}
                >
                  {formatMetric(metrics.lcp)}
                </div>
                <div className="metric-description">Time to largest content</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">First Input Delay</div>
                <div 
                  className="metric-value" 
                  style={{ color: getMetricColor(metrics.fid, { good: 100, poor: 300 }) }}
                >
                  {formatMetric(metrics.fid)}
                </div>
                <div className="metric-description">Time to first interaction</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Cumulative Layout Shift</div>
                <div 
                  className="metric-value" 
                  style={{ color: getMetricColor(metrics.cls, { good: 0.1, poor: 0.25 }) }}
                >
                  {formatMetric(metrics.cls, '')}
                </div>
                <div className="metric-description">Visual stability</div>
              </div>
            </div>
          </div>

          {/* Custom Metrics */}
          <div className="metrics-section">
            <h3>⚡ Custom Metrics</h3>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Page Load Time</div>
                <div 
                  className="metric-value" 
                  style={{ color: getMetricColor(metrics.pageLoadTime, { good: 3000, poor: 5000 }) }}
                >
                  {formatMetric(metrics.pageLoadTime)}
                </div>
                <div className="metric-description">Total page load time</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">API Response Time</div>
                <div 
                  className="metric-value" 
                  style={{ color: getMetricColor(metrics.apiResponseTime, { good: 500, poor: 1000 }) }}
                >
                  {formatMetric(metrics.apiResponseTime)}
                </div>
                <div className="metric-description">Average API response</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Component Render Time</div>
                <div 
                  className="metric-value" 
                  style={{ color: getMetricColor(metrics.componentRenderTime, { good: 16, poor: 50 }) }}
                >
                  {formatMetric(metrics.componentRenderTime)}
                </div>
                <div className="metric-description">React component render</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">User Interaction Time</div>
                <div 
                  className="metric-value" 
                  style={{ color: getMetricColor(metrics.userInteractionTime, { good: 100, poor: 300 }) }}
                >
                  {formatMetric(metrics.userInteractionTime)}
                </div>
                <div className="metric-description">Time to respond to user</div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="recommendations-section">
              <h3>💡 Performance Recommendations</h3>
              <ul className="recommendations-list">
                {recommendations.map((recommendation, index) => (
                  <li key={index} className="recommendation-item">
                    {recommendation}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="performance-actions">
            <button 
              className="action-button primary"
              onClick={() => {
                performanceMonitor.sendReport();
                alert('Performance report sent and stored successfully!');
              }}
            >
              📊 Send Report
            </button>
            <button 
              className="action-button secondary"
              onClick={() => setShowStatistics(true)}
            >
              📋 View Statistics
            </button>
            <button 
              className="action-button secondary"
              onClick={() => {
                performanceMonitor.startSession();
                alert('New performance monitoring session started');
              }}
            >
              🔄 Restart Session
            </button>
          </div>
        </div>
      </div>
      
      {/* Statistics Modal */}
      <PerformanceStatistics 
        isVisible={showStatistics}
        onClose={() => setShowStatistics(false)}
      />
    </div>
  );
};

export default PerformanceDashboard;
