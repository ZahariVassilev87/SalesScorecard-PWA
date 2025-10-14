import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

interface DirectorDashboardData {
  // Regional execution performance (salespeople evaluations by sales leads)
  regionalExecutionPerformance: Array<{
    regionId: string;
    regionName: string;
    executionEvaluations: number;
    avgExecutionScore: number;
    uniqueSalespeopleEvaluated: number;
    uniqueSalesLeadsEvaluating: number;
  }>;
  
  // Regional coaching performance (sales leads evaluations by regional managers)
  regionalCoachingPerformance: Array<{
    regionId: string;
    regionName: string;
    coachingEvaluations: number;
    avgCoachingScore: number;
    uniqueSalesLeadsEvaluated: number;
    uniqueRegionalManagersEvaluating: number;
  }>;
  
  // Salespeople execution performance (by sales lead)
  salespeopleExecutionPerformance: Array<{
    salesLeadId: string;
    salesLeadName: string;
    salesLeadEmail: string;
    executionEvaluationsCreated: number;
    avgExecutionScore: number;
    regionId: string;
    regionName: string;
  }>;
  
  // Sales lead coaching performance (of sales leads by regional managers)
  salesLeadCoachingPerformance: Array<{
    salesLeadId: string;
    salesLeadName: string;
    salesLeadEmail: string;
    regionalManagerId: string;
    regionalManagerName: string;
    coachingEvaluationsReceived: number;
    avgCoachingScore: number;
    regionId: string;
    regionName: string;
  }>;
  
  // Company execution metrics (salespeople evaluations)
  companyExecutionMetrics: {
    totalExecutionEvaluations: number;
    avgExecutionScore: number;
    totalSalespeopleEvaluated: number;
    totalSalesLeadsEvaluating: number;
  } | null;
  
  // Company coaching metrics (sales leads evaluations)
  companyCoachingMetrics: {
    totalCoachingEvaluations: number;
    avgCoachingScore: number;
    totalSalesLeadsEvaluated: number;
    totalRegionalManagersEvaluating: number;
  } | null;
  
  // User counts
  userCounts: {
    totalSalesLeads: number;
    totalRegionalManagers: number;
    totalSalespeople: number;
  } | null;
  
  // Share of Wallet distribution
  shareOfWalletDistribution: Array<{
    customerType: string;
    evaluationCount: number;
    avgScore: number;
    percentage: number;
  }>;
  
  // Execution trends (salespeople evaluations)
  executionTrends: Array<{
    date: string;
    evaluationsCount: number;
    avgScore: number;
  }>;
  
  // Coaching trends (sales leads evaluations)
  coachingTrends: Array<{
    date: string;
    evaluationsCount: number;
    avgScore: number;
  }>;

  // Regional execution metrics (regional managers performance in sales behaviours)
  regionalExecutionMetrics: Array<{
    regionalManagerId: string;
    regionalManagerName: string;
    regionalManagerEmail: string;
    regionId: string;
    regionName: string;
    executionEvaluations: number;
    avgExecutionScore: number;
    uniqueSalespeopleEvaluated: number;
    uniqueSalesLeadsEvaluating: number;
  }>;

  // Regional coaching metrics (regional managers performance in coaching)
  regionalCoachingMetrics: Array<{
    regionalManagerId: string;
    regionalManagerName: string;
    regionalManagerEmail: string;
    regionId: string;
    regionName: string;
    coachingEvaluations: number;
    avgCoachingScore: number;
    uniqueSalesLeadsEvaluated: number;
  }>;
}

const DirectorDashboardSimple: React.FC = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DirectorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<'sales-behaviours' | 'coaching' | 'both'>('both');
  const [selectedLevel, setSelectedLevel] = useState<'company' | 'regional' | 'sales-lead'>('company');

  useEffect(() => {
    if (user?.role === 'SALES_DIRECTOR' || user?.role === 'ADMIN') {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getDirectorDashboard();
      setDashboardData(data);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatScore = (score: number): string => {
    return `${Math.round((score / 4) * 100)}%`;
  };

  const getScoreColor = (score: number): string => {
    const percentage = (score / 4) * 100;
    if (percentage >= 75) return '#10b981'; // Green
    if (percentage >= 50) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-message">
          <h2>⚠️ Error Loading Dashboard</h2>
          <p>{error}</p>
          <button onClick={loadDashboardData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="dashboard-container">
        <div className="no-data">
          <h2>📊 No Data Available</h2>
          <p>No evaluation data is available at this time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>📊 Sales Director Dashboard</h1>
        <p>Comprehensive performance analytics and insights</p>
      </div>

      {/* Simple Navigation Tabs */}
      <div className="dashboard-nav-tabs">
        <button 
          className={`nav-tab ${selectedLevel === 'company' ? 'nav-tab-active' : ''}`}
          onClick={() => setSelectedLevel('company')}
        >
          🏢 Company Level
        </button>
        <button 
          className={`nav-tab ${selectedLevel === 'regional' ? 'nav-tab-active' : ''}`}
          onClick={() => setSelectedLevel('regional')}
        >
          🌍 Regional Level
        </button>
        <button 
          className={`nav-tab ${selectedLevel === 'sales-lead' ? 'nav-tab-active' : ''}`}
          onClick={() => setSelectedLevel('sales-lead')}
        >
          👥 Sales Lead Level
        </button>
      </div>

      {/* Simple View Toggle */}
      <div className="view-toggle">
        <button 
          className={`toggle-btn ${selectedView === 'both' ? 'toggle-btn-active' : ''}`}
          onClick={() => setSelectedView('both')}
        >
          📊 Both
        </button>
        <button 
          className={`toggle-btn ${selectedView === 'sales-behaviours' ? 'toggle-btn-active' : ''}`}
          onClick={() => setSelectedView('sales-behaviours')}
        >
          🎯 Sales Behaviours
        </button>
        <button 
          className={`toggle-btn ${selectedView === 'coaching' ? 'toggle-btn-active' : ''}`}
          onClick={() => setSelectedView('coaching')}
        >
          👨‍🏫 Coaching
        </button>
      </div>

      {/* Company Level */}
      {selectedLevel === 'company' && (
        <div className="analytics-view">
          <div className="analytics-header">
            <h2>🏢 Company Overview</h2>
            <p>Company-wide performance metrics and analytics</p>
          </div>

          {/* Company Metrics */}
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="card-header">
                <h3>📈 Company Metrics</h3>
              </div>
              <div className="metrics-grid">
                <div className="metric-item">
                  <div className="metric-value">{dashboardData.userCounts?.totalSalesLeads || 0}</div>
                  <div className="metric-label">Sales Leads</div>
                </div>
                <div className="metric-item">
                  <div className="metric-value">{dashboardData.userCounts?.totalRegionalManagers || 0}</div>
                  <div className="metric-label">Regional Managers</div>
                </div>
                <div className="metric-item">
                  <div className="metric-value">{dashboardData.userCounts?.totalSalespeople || 0}</div>
                  <div className="metric-label">Salespeople</div>
                </div>
                <div className="metric-item">
                  <div className="metric-value">{dashboardData.shareOfWalletDistribution.length}</div>
                  <div className="metric-label">Customer Types</div>
                </div>
              </div>
            </div>
          </div>

          {/* Share of Wallet Distribution */}
          {dashboardData.shareOfWalletDistribution && dashboardData.shareOfWalletDistribution.length > 0 && (
            <div className="analytics-grid">
              <div className="analytics-card">
                <div className="card-header">
                  <h3>💰 Share of Wallet Distribution</h3>
                </div>
                <p className="section-description">Distribution of evaluations by client type</p>
                <div className="share-of-wallet-grid">
                  {dashboardData.shareOfWalletDistribution.map((wallet, index) => (
                    <div key={index} className="wallet-card">
                      <div className="wallet-header">
                        <h4>{wallet.customerType}</h4>
                        <div className="wallet-percentage">{wallet.percentage.toFixed(1)}%</div>
                      </div>
                      <div className="wallet-metrics">
                        <div className="wallet-metric">
                          <span className="wallet-label">Evaluations:</span>
                          <span className="wallet-value">{wallet.evaluationCount}</span>
                        </div>
                        <div className="wallet-metric">
                          <span className="wallet-label">Avg Score:</span>
                          <span className="wallet-value" style={{ color: getScoreColor(wallet.avgScore) }}>
                            {formatScore(wallet.avgScore)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sales Behaviours Performance */}
          {(selectedView === 'sales-behaviours' || selectedView === 'both') && dashboardData.companyExecutionMetrics && (
            <div className="analytics-grid">
              <div className="analytics-card">
                <div className="card-header">
                  <h3>🎯 Sales Behaviours Performance</h3>
                </div>
                <div className="metrics-grid">
                  <div className="metric-item">
                    <div className="metric-value">{dashboardData.companyExecutionMetrics.totalExecutionEvaluations}</div>
                    <div className="metric-label">Total Evaluations</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-value">{formatScore(dashboardData.companyExecutionMetrics.avgExecutionScore)}</div>
                    <div className="metric-label">Average Score</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-value">{dashboardData.companyExecutionMetrics.totalSalespeopleEvaluated}</div>
                    <div className="metric-label">Salespeople Evaluated</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-value">{dashboardData.companyExecutionMetrics.totalSalesLeadsEvaluating}</div>
                    <div className="metric-label">Sales Leads Evaluating</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Coaching Performance */}
          {(selectedView === 'coaching' || selectedView === 'both') && dashboardData.companyCoachingMetrics && (
            <div className="analytics-grid">
              <div className="analytics-card">
                <div className="card-header">
                  <h3>👨‍🏫 Coaching Performance</h3>
                </div>
                <div className="metrics-grid">
                  <div className="metric-item">
                    <div className="metric-value">{dashboardData.companyCoachingMetrics.totalCoachingEvaluations}</div>
                    <div className="metric-label">Total Evaluations</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-value">{formatScore(dashboardData.companyCoachingMetrics.avgCoachingScore)}</div>
                    <div className="metric-label">Average Score</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-value">{dashboardData.companyCoachingMetrics.totalSalesLeadsEvaluated}</div>
                    <div className="metric-label">Sales Leads Evaluated</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-value">{dashboardData.companyCoachingMetrics.totalRegionalManagersEvaluating}</div>
                    <div className="metric-label">Regional Managers Evaluating</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Regional Level */}
      {selectedLevel === 'regional' && (
        <div className="analytics-view">
          <div className="analytics-header">
            <h2>🌍 Regional Managers Performance</h2>
            <p>Performance overview of all regional managers</p>
          </div>

          {/* Regional Sales Behaviours */}
          {(selectedView === 'sales-behaviours' || selectedView === 'both') && dashboardData.regionalExecutionMetrics && dashboardData.regionalExecutionMetrics.length > 0 && (
            <div className="analytics-grid">
              <div className="analytics-card">
                <div className="card-header">
                  <h3>🎯 Sales Behaviours Performance</h3>
                </div>
                <div className="performance-cards-grid">
                  {dashboardData.regionalExecutionMetrics.map(regional => (
                    <div key={regional.regionalManagerId} className="performance-card">
                      <div className="performance-card-header">
                        <div className="manager-avatar">
                          <span className="avatar-text">{regional.regionalManagerName.charAt(0)}</span>
                        </div>
                        <div className="manager-details">
                          <h4 className="manager-name">{regional.regionalManagerName}</h4>
                          <p className="manager-region">{regional.regionName || 'Unknown Region'}</p>
                        </div>
                        <div className="performance-score" style={{ color: getScoreColor(regional.avgExecutionScore) }}>
                          {formatScore(regional.avgExecutionScore)}
                        </div>
                      </div>
                      <div className="performance-metrics">
                        <div className="metric-row">
                          <span className="metric-label">Evaluations</span>
                          <span className="metric-value">{regional.executionEvaluations}</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">Salespeople Evaluated</span>
                          <span className="metric-value">{regional.uniqueSalespeopleEvaluated}</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">Sales Leads</span>
                          <span className="metric-value">{regional.uniqueSalesLeadsEvaluating}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Regional Coaching */}
          {(selectedView === 'coaching' || selectedView === 'both') && dashboardData.regionalCoachingMetrics && dashboardData.regionalCoachingMetrics.length > 0 && (
            <div className="analytics-grid">
              <div className="analytics-card">
                <div className="card-header">
                  <h3>👨‍🏫 Coaching Performance</h3>
                </div>
                <div className="performance-cards-grid">
                  {dashboardData.regionalCoachingMetrics.map(regional => (
                    <div key={regional.regionalManagerId} className="performance-card">
                      <div className="performance-card-header">
                        <div className="manager-avatar">
                          <span className="avatar-text">{regional.regionalManagerName.charAt(0)}</span>
                        </div>
                        <div className="manager-details">
                          <h4 className="manager-name">{regional.regionalManagerName}</h4>
                          <p className="manager-region">{regional.regionName || 'Unknown Region'}</p>
                        </div>
                        <div className="performance-score" style={{ color: getScoreColor(regional.avgCoachingScore) }}>
                          {formatScore(regional.avgCoachingScore)}
                        </div>
                      </div>
                      <div className="performance-metrics">
                        <div className="metric-row">
                          <span className="metric-label">Coaching Evaluations</span>
                          <span className="metric-value">{regional.coachingEvaluations}</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">Sales Leads Coached</span>
                          <span className="metric-value">{regional.uniqueSalesLeadsEvaluated}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sales Lead Level */}
      {selectedLevel === 'sales-lead' && (
        <div className="analytics-view">
          <div className="analytics-header">
            <h2>👥 Sales Leads Performance</h2>
            <p>Performance overview of all sales leads</p>
          </div>

          {/* Sales Lead Sales Behaviours */}
          {(selectedView === 'sales-behaviours' || selectedView === 'both') && dashboardData.salespeopleExecutionPerformance && dashboardData.salespeopleExecutionPerformance.length > 0 && (
            <div className="analytics-grid">
              <div className="analytics-card">
                <div className="card-header">
                  <h3>🎯 Sales Behaviours Performance</h3>
                </div>
                <div className="performance-cards-grid">
                  {dashboardData.salespeopleExecutionPerformance.map(lead => (
                    <div key={lead.salesLeadId} className="performance-card">
                      <div className="performance-card-header">
                        <div className="manager-avatar">
                          <span className="avatar-text">{lead.salesLeadName.charAt(0)}</span>
                        </div>
                        <div className="manager-details">
                          <h4 className="manager-name">{lead.salesLeadName}</h4>
                          <p className="manager-region">{lead.regionName || 'Unknown Region'}</p>
                        </div>
                        <div className="performance-score" style={{ color: getScoreColor(lead.avgExecutionScore) }}>
                          {formatScore(lead.avgExecutionScore)}
                        </div>
                      </div>
                      <div className="performance-metrics">
                        <div className="metric-row">
                          <span className="metric-label">Evaluations Created</span>
                          <span className="metric-value">{lead.executionEvaluationsCreated}</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">Region</span>
                          <span className="metric-value">{lead.regionName || 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sales Lead Coaching */}
          {(selectedView === 'coaching' || selectedView === 'both') && dashboardData.salesLeadCoachingPerformance && dashboardData.salesLeadCoachingPerformance.length > 0 && (
            <div className="analytics-grid">
              <div className="analytics-card">
                <div className="card-header">
                  <h3>👨‍🏫 Coaching Performance</h3>
                </div>
                <div className="performance-cards-grid">
                  {dashboardData.salesLeadCoachingPerformance.map(coaching => (
                    <div key={coaching.salesLeadId} className="performance-card">
                      <div className="performance-card-header">
                        <div className="manager-avatar">
                          <span className="avatar-text">{coaching.salesLeadName.charAt(0)}</span>
                        </div>
                        <div className="manager-details">
                          <h4 className="manager-name">{coaching.salesLeadName}</h4>
                          <p className="manager-region">{coaching.regionName || 'Unknown Region'}</p>
                        </div>
                        <div className="performance-score" style={{ color: getScoreColor(coaching.avgCoachingScore) }}>
                          {formatScore(coaching.avgCoachingScore)}
                        </div>
                      </div>
                      <div className="performance-metrics">
                        <div className="metric-row">
                          <span className="metric-label">Coaching Received</span>
                          <span className="metric-value">{coaching.coachingEvaluationsReceived}</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">Regional Manager</span>
                          <span className="metric-value">{coaching.regionalManagerName}</span>
                        </div>
                        <div className="metric-row">
                          <span className="metric-label">Region</span>
                          <span className="metric-value">{coaching.regionName || 'Unknown'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DirectorDashboardSimple;
