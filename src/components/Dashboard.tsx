import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
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
                const avgScore = evaluation.items.reduce((itemSum, item) => itemSum + item.score, 0) / evaluation.items.length;
                return sum + avgScore;
              }, 0) / data.length).toFixed(1) : 0,
            totalScore: data.reduce((sum, evaluation) => {
              return sum + evaluation.items.reduce((itemSum, item) => itemSum + item.score, 0);
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
    switch (role) {
      case 'SALES_DIRECTOR': return 'Sales Director';
      case 'REGIONAL_SALES_MANAGER': return 'Regional Manager';
      case 'SALES_LEAD': return 'Sales Lead';
      case 'SALESPERSON': return 'Salesperson';
      case 'ADMIN': return 'Administrator';
      default: return role;
    }
  };

  const isSalesDirector = user?.role === 'SALES_DIRECTOR';

  if (isLoading) {
    return (
      <div className="dashboard">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="welcome-section">
        <h2>Welcome back, {user?.displayName}!</h2>
        <p className="role-badge">{getRoleDisplayName(user?.role || '')}</p>
      </div>

      {isSalesDirector ? (
        // Sales Director Dashboard - Directorate-wide data
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">🏢</div>
            <div className="card-value">{directorateData?.totalRegions || 0}</div>
            <div className="card-label">Total Regions</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">👥</div>
            <div className="card-value">{directorateData?.totalTeamMembers || 0}</div>
            <div className="card-label">Total Team Members</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📊</div>
            <div className="card-value">{directorateData?.averagePerformance || 0}%</div>
            <div className="card-label">Average Performance</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📋</div>
            <div className="card-value">{directorateData?.totalEvaluations || 0}</div>
            <div className="card-label">Total Evaluations</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📈</div>
            <div className="card-value">{directorateData?.evaluationsCompleted || 0}</div>
            <div className="card-label">Evaluations Completed</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">⭐</div>
            <div className="card-value">{directorateData?.averageScore || 0}</div>
            <div className="card-label">Average Score</div>
          </div>
        </div>
      ) : (
        // Regular Dashboard for other roles - Evaluation Results
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">📋</div>
            <div className="card-value">{evaluationData?.totalEvaluations || 0}</div>
            <div className="card-label">My Evaluations</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">⭐</div>
            <div className="card-value">{evaluationData?.averageScore || 0}</div>
            <div className="card-label">Average Score</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📊</div>
            <div className="card-value">{evaluationData?.totalScore || 0}</div>
            <div className="card-label">Total Score</div>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📈</div>
            <div className="card-value">{evaluationData?.thisMonth || 0}</div>
            <div className="card-label">This Month</div>
          </div>
        </div>
      )}

      {!isSalesDirector && (
        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <div className="actions-grid">
            <div className="action-card">
              <div className="action-icon">👥</div>
              <div className="action-label">View Team</div>
            </div>
            <div className="action-card">
              <div className="action-icon">📋</div>
              <div className="action-label">Reports</div>
            </div>
            <div className="action-card">
              <div className="action-icon">⚙️</div>
              <div className="action-label">Settings</div>
            </div>
            <div className="action-card">
              <div className="action-icon">📞</div>
              <div className="action-label">Support</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
