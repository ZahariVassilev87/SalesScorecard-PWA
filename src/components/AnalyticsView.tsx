import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService, Evaluation } from '../services/api';
import { useTranslation } from 'react-i18next';

const AnalyticsView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [teamAnalytics, setTeamAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const [evaluationsData, teamData] = await Promise.all([
          apiService.getMyEvaluations(),
          apiService.getTeamAnalytics()
        ]);
        setEvaluations(evaluationsData);
        setTeamAnalytics(teamData);
      } catch (err) {
        setError(t('analytics.loading'));
        console.error('Failed to load analytics:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [t]);

  const calculateAverageScore = () => {
    if (evaluations.length === 0) return 0;
    const totalScore = evaluations.reduce((sum, evaluation) => sum + (evaluation.overallScore || 0), 0);
    return totalScore / evaluations.length;
  };

  const getScoreDistribution = () => {
    const distribution = { excellent: 0, good: 0, average: 0, poor: 0 };
    
    evaluations.forEach(evaluation => {
      const score = evaluation.overallScore || 0;
      if (score >= 4.5) distribution.excellent++;
      else if (score >= 3.5) distribution.good++;
      else if (score >= 2.5) distribution.average++;
      else distribution.poor++;
    });

    return distribution;
  };

  const getRecentTrend = () => {
    if (evaluations.length < 2) return 'insufficient_data';
    
    const recent = evaluations.slice(0, 3);
    const older = evaluations.slice(3, 6);
    
    const recentAvg = recent.reduce((sum, evaluation) => sum + (evaluation.overallScore || 0), 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((sum, evaluation) => sum + (evaluation.overallScore || 0), 0) / older.length : recentAvg;
    
    if (recentAvg > olderAvg + 0.2) return 'improving';
    if (recentAvg < olderAvg - 0.2) return 'declining';
    return 'stable';
  };

  if (isLoading) {
    return (
      <div className="analytics-view">
        <div className="loading">{t('analytics.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-view">
        <div className="error">{error}</div>
      </div>
    );
  }

  const averageScore = calculateAverageScore();
  const distribution = getScoreDistribution();
  const trend = getRecentTrend();

  return (
    <div className="analytics-view">
      <div className="analytics-header">
        <h2>
          {user?.role === 'SALESPERSON' ? t('analytics.myPerformanceTitle') : t('analytics.title')}
        </h2>
        <p>{t('analytics.subtitle')}</p>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="card-header">
            <h3>{t('analytics.overallPerformance')}</h3>
            <span className="card-icon">📊</span>
          </div>
          <div className="card-content">
            <div className="score-display">
              <span className="score-value">{averageScore.toFixed(1)}</span>
              <span className="score-label">{t('analytics.averageScore')}</span>
            </div>
            <div className="score-trend">
              <span className={`trend-indicator ${trend}`}>
                {trend === 'improving' && t('analytics.improving')}
                {trend === 'declining' && t('analytics.declining')}
                {trend === 'stable' && t('analytics.stable')}
                {trend === 'insufficient_data' && t('analytics.insufficientData')}
              </span>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <div className="card-header">
            <h3>{t('analytics.evaluationCount')}</h3>
            <span className="card-icon">📋</span>
          </div>
          <div className="card-content">
            <div className="count-display">
              <span className="count-value">{evaluations.length}</span>
              <span className="count-label">{t('analytics.totalEvaluations')}</span>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <div className="card-header">
            <h3>{t('analytics.scoreDistribution')}</h3>
            <span className="card-icon">🎯</span>
          </div>
          <div className="card-content">
            <div className="distribution">
              <div className="distribution-item">
                <span className="distribution-label">{t('analytics.excellent')}</span>
                <span className="distribution-value">{distribution.excellent}</span>
              </div>
              <div className="distribution-item">
                <span className="distribution-label">{t('analytics.good')}</span>
                <span className="distribution-value">{distribution.good}</span>
              </div>
              <div className="distribution-item">
                <span className="distribution-label">{t('analytics.average')}</span>
                <span className="distribution-value">{distribution.average}</span>
              </div>
              <div className="distribution-item">
                <span className="distribution-label">{t('analytics.poor')}</span>
                <span className="distribution-value">{distribution.poor}</span>
              </div>
            </div>
          </div>
        </div>

        {teamAnalytics && (
          <div className="analytics-card">
            <div className="card-header">
              <h3>{t('analytics.teamPerformance')}</h3>
              <span className="card-icon">👥</span>
            </div>
            <div className="card-content">
              <div className="team-stats">
                <div className="stat-item">
                  <span className="stat-label">{t('analytics.teamAverage')}</span>
                  <span className="stat-value">{teamAnalytics.teamPerformance.average}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t('analytics.topPerformers')}</span>
                  <span className="stat-value">{teamAnalytics.teamPerformance.topPerformers}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">{t('analytics.needsImprovement')}</span>
                  <span className="stat-value">{teamAnalytics.teamPerformance.needsImprovement}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="analytics-card">
          <div className="card-header">
            <h3>{t('analytics.recentEvaluations')}</h3>
            <span className="card-icon">🕒</span>
          </div>
          <div className="card-content">
            <div className="recent-evaluations">
              {evaluations.slice(0, 3).map(evaluation => (
                <div key={evaluation.id} className="recent-evaluation">
                  <div className="evaluation-info">
                    <span className="evaluation-date">
                      {new Date(evaluation.visitDate).toLocaleDateString()}
                    </span>
                    <span className="evaluation-score">
                      {evaluation.overallScore?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                  {evaluation.customerName && (
                    <span className="evaluation-customer">{evaluation.customerName}</span>
                  )}
                </div>
              ))}
              {evaluations.length === 0 && (
                <div className="no-data">{t('analytics.noEvaluations')}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsView;
