import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardTranslations } from '../hooks/useDashboardTranslations';

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
  
  // Share of Wallet distribution
  shareOfWalletDistribution: Array<{
    customerType: string;
    evaluationCount: number;
    avgScore: number;
    percentage: number;
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

const DirectorDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const translations = useDashboardTranslations();
  const [dashboardData, setDashboardData] = useState<DirectorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<'sales-behaviours' | 'coaching' | 'both'>('both');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedRegionalManager, setSelectedRegionalManager] = useState<string>('all');
  const [selectedSalesLead, setSelectedSalesLead] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedDataType, setSelectedDataType] = useState<'company' | 'regional' | 'sales-lead'>('company');
  const [selectedRegionalManagerId, setSelectedRegionalManagerId] = useState<string>('all');
  const [selectedSalesLeadId, setSelectedSalesLeadId] = useState<string>('all');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

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
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatScore = (score: number): string => {
    // Score is already on 1-4 scale, convert to percentage
    const percentage = Math.round((score / 4) * 100);
    return `${percentage}%`;
  };

  const getScoreColor = (score: number): string => {
    // Convert 1-4 scale to percentage for color calculation
    const percentage = (score / 4) * 100;
    if (percentage >= 75) return '#10B981'; // Green
    if (percentage >= 50) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const isMobile = () => window.innerWidth <= 768;

  // Get all unique regions for filter dropdown
  const allRegions = React.useMemo(() => {
    const regions = new Map();
    dashboardData?.regionalExecutionPerformance.forEach(r => regions.set(r.regionId, r.regionName));
    dashboardData?.regionalCoachingPerformance.forEach(r => regions.set(r.regionId, r.regionName));
    return Array.from(regions.entries()).map(([id, name]) => ({ id, name }));
  }, [dashboardData]);

  // Get all unique regional managers for filter dropdown
  const allRegionalManagers = React.useMemo(() => {
    const managers = new Map();
    dashboardData?.salesLeadCoachingPerformance.forEach(coaching => {
      managers.set(coaching.regionalManagerId, coaching.regionalManagerName);
    });
    return Array.from(managers.entries()).map(([id, name]) => ({ id, name }));
  }, [dashboardData]);

  // Get all unique sales leads for filter dropdown
  const allSalesLeads = React.useMemo(() => {
    const leads = new Map();
    dashboardData?.salespeopleExecutionPerformance.forEach(exec => {
      leads.set(exec.salesLeadId, exec.salesLeadName);
    });
    dashboardData?.salesLeadCoachingPerformance.forEach(coaching => {
      leads.set(coaching.salesLeadId, coaching.salesLeadName);
    });
    return Array.from(leads.entries()).map(([id, name]) => ({ id, name }));
  }, [dashboardData]);

  // Filter data based on selected filters
  const filteredSalesBehavioursRegions = dashboardData?.regionalExecutionPerformance.filter(region => 
    (selectedRegion === 'all' || region.regionId === selectedRegion)
  ) || [];

  const filteredCoachingRegions = dashboardData?.regionalCoachingPerformance.filter(region => 
    (selectedRegion === 'all' || region.regionId === selectedRegion)
  ) || [];

  const filteredSalesBehavioursSalesLeads = dashboardData?.salespeopleExecutionPerformance.filter(lead => 
    (selectedRegion === 'all' || lead.regionId === selectedRegion) &&
    (selectedSalesLead === 'all' || lead.salesLeadId === selectedSalesLead)
  ) || [];

  const filteredCoachingSalesLeads = dashboardData?.salesLeadCoachingPerformance.filter(coaching => 
    (selectedRegion === 'all' || coaching.regionId === selectedRegion) &&
    (selectedRegionalManager === 'all' || coaching.regionalManagerId === selectedRegionalManager) &&
    (selectedSalesLead === 'all' || coaching.salesLeadId === selectedSalesLead)
  ) || [];

  // Filter regional managers based on selected regional manager
  const filteredRegionalManagers = dashboardData?.regionalExecutionMetrics.filter(rm => 
    (selectedRegionalManagerId === 'all' || rm.regionalManagerId === selectedRegionalManagerId)
  ) || [];

  const filteredRegionalManagersCoaching = dashboardData?.regionalCoachingMetrics.filter(rm => 
    (selectedRegionalManagerId === 'all' || rm.regionalManagerId === selectedRegionalManagerId)
  ) || [];

  // Filter sales leads under selected regional manager
  const salesLeadsUnderSelectedRM = dashboardData?.salesLeadCoachingPerformance.filter(coaching => 
    (selectedRegionalManagerId === 'all' || coaching.regionalManagerId === selectedRegionalManagerId)
  ) || [];

  // Filter specific sales lead data
  const specificSalesLeadData = dashboardData?.salespeopleExecutionPerformance.filter(lead => 
    (selectedSalesLeadId === 'all' || lead.salesLeadId === selectedSalesLeadId)
  ) || [];

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading director dashboard...</p>
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
        <h1>📊 {translations.directorTitle}</h1>
        <p>{translations.directorSubtitle}</p>
      </div>

      {/* Simple Navigation Tabs */}
      <div className="dashboard-nav-tabs">
        <button 
          className={`nav-tab ${selectedDataType === 'company' ? 'nav-tab-active' : ''}`}
          onClick={() => setSelectedDataType('company')}
        >
          🏢 Company Level
        </button>
        <button 
          className={`nav-tab ${selectedDataType === 'regional' ? 'nav-tab-active' : ''}`}
          onClick={() => setSelectedDataType('regional')}
        >
          🌍 Regional Level
        </button>
        <button 
          className={`nav-tab ${selectedDataType === 'sales-lead' ? 'nav-tab-active' : ''}`}
          onClick={() => setSelectedDataType('sales-lead')}
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

      {/* Dynamic Content Based on Selected Data Type */}
      {selectedDataType === 'company' && (
        <div className="analytics-view">
          <div className="analytics-header">
            <h2>🏢 {translations.companyOverview}</h2>
            <p>Comprehensive company-wide performance metrics and analytics</p>
          </div>
        
        {/* Sales Behaviours Performance Metrics */}
        {dashboardData.companyExecutionMetrics && (selectedView === 'sales-behaviours' || selectedView === 'both') && (
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="card-header">
                <h3>🎯 {translations.salesBehavioursPerformance}</h3>
              </div>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-value">{dashboardData.companyExecutionMetrics.totalExecutionEvaluations}</div>
                  <div className="metric-label">{translations.salesBehavioursEvaluations}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value" style={{ color: getScoreColor(dashboardData.companyExecutionMetrics.avgExecutionScore) }}>
                    {formatScore(dashboardData.companyExecutionMetrics.avgExecutionScore)}
                  </div>
                  <div className="metric-label">{translations.avgSalesBehavioursScore}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{dashboardData.companyExecutionMetrics.totalSalespeopleEvaluated}</div>
                  <div className="metric-label">{translations.salespeopleEvaluated}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{dashboardData.companyExecutionMetrics.totalSalesLeadsEvaluating}</div>
                  <div className="metric-label">{translations.salesLeadsEvaluating}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Coaching Performance Metrics */}
        {dashboardData.companyCoachingMetrics && (selectedView === 'coaching' || selectedView === 'both') && (
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="card-header">
                <h3>👨‍🏫 {translations.coachingPerformance}</h3>
              </div>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-value">{dashboardData.companyCoachingMetrics.totalCoachingEvaluations}</div>
                  <div className="metric-label">{translations.coachingEvaluations}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value" style={{ color: getScoreColor(dashboardData.companyCoachingMetrics.avgCoachingScore) }}>
                    {formatScore(dashboardData.companyCoachingMetrics.avgCoachingScore)}
                  </div>
                  <div className="metric-label">{translations.avgCoachingScore}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{dashboardData.companyCoachingMetrics.totalSalesLeadsEvaluated}</div>
                  <div className="metric-label">{translations.salesLeadsEvaluated}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{dashboardData.companyCoachingMetrics.totalRegionalManagersEvaluating}</div>
                  <div className="metric-label">{translations.regionalManagersEvaluating}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Counts */}
        {dashboardData.userCounts && (
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="card-header">
                <h3>👥 {translations.teamOverview}</h3>
              </div>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-value">{dashboardData.userCounts.totalSalespeople}</div>
                  <div className="metric-label">{translations.totalSalespeople}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{dashboardData.userCounts.totalSalesLeads}</div>
                  <div className="metric-label">{translations.totalSalesLeads}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{dashboardData.userCounts.totalRegionalManagers}</div>
                  <div className="metric-label">{translations.totalRegionalManagers}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Share of Wallet Distribution */}
        {dashboardData.shareOfWalletDistribution && dashboardData.shareOfWalletDistribution.length > 0 && (
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="card-header">
                <h3>💰 {translations.shareOfWalletDistribution}</h3>
              </div>
              <p className="section-description">{translations.shareOfWalletDescription}</p>
              <div className="share-of-wallet-grid">
                {dashboardData.shareOfWalletDistribution.map((item, index) => (
                  <div key={item.customerType} className="wallet-card">
                    <div className="wallet-header">
                      <h4>
                        {item.customerType === 'HIGH_SHARE' && '🟢 ' + translations.highShare}
                        {item.customerType === 'MID_SHARE' && '🟡 ' + translations.midShare}
                        {item.customerType === 'LOW_SHARE' && '🔴 ' + translations.lowShare}
                      </h4>
                      <div className="wallet-percentage">{item.percentage}%</div>
                    </div>
                    <div className="wallet-metrics">
                      <div className="wallet-metric">
                        <span className="wallet-label">{translations.totalEvaluations}</span>
                        <span className="wallet-value">{item.evaluationCount}</span>
                      </div>
                      <div className="wallet-metric">
                        <span className="wallet-label">{translations.avgScore}</span>
                        <span className="wallet-value" style={{ color: getScoreColor(item.avgScore) }}>
                          {formatScore(item.avgScore)}
                        </span>
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

      {/* Regional Level Content - Hierarchical Filtering */}
          {selectedDataType === 'regional' && (
            <div className="analytics-view">
              <div className="analytics-header">
                <h2>🌍 Regional Managers Performance</h2>
                <p>Performance overview of all regional managers</p>
              </div>

          {/* Show Regional Manager Overview when one is selected */}
          {selectedRegionalManagerId !== 'all' && (
            <>
              {/* Regional Manager Performance Summary */}
              {(selectedView === 'sales-behaviours' || selectedView === 'both') && filteredRegionalManagers.length > 0 && (
                <div className="analytics-grid">
                  <div className="analytics-card">
                    <div className="card-header">
                      <h3>🎯 Regional Manager Performance (Sales Behaviours)</h3>
                    </div>
                    <div className="performance-table">
                      <div className="table-header">
                        <div>Regional Manager</div>
                        <div>Region</div>
                        <div>Evaluations</div>
                        <div>Avg Score</div>
                        <div>Salespeople</div>
                        <div>Sales Leads</div>
                      </div>
                      {filteredRegionalManagers.map(regional => (
                        <div key={`exec-regional-${regional.regionalManagerId}`} className="table-row">
                          <div className="table-cell">
                            <span className="mobile-label">Regional Manager:</span>
                            <div className="manager-info">
                              <div className="manager-name">{regional.regionalManagerName}</div>
                              <div className="manager-email">{regional.regionalManagerEmail}</div>
                            </div>
                          </div>
                          <div className="table-cell">
                            <span className="mobile-label">Region:</span>
                            <span>{regional.regionName || translations.unknown}</span>
                          </div>
                          <div className="table-cell">
                            <span className="mobile-label">Evaluations:</span>
                            <span>{regional.executionEvaluations}</span>
                          </div>
                          <div className="table-cell">
                            <span className="mobile-label">Avg Score:</span>
                            <span className="score-cell" style={{ color: getScoreColor(regional.avgExecutionScore) }}>
                              {formatScore(regional.avgExecutionScore)}
                            </span>
                          </div>
                          <div className="table-cell">
                            <span className="mobile-label">Salespeople:</span>
                            <span>{regional.uniqueSalespeopleEvaluated}</span>
                          </div>
                          <div className="table-cell">
                            <span className="mobile-label">Sales Leads:</span>
                            <span>{regional.uniqueSalesLeadsEvaluating}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Regional Manager Coaching Performance */}
              {(selectedView === 'coaching' || selectedView === 'both') && filteredRegionalManagersCoaching.length > 0 && (
                <div className="analytics-grid">
                  <div className="analytics-card">
                    <div className="card-header">
                      <h3>👨‍🏫 Regional Manager Performance (Coaching)</h3>
                    </div>
                    <div className="performance-table">
                      <div className="table-header">
                        <div>Regional Manager</div>
                        <div>Region</div>
                        <div>Evaluations</div>
                        <div>Avg Score</div>
                        <div>Sales Leads</div>
                      </div>
                      {filteredRegionalManagersCoaching.map(regional => (
                        <div key={`coach-regional-${regional.regionalManagerId}`} className="table-row">
                          <div className="table-cell">
                            <span className="mobile-label">Regional Manager:</span>
                            <div className="manager-info">
                              <div className="manager-name">{regional.regionalManagerName}</div>
                              <div className="manager-email">{regional.regionalManagerEmail}</div>
                            </div>
                          </div>
                          <div className="table-cell">
                            <span className="mobile-label">Region:</span>
                            <span>{regional.regionName || translations.unknown}</span>
                          </div>
                          <div className="table-cell">
                            <span className="mobile-label">Evaluations:</span>
                            <span>{regional.coachingEvaluations}</span>
                          </div>
                          <div className="table-cell">
                            <span className="mobile-label">Avg Score:</span>
                            <span className="score-cell" style={{ color: getScoreColor(regional.avgCoachingScore) }}>
                              {formatScore(regional.avgCoachingScore)}
                            </span>
                          </div>
                          <div className="table-cell">
                            <span className="mobile-label">Sales Leads:</span>
                            <span>{regional.uniqueSalesLeadsEvaluated}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Show Sales Lead Details when one is selected */}
              {selectedSalesLeadId !== 'all' && specificSalesLeadData.length > 0 && (
                <div className="analytics-grid">
                  <div className="analytics-card">
                    <div className="card-header">
                      <h3>👥 Selected Sales Lead Performance</h3>
                    </div>
                    <div className="performance-table">
                      <div className="table-header">
                        <div>Sales Lead</div>
                        <div>Region</div>
                        <div>Evaluations</div>
                        <div>Avg Score</div>
                      </div>
                      {specificSalesLeadData.map(lead => (
                        <div key={`specific-lead-${lead.salesLeadId}`} className="table-row">
                          <div className="table-cell">
                            <span className="mobile-label">Sales Lead:</span>
                            <div className="manager-info">
                              <div className="manager-name">{lead.salesLeadName}</div>
                              <div className="manager-email">{lead.salesLeadEmail}</div>
                            </div>
                          </div>
                          <div className="table-cell">
                            <span className="mobile-label">Region:</span>
                            <span>{lead.regionName || translations.unknown}</span>
                          </div>
                          <div className="table-cell">
                            <span className="mobile-label">Evaluations:</span>
                            <span>{lead.executionEvaluationsCreated}</span>
                          </div>
                          <div className="table-cell">
                            <span className="mobile-label">Avg Score:</span>
                            <span className="score-cell" style={{ color: getScoreColor(lead.avgExecutionScore) }}>
                              {formatScore(lead.avgExecutionScore)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Show All Regional Managers when none selected */}
          {selectedRegionalManagerId === 'all' && (
            <>
              {/* All Regional Managers Performance - Sales Behaviours */}
              {(selectedView === 'sales-behaviours' || selectedView === 'both') && (
                <div className="analytics-grid">
                  <div className="analytics-card">
                    <div className="card-header">
                      <h3>🎯 {translations.regionalSalesBehavioursPerformance}</h3>
                    </div>
                    <p className="section-description">Sales behaviours performance by regional manager</p>
                    {dashboardData.regionalExecutionMetrics && dashboardData.regionalExecutionMetrics.length > 0 ? (
                      <div className="performance-table">
                        <div className="table-header">
                          <div>Regional Manager</div>
                          <div>Region</div>
                          <div>Evaluations</div>
                          <div>Avg Score</div>
                          <div>Salespeople</div>
                          <div>Sales Leads</div>
                        </div>
                        {dashboardData.regionalExecutionMetrics.map(regional => (
                          <div key={`exec-regional-${regional.regionalManagerId}`} className="table-row">
                            <div className="manager-info">
                              <div className="manager-name">{regional.regionalManagerName}</div>
                              <div className="manager-email">{regional.regionalManagerEmail}</div>
                            </div>
                            <div>{regional.regionName || translations.unknown}</div>
                            <div>{regional.executionEvaluations}</div>
                            <div className="score-cell" style={{ color: getScoreColor(regional.avgExecutionScore) }}>
                              {formatScore(regional.avgExecutionScore)}
                            </div>
                            <div>{regional.uniqueSalespeopleEvaluated}</div>
                            <div>{regional.uniqueSalesLeadsEvaluating}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-data">No sales behaviours data available for regional managers</div>
                    )}
                  </div>
                </div>
              )}

              {/* All Regional Managers Performance - Coaching */}
              {(selectedView === 'coaching' || selectedView === 'both') && (
                <div className="analytics-grid">
                  <div className="analytics-card">
                    <div className="card-header">
                      <h3>👨‍🏫 {translations.regionalCoachingPerformance}</h3>
                    </div>
                    <p className="section-description">Coaching performance by regional manager</p>
                    {dashboardData.regionalCoachingMetrics && dashboardData.regionalCoachingMetrics.length > 0 ? (
                      <div className="performance-table">
                        <div className="table-header">
                          <div>Regional Manager</div>
                          <div>Region</div>
                          <div>Evaluations</div>
                          <div>Avg Score</div>
                          <div>Sales Leads</div>
                        </div>
                        {dashboardData.regionalCoachingMetrics.map(regional => (
                          <div key={`coach-regional-${regional.regionalManagerId}`} className="table-row">
                            <div className="manager-info">
                              <div className="manager-name">{regional.regionalManagerName}</div>
                              <div className="manager-email">{regional.regionalManagerEmail}</div>
                            </div>
                            <div>{regional.regionName || translations.unknown}</div>
                            <div>{regional.coachingEvaluations}</div>
                            <div className="score-cell" style={{ color: getScoreColor(regional.avgCoachingScore) }}>
                              {formatScore(regional.avgCoachingScore)}
                            </div>
                            <div>{regional.uniqueSalesLeadsEvaluated}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-data">No coaching data available for regional managers</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Sales Lead Level Content */}
      {selectedDataType === 'sales-lead' && (
        <>
          {/* Sales Lead Performance - Sales Behaviours */}
      {(selectedView === 'sales-behaviours' || selectedView === 'both') && filteredSalesBehavioursSalesLeads.length > 0 && (
        <div className="section">
          <h2>👥 {translations.salesLeadSalesBehavioursPerformance}</h2>
          <p className="section-description">{translations.salesLeadSalesBehavioursDescription}</p>
          <div className="performance-table">
            <div className="table-header">
              <div>{translations.salesLead}</div>
              <div>{t('common.region')}</div>
              <div>{translations.salesBehavioursEvaluations}</div>
              <div>{translations.avgSalesBehavioursScoreHeader}</div>
            </div>
            {filteredSalesBehavioursSalesLeads.map(lead => (
              <div key={`exec-lead-${lead.salesLeadId}`} className="table-row">
                <div className="table-cell">
                  <span className="mobile-label">Sales Lead:</span>
                  <div className="lead-info">
                    <div className="lead-name">{lead.salesLeadName}</div>
                    <div className="lead-email">{lead.salesLeadEmail}</div>
                  </div>
                </div>
                <div className="table-cell">
                  <span className="mobile-label">Region:</span>
                  <span>{lead.regionName || translations.unknown}</span>
                </div>
                <div className="table-cell">
                  <span className="mobile-label">Evaluations:</span>
                  <span>{lead.executionEvaluationsCreated}</span>
                </div>
                <div className="table-cell">
                  <span className="mobile-label">Avg Score:</span>
                  <span className="score-cell" style={{ color: getScoreColor(lead.avgExecutionScore) }}>
                    {formatScore(lead.avgExecutionScore)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales Lead Performance - Coaching */}
      {(selectedView === 'coaching' || selectedView === 'both') && filteredCoachingSalesLeads.length > 0 && (
        <div className="section">
          <h2>👥 {translations.salesLeadCoachingPerformance}</h2>
          <p className="section-description">{translations.salesLeadCoachingDescription}</p>
          <div className="performance-table">
            <div className="table-header">
              <div>{translations.salesLead}</div>
              <div>{translations.regionalManager}</div>
              <div>{t('common.region')}</div>
              <div>{translations.coachingEvaluationsReceived}</div>
              <div>{translations.avgSalesBehavioursScoreHeader}</div>
            </div>
            {filteredCoachingSalesLeads.map(coaching => (
              <div key={`coach-lead-${coaching.salesLeadId}-${coaching.regionalManagerId}`} className="table-row">
                <div className="lead-info">
                  <div className="lead-name">{coaching.salesLeadName}</div>
                  <div className="lead-email">{coaching.salesLeadEmail}</div>
                </div>
                <div className="manager-info">
                  <div className="manager-name">{coaching.regionalManagerName}</div>
                </div>
                <div>{coaching.regionName || translations.unknown}</div>
                <div>{coaching.coachingEvaluationsReceived}</div>
                <div className="score-cell" style={{ color: getScoreColor(coaching.avgCoachingScore) }}>
                  {formatScore(coaching.avgCoachingScore)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trends - Sales Behaviours */}
      {(selectedView === 'sales-behaviours' || selectedView === 'both') && dashboardData.executionTrends.length > 0 && (
        <div className="section">
          <h2>📈 {translations.salesBehavioursTrends}</h2>
          <p className="section-description">{translations.salesBehavioursTrendsDescription}</p>
          <div className="trends-container">
            {dashboardData.executionTrends.slice(0, 10).map(trend => (
              <div key={`exec-trend-${trend.date}`} className="trend-item">
                <div className="trend-date">{new Date(trend.date).toLocaleDateString()}</div>
                <div className="trend-metrics">
                  <span className="trend-count">{trend.evaluationsCount} {translations.salesBehavioursEvaluationsCount}</span>
                  <span className="trend-score" style={{ color: getScoreColor(trend.avgScore) }}>
                    {formatScore(trend.avgScore)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trends - Coaching */}
      {(selectedView === 'coaching' || selectedView === 'both') && dashboardData.coachingTrends.length > 0 && (
        <div className="section">
          <h2>📈 {translations.coachingTrends}</h2>
          <p className="section-description">{translations.coachingTrendsDescription}</p>
          <div className="trends-container">
            {dashboardData.coachingTrends.slice(0, 10).map(trend => (
              <div key={`coach-trend-${trend.date}`} className="trend-item">
                <div className="trend-date">{new Date(trend.date).toLocaleDateString()}</div>
                <div className="trend-metrics">
                  <span className="trend-count">{trend.evaluationsCount} {translations.coachingEvaluationsCount}</span>
                  <span className="trend-score" style={{ color: getScoreColor(trend.avgScore) }}>
                    {formatScore(trend.avgScore)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
          )}
        </>
      )}
    </div>
  );
};

export default DirectorDashboard;
