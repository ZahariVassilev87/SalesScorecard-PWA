import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { apiService, Evaluation } from '../services/api';
import { useTranslation } from 'react-i18next';

const AnalyticsView: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'my-performance' | 'team-performance'>('my-performance');
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        // Get evaluations where user is manager or salesperson
        const evaluationsData = await apiService.getMyEvaluations();
        console.log('📊 Analytics: Loaded evaluations:', evaluationsData.length);
        console.log('📊 Analytics: Sample evaluation:', evaluationsData[0]);
        setEvaluations(evaluationsData);
      } catch (err) {
        setError(t('analytics.failedToLoadAnalytics'));
        console.error('Failed to load analytics:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [t]);

  // Separate evaluations based on user role
  const separateEvaluations = () => {
    console.log('📊 Analytics: User role:', user?.role);
    console.log('📊 Analytics: Total evaluations loaded:', evaluations.length);
    
    if (user?.role === 'REGIONAL_SALES_MANAGER') {
      // For Regional Managers: 
      // 1. Team Coaching: coaching evaluations that the RM created about their sales leads
      // 2. Team Sales Behaviours: evaluations that their sales leads created about salespeople
      
      // Get coaching evaluations created by this regional manager about their sales leads
      const teamCoachingEvaluations = evaluations.filter(
        (evaluation) => evaluation.managerId === user?.id
      );
      
      // Get sales behaviours evaluations created by sales leads (where managerId is a sales lead)
      // We need to get all evaluations where the manager is a sales lead in this RM's team
      // For now, we'll get all evaluations where managerId is not this RM (assuming sales leads)
      // In a full implementation, we'd need to get the actual team members
      const teamSalesBehavioursEvaluations = evaluations.filter(
        (evaluation) => evaluation.managerId !== user?.id && evaluation.manager?.role === 'SALES_LEAD'
      );
      
      console.log('📊 Analytics: Regional Manager - Coaching evaluations:', teamCoachingEvaluations.length);
      console.log('📊 Analytics: Regional Manager - Sales behaviour evaluations:', teamSalesBehavioursEvaluations.length);
      
      return { 
        coachingEvaluations: teamCoachingEvaluations,
        salesBehavioursEvaluations: teamSalesBehavioursEvaluations 
      };
    } else {
      // For Sales Leads: coaching evaluations about them, sales behaviours they created
      const coachingEvaluations = evaluations.filter(
        (evaluation) => evaluation.salespersonId === user?.id
      );
      const salesBehavioursEvaluations = evaluations.filter(
        (evaluation) => evaluation.managerId === user?.id
      );
      
      console.log('📊 Analytics: Sales Lead - Coaching evaluations (about me):', coachingEvaluations.length);
      console.log('📊 Analytics: Sales Lead - Sales behaviour evaluations (I created):', salesBehavioursEvaluations.length);
      
      return { coachingEvaluations, salesBehavioursEvaluations };
    }
  };

  const calculateAverageScore = (evals: Evaluation[]) => {
    if (evals.length === 0) return 0;
    const totalScore = evals.reduce((sum, evaluation) => sum + (evaluation.overallScore || 0), 0);
    return totalScore / evals.length;
  };

  const calculatePercentage = (score: number) => {
    // Convert 1-4 scale to percentage
    return Math.round((score / 4) * 100);
  };

  const getScoreDistribution = (evals: Evaluation[]) => {
    const distribution = { excellent: 0, good: 0, average: 0, poor: 0 };
    
    evals.forEach(evaluation => {
      const percentage = calculatePercentage(evaluation.overallScore || 0);
      if (percentage >= 90) distribution.excellent++;
      else if (percentage >= 75) distribution.good++;
      else if (percentage >= 50) distribution.average++;
      else distribution.poor++;
    });
    
    return distribution;
  };

  const getRecentTrend = (evals: Evaluation[]) => {
    if (evals.length < 2) return 'insufficient data';
    
    const sorted = evals.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const recent = sorted.slice(-3);
    const older = sorted.slice(-6, -3);
    
    if (older.length === 0) return 'insufficient data';
    
    const recentAvg = recent.reduce((sum, e) => sum + (e.overallScore || 0), 0) / recent.length;
    const olderAvg = older.reduce((sum, e) => sum + (e.overallScore || 0), 0) / older.length;
    
    const diff = recentAvg - olderAvg;
    if (diff > 0.2) return 'improving';
    if (diff < -0.2) return 'declining';
    return 'stable';
  };

  // Get legacy category name from behavior item ID - EXACT COPY FROM HISTORY TAB
  const getLegacyCategoryName = (behaviorItemId: string) => {
    // Extract category from behavior item ID patterns
    if (behaviorItemId.includes('_prep')) return 'preparation';
    if (behaviorItemId.includes('_prob')) return 'problemDefinition';
    if (behaviorItemId.includes('_obj')) return 'objections';
    if (behaviorItemId.includes('_prop')) return 'commercial';
    
    const legacyMappings: Record<string, string> = {
      // Coaching items
      'obs1': 'Observation & Intervention During Client Meeting',
      'obs2': 'Observation & Intervention During Client Meeting',
      'obs3': 'Observation & Intervention During Client Meeting',
      'obs4': 'Observation & Intervention During Client Meeting',
      'env1': 'Creating Coaching Environment',
      'env2': 'Creating Coaching Environment',
      'env3': 'Creating Coaching Environment',
      'fb1': 'Quality of Analysis & Feedback',
      'fb2': 'Quality of Analysis & Feedback',
      'fb3': 'Quality of Analysis & Feedback',
      'act1': 'Translating Into Action',
      'act2': 'Translating Into Action',
      'act3': 'Translating Into Action',
      
      // Sales behavior categories - simple format
      'discovery': 'discovery',
      'solution': 'solution',
      'closing': 'closing',
      'professionalism': 'professionalism'
    };
    
    return legacyMappings[behaviorItemId] || behaviorItemId;
  };

  // Get translated category name - EXACT COPY FROM HISTORY TAB
  const getCategoryTranslationKey = (categoryName: string): string => {
    const categoryMap: Record<string, string> = {
      // Coaching categories
      'Observation & Intervention During Client Meeting': 'observationIntervention',
      'Creating Coaching Environment': 'creatingCoachingEnvironment',
      'Quality of Analysis & Feedback': 'qualityAnalysisFeedback',
      'Translating Into Action': 'translatingIntoAction',
      
      // Sales behavior categories - simple format
      'preparation': 'preparation',
      'problemDefinition': 'problemDefinition',
      'objections': 'objections',
      'commercial': 'commercial',
      
      // Legacy sales behavior categories
      'Preparation Before the Meeting': 'preparation',
      'Problem Definition': 'problemDefinition',
      'Handling Objections': 'objections',
      'Commercial Proposal': 'commercial',
      'Discovery & Needs Assessment': 'discovery',
      'Solution Positioning': 'solution',
      'Closing & Next Steps': 'closing',
      'Professionalism': 'professionalism'
    };
    return categoryMap[categoryName] || categoryName;
  };

  // Group evaluations by category/cluster
  const getAveragePerCluster = (evals: Evaluation[]) => {
    const clusters: { [key: string]: { total: number; count: number; originalName: string } } = {};
    
    console.log('📊 Analytics: Processing', evals.length, 'evaluations for cluster averages');
    
    evals.forEach((evaluation, evalIndex) => {
      if (evaluation.items && Array.isArray(evaluation.items)) {
        console.log(`📊 Analytics: Evaluation ${evalIndex + 1} has ${evaluation.items.length} items`);
        
        evaluation.items.forEach((item: any, itemIndex) => {
          // Use the same logic as EvaluationHistory to determine category name
          const categoryName = item.behaviorItem?.category?.name === 'Unknown Category'
            ? getLegacyCategoryName(item.behaviorItemId)
            : item.behaviorItem?.category?.name || getLegacyCategoryName(item.behaviorItemId);
          
          console.log(`📊 Analytics: Item ${itemIndex + 1} - behaviorItemId: ${item.behaviorItemId}, category: ${categoryName}, rating: ${item.rating || item.score}`);
          
          // Normalize category name to avoid duplicates - use a more robust normalization
          let normalizedCategoryName = categoryName.toLowerCase().trim();
          
          // Only normalize sales behavior categories - leave coaching categories as-is
          if (normalizedCategoryName.includes('preparation') || normalizedCategoryName.includes('prep') || 
              normalizedCategoryName.includes('подготовка') || normalizedCategoryName.includes('preparation before')) {
            normalizedCategoryName = 'preparation';
          } else if (normalizedCategoryName.includes('problem') || normalizedCategoryName.includes('prob') || 
                     normalizedCategoryName.includes('дефиниране') || normalizedCategoryName.includes('problem definition')) {
            normalizedCategoryName = 'problemdefinition';
          } else if (normalizedCategoryName.includes('objection') || normalizedCategoryName.includes('obj') || 
                     normalizedCategoryName.includes('възражения') || normalizedCategoryName.includes('handling objections')) {
            normalizedCategoryName = 'objections';
          } else if (normalizedCategoryName.includes('commercial') || normalizedCategoryName.includes('prop') || 
                     normalizedCategoryName.includes('комерсиално') || normalizedCategoryName.includes('търговско') || 
                     normalizedCategoryName.includes('commercial proposal')) {
            normalizedCategoryName = 'commercial';
          }
          // Note: Coaching categories (obs, env, fb, act) are NOT normalized - they keep their original names
          
          console.log(`📊 Analytics: Original: "${categoryName}" -> Normalized: "${normalizedCategoryName}"`);
          
          if (!clusters[normalizedCategoryName]) {
            clusters[normalizedCategoryName] = { total: 0, count: 0, originalName: categoryName };
          }
          clusters[normalizedCategoryName].total += (item.rating || item.score || 0);
          clusters[normalizedCategoryName].count += 1;
        });
      }
    });
    
    console.log('📊 Analytics: Final clusters calculated:', Object.keys(clusters));
    console.log('📊 Analytics: Cluster details:', Object.entries(clusters).map(([key, data]) => ({
      key,
      total: data.total,
      count: data.count,
      average: data.total / data.count,
      originalName: data.originalName
    })));

    return Object.entries(clusters)
      .map(([normalizedName, data]) => ({
        name: t(getCategoryTranslationKey(data.originalName), { ns: 'salesperson' }),
        average: data.count > 0 ? data.total / data.count : 0,
        percentage: data.count > 0 ? calculatePercentage(data.total / data.count) : 0,
        originalName: data.originalName
      }))
      .sort((a, b) => {
        // Sort by original category name for consistent ordering
        const order = ['preparation', 'problemDefinition', 'objections', 'commercial', 'discovery', 'solution', 'closing', 'professionalism'];
        const aIndex = order.indexOf(a.originalName);
        const bIndex = order.indexOf(b.originalName);
        
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.originalName.localeCompare(b.originalName);
      });
  };

  const getAveragePerSalesperson = (evals: Evaluation[]) => {
    const salespeople: { [key: string]: { total: number; count: number; name: string } } = {};
    
    evals.forEach(evaluation => {
      const salespersonName = evaluation.salesperson?.displayName || evaluation.salesperson?.firstName || 'Unknown';
      if (!salespeople[salespersonName]) {
        salespeople[salespersonName] = { total: 0, count: 0, name: salespersonName };
      }
      salespeople[salespersonName].total += (evaluation.overallScore || 0);
      salespeople[salespersonName].count += 1;
    });

    return Object.entries(salespeople)
      .map(([name, data]) => ({
        name: data.name,
        average: data.count > 0 ? data.total / data.count : 0,
        percentage: data.count > 0 ? calculatePercentage(data.total / data.count) : 0
      }))
      .sort((a, b) => b.average - a.average);
  };

  const { coachingEvaluations, salesBehavioursEvaluations } = separateEvaluations();
  
  // For team cluster averages, we need to separate coaching vs sales behavior evaluations
  // Only use sales behavior evaluations for the team cluster averages
  const salesBehaviorEvaluations = evaluations.filter(evaluation => {
    // Check if this evaluation contains ONLY sales behavior items (prep, prob, obj, prop)
    // and NO coaching items (obs, env, fb, act)
    if (!evaluation.items || !Array.isArray(evaluation.items)) return false;
    
    const hasSalesBehaviorItems = evaluation.items.some(item => {
      const behaviorItemId = item.behaviorItemId || '';
      return behaviorItemId.includes('_prep') || behaviorItemId.includes('_prob') || 
             behaviorItemId.includes('_obj') || behaviorItemId.includes('_prop');
    });
    
    const hasCoachingItems = evaluation.items.some(item => {
      const behaviorItemId = item.behaviorItemId || '';
      return behaviorItemId.includes('_obs') || behaviorItemId.includes('_env') || 
             behaviorItemId.includes('_fb') || behaviorItemId.includes('_act');
    });
    
    // Only include evaluations that have sales behavior items but NO coaching items
    return hasSalesBehaviorItems && !hasCoachingItems;
  });
  
  console.log('📊 Analytics: Total evaluations:', evaluations.length);
  console.log('📊 Analytics: Sales behavior evaluations:', salesBehaviorEvaluations.length);
  console.log('📊 Analytics: Coaching evaluations:', evaluations.length - salesBehaviorEvaluations.length);
  
  // Debug: Log sample evaluation types
  evaluations.slice(0, 3).forEach((evaluation, index) => {
    if (evaluation.items && Array.isArray(evaluation.items)) {
      const sampleItems = evaluation.items.slice(0, 3).map(item => item.behaviorItemId);
      console.log(`📊 Analytics: Evaluation ${index + 1} sample items:`, sampleItems);
    }
  });
  
  // Only use sales behavior evaluations for team cluster averages
  const teamClusterAverages = getAveragePerCluster(salesBehaviorEvaluations);
  
  // My Performance metrics (coaching evaluations about me)
  const myAverageScore = calculateAverageScore(coachingEvaluations);
  const myPercentage = calculatePercentage(myAverageScore);
  const myDistribution = getScoreDistribution(coachingEvaluations);
  const myTrend = getRecentTrend(coachingEvaluations);
  const myClusterAverages = getAveragePerCluster(coachingEvaluations);
  
  // Team Performance metrics (sales behaviours by me)
  const teamAverageScore = calculateAverageScore(salesBehavioursEvaluations);
  const teamPercentage = calculatePercentage(teamAverageScore);
  const teamDistribution = getScoreDistribution(salesBehavioursEvaluations);
  const teamTrend = getRecentTrend(salesBehavioursEvaluations);
  const salespersonAverages = getAveragePerSalesperson(salesBehavioursEvaluations);
  
  console.log('📊 Analytics: Total evaluations loaded:', evaluations.length);
  console.log('📊 Analytics: Team cluster averages (from ALL evaluations):', teamClusterAverages);

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

  return (
    <div className="analytics-view">
      <div className="analytics-header">
        <h2>{t('analytics.title')}</h2>
        <p>{t('analytics.subtitle')}</p>
      </div>

      {/* Sub-tabs like History page */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'my-performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-performance')}
        >
          <span className="tab-icon">👨‍🏫</span>
          <span className="tab-text">
            {user?.role === 'REGIONAL_SALES_MANAGER' 
              ? t('analytics.myTeamCoachingPerformance')
              : t('analytics.myPerformance')
            }
          </span>
          <span className="tab-count">({coachingEvaluations.length})</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'team-performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('team-performance')}
        >
          <span className="tab-icon">👥</span>
          <span className="tab-text">{t('analytics.myTeamPerformance')}</span>
          <span className="tab-count">({salesBehavioursEvaluations.length})</span>
        </button>
      </div>

      {/* My Performance Tab */}
      {activeTab === 'my-performance' && (
        <div className="analytics-grid">
          <div className="analytics-card">
            <div className="card-header">
              <h3>
                {user?.role === 'REGIONAL_SALES_MANAGER' 
                  ? t('analytics.myCoachingPerformance')
                  : t('analytics.myOERCoachingScore')
                }
              </h3>
              <span className="card-icon">👨‍🏫</span>
            </div>
            <div className="card-content">
              <div className="score-display">
                <span className="score-value">{myPercentage}%</span>
                <span className="score-label">{t('analytics.averageScore')} ({myAverageScore.toFixed(2)}/4)</span>
              </div>
              <div className="score-trend">
                <span className="trend-label">{t('analytics.trendImproving').split(':')[0]}:</span>
                <span className={`trend-value ${myTrend}`}>{myTrend}</span>
              </div>
            </div>
          </div>

          <div className="analytics-card">
            <div className="card-header">
              <h3>{t('analytics.performanceByCluster')}</h3>
              <span className="card-icon">🎯</span>
            </div>
            <div className="card-content">
              <div className="distribution">
                {myClusterAverages.length > 0 ? (
                  myClusterAverages.map((cluster, index) => (
                    <div key={index} className="distribution-item">
                      <span className="distribution-label">{cluster.name}</span>
                      <span className="distribution-value">{cluster.percentage}%</span>
                    </div>
                  ))
                ) : (
                  <div className="no-data">{t('analytics.noClusterData')}</div>
                )}
              </div>
            </div>
          </div>

          <div className="analytics-card">
            <div className="card-header">
              <h3>{t('analytics.scoreDistribution')}</h3>
              <span className="card-icon">📊</span>
            </div>
            <div className="card-content">
              <div className="distribution">
                <div className="distribution-item">
                  <span className="distribution-label">{t('analytics.excellent')}</span>
                  <span className="distribution-value">{myDistribution.excellent}</span>
                </div>
                <div className="distribution-item">
                  <span className="distribution-label">{t('analytics.good')}</span>
                  <span className="distribution-value">{myDistribution.good}</span>
                </div>
                <div className="distribution-item">
                  <span className="distribution-label">{t('analytics.average')}</span>
                  <span className="distribution-value">{myDistribution.average}</span>
                </div>
                <div className="distribution-item">
                  <span className="distribution-label">{t('analytics.poor')}</span>
                  <span className="distribution-value">{myDistribution.poor}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Performance Tab */}
      {activeTab === 'team-performance' && (
        <div className="analytics-grid">
          <div className="analytics-card">
            <div className="card-header">
              <h3>{t('analytics.teamPerformance')}</h3>
              <span className="card-icon">👥</span>
            </div>
            <div className="card-content">
              <div className="score-display">
                <span className="score-value">{teamPercentage}%</span>
                <span className="score-label">{t('analytics.averageScore')} ({teamAverageScore.toFixed(2)}/4)</span>
              </div>
              <div className="score-trend">
                <span className="trend-label">{t('analytics.trendImproving').split(':')[0]}:</span>
                <span className={`trend-value ${teamTrend}`}>{teamTrend}</span>
              </div>
            </div>
          </div>

          <div className="analytics-card">
            <div className="card-header">
              <h3>{t('analytics.teamAveragePerCluster')}</h3>
              <span className="card-icon">🎯</span>
            </div>
            <div className="card-content">
              <div className="distribution">
                {teamClusterAverages.length > 0 ? (
                  teamClusterAverages.map((cluster, index) => (
                    <div key={index} className="distribution-item">
                      <span className="distribution-label">{cluster.name}</span>
                      <span className="distribution-value">{cluster.percentage}%</span>
                    </div>
                  ))
                ) : (
                  <div className="no-data">{t('analytics.noClusterData')}</div>
                )}
              </div>
            </div>
          </div>

          <div className="analytics-card">
            <div className="card-header">
              <h3>{t('analytics.scoreDistribution')}</h3>
              <span className="card-icon">📈</span>
            </div>
            <div className="card-content">
              <div className="distribution">
                <div className="distribution-item">
                  <span className="distribution-label">{t('analytics.excellent')}</span>
                  <span className="distribution-value">{teamDistribution.excellent}</span>
                </div>
                <div className="distribution-item">
                  <span className="distribution-label">{t('analytics.good')}</span>
                  <span className="distribution-value">{teamDistribution.good}</span>
                </div>
                <div className="distribution-item">
                  <span className="distribution-label">{t('analytics.average')}</span>
                  <span className="distribution-value">{teamDistribution.average}</span>
                </div>
                <div className="distribution-item">
                  <span className="distribution-label">{t('analytics.poor')}</span>
                  <span className="distribution-value">{teamDistribution.poor}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="analytics-card">
            <div className="card-header">
              <h3>{t('analytics.performanceBySalesperson')}</h3>
              <span className="card-icon">👤</span>
            </div>
            <div className="card-content">
              <div className="distribution">
                {salespersonAverages.length > 0 ? (
                  salespersonAverages.map((salesperson, index) => (
                    <div key={index} className="distribution-item">
                      <span className="distribution-label">{salesperson.name}</span>
                      <span className="distribution-value">{salesperson.percentage}%</span>
                    </div>
                  ))
                ) : (
                  <div className="no-data">No salesperson data yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsView;