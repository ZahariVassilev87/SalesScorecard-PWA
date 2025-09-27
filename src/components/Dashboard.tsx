import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { useTranslation } from 'react-i18next';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [evaluationData, setEvaluationData] = useState<any>(null);
  const [directorateData, setDirectorateData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (user?.role === 'SALES_DIRECTOR') {
          // Load directorate-wide data for Sales Directors
          const data = await apiService.getDirectorateData();
          setDirectorateData(data);
        } else {
          // Load evaluation data for other roles
          const data = await apiService.getMyEvaluations();
          
          // Calculate metrics from evaluation data
          const metrics = {
            totalEvaluations: data.length,
            averageScore: data.length > 0 ? 
              (data.reduce((sum, evaluation) => {
                const avgScore = evaluation.items.reduce((itemSum, item) => itemSum + item.rating, 0) / evaluation.items.length;
                return sum + avgScore;
              }, 0) / data.length).toFixed(1) : 0,
            totalScore: data.reduce((sum, evaluation) => {
              return sum + evaluation.items.reduce((itemSum, item) => itemSum + item.rating, 0);
            }, 0),
            thisMonth: data.filter(evaluation => {
              const evalDate = new Date(evaluation.visitDate);
              const now = new Date();
              return evalDate.getMonth() === now.getMonth() && evalDate.getFullYear() === now.getFullYear();
            }).length
          };
          
          setEvaluationData(metrics);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.role]);

  const getRoleDisplayName = (role: string) => {
    return t(`roles.${role}`) || role;
  };

  const isSalesDirector = user?.role === 'SALES_DIRECTOR';

  if (isLoading) {
    return (
      <div className="dashboard">
        <div className="loading">{t('dashboard.loading')}</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="welcome-section">
        <h2>{t('dashboard.welcome', { name: user?.displayName })}</h2>
        <p className="role-badge">{getRoleDisplayName(user?.role || '')}</p>
      </div>

      {isSalesDirector ? (
        // Sales Director Dashboard - Directorate-wide data
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">🏢</div>
            <div className="card-value">{directorateData?.totalRegions || 0}</div>
            <div className="card-label">{t('dashboard.totalRegions')}</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">👥</div>
            <div className="card-value">{directorateData?.totalTeamMembers || 0}</div>
            <div className="card-label">{t('dashboard.totalTeamMembers')}</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📊</div>
            <div className="card-value">{directorateData?.averagePerformance || 0}%</div>
            <div className="card-label">{t('dashboard.averagePerformance')}</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📋</div>
            <div className="card-value">{directorateData?.totalEvaluations || 0}</div>
            <div className="card-label">{t('dashboard.totalEvaluations')}</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📈</div>
            <div className="card-value">{directorateData?.evaluationsCompleted || 0}</div>
            <div className="card-label">{t('dashboard.evaluationsCompleted')}</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">⭐</div>
            <div className="card-value">{directorateData?.averageScore || 0}</div>
            <div className="card-label">{t('dashboard.averageScore')}</div>
          </div>
        </div>
      ) : (
        // Regular Dashboard for other roles - Evaluation Results
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">📋</div>
            <div className="card-value">{evaluationData?.totalEvaluations || 0}</div>
            <div className="card-label">{t('dashboard.myEvaluations')}</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">⭐</div>
            <div className="card-value">{evaluationData?.averageScore || 0}</div>
            <div className="card-label">{t('dashboard.averageScore')}</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📊</div>
            <div className="card-value">{evaluationData?.totalScore || 0}</div>
            <div className="card-label">{t('dashboard.totalScore')}</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📈</div>
            <div className="card-value">{evaluationData?.thisMonth || 0}</div>
            <div className="card-label">{t('dashboard.thisMonth')}</div>
          </div>
        </div>
      )}

      {!isSalesDirector && (
        <div className="quick-actions">
          <h3>{t('dashboard.quickActions')}</h3>
          <div className="actions-grid">
            <div className="action-card">
              <div className="action-icon">👥</div>
              <div className="action-label">{t('dashboard.viewTeam')}</div>
            </div>
            <div className="action-card">
              <div className="action-icon">📋</div>
              <div className="action-label">{t('dashboard.reports')}</div>
            </div>
            <div className="action-card">
              <div className="action-icon">⚙️</div>
              <div className="action-label">{t('dashboard.settings')}</div>
            </div>
            <div className="action-card">
              <div className="action-icon">📞</div>
              <div className="action-label">{t('dashboard.support')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
