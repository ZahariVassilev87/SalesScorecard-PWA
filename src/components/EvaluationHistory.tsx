import React, { useState, useEffect } from 'react';
import { apiService, Evaluation } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const coachingCategoryKeys = new Set([
  'observationIntervention',
  'creatingCoachingEnvironment',
  'qualityAnalysisFeedback',
  'translatingIntoAction'
]);

const coachingItemKeys = new Set([
  'letSalespersonLead',
  'providedSupport',
  'steppedInValue',
  'activelyListened',
  'calmAtmosphere',
  'askedSelfAssessment',
  'listenedAttentively',
  'startedPositive',
  'concreteExamples',
  'identifiedImprovement',
  'setClearTasks',
  'reachedAgreement',
  'encouragedGoal'
]);

const EvaluationHistory: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [activeTab, setActiveTab] = useState<'created' | 'about'>('created');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadEvaluations = async () => {
      try {
        console.log('🔄 Loading evaluations...');
        const data = await apiService.getMyEvaluations();
        console.log('📊 Loaded evaluations:', data);
        setEvaluations(data);
      } catch (err) {
        setError(t('history.loading'));
        console.error('Failed to load evaluations:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadEvaluations();
  }, [t]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('bg-BG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getScoreColor = (score?: number) => {
    if (!score) return '#8e8e93';
    if (score >= 4) return '#34c759'; // Excellent
    if (score >= 3) return '#32d74b'; // Good
    if (score >= 2) return '#ff9500'; // Fair
    return '#ff3b30'; // Poor
  };

  const calculateCategoryScore = (evaluation: Evaluation, categoryName: string) => {
    const categoryItems = evaluation.items.filter(item => {
      const itemCategoryName = item.behaviorItem.category?.name === 'Unknown Category' 
        ? getLegacyCategoryName(item.behaviorItemId)
        : item.behaviorItem.category?.name || getLegacyCategoryName(item.behaviorItemId);
      return itemCategoryName === categoryName;
    });
    
    if (categoryItems.length === 0) return 0;
    
    const totalScore = categoryItems.reduce((sum, item) => sum + item.rating, 0);
    const avgScore = totalScore / categoryItems.length;
    return avgScore;
  };

  // Get legacy category name for old evaluation IDs
  const getLegacyCategoryName = (behaviorItemId: string) => {
    // Extract category from behavior item ID
    if (behaviorItemId.includes('_prep')) return 'preparation';
    if (behaviorItemId.includes('_prob')) return 'problemDefinition';
    if (behaviorItemId.includes('_obj')) return 'objections';
    if (behaviorItemId.includes('_prop')) return 'commercial';
    
    const legacyMappings: Record<string, string> = {
      // Coaching observation items
      'obs1': 'Observation & Intervention During Client Meeting',
      'obs2': 'Observation & Intervention During Client Meeting',
      'obs3': 'Observation & Intervention During Client Meeting',
      'obs4': 'Observation & Intervention During Client Meeting',
      
      // Coaching environment items
      'env1': 'Creating Coaching Environment',
      'env2': 'Creating Coaching Environment',
      'env3': 'Creating Coaching Environment',
      
      // Coaching feedback items
      'fb1': 'Quality of Analysis & Feedback',
      'fb2': 'Quality of Analysis & Feedback',
      'fb3': 'Quality of Analysis & Feedback',
      
      // Coaching action items
      'act1': 'Translating Into Action',
      'act2': 'Translating Into Action',
      'act3': 'Translating Into Action',
      
      // Sales Behavior Categories - Simple format
      'prep1': 'preparation',
      'prep2': 'preparation',
      'prep3': 'preparation',
      'prep4': 'preparation',
      'prep5': 'preparation',
      'prep6': 'preparation',
      'prep7': 'preparation',
      
      'prob1': 'problemDefinition',
      'prob2': 'problemDefinition',
      'prob3': 'problemDefinition',
      'prob4': 'problemDefinition',
      
      'obj1': 'objections',
      'obj2': 'objections',
      'obj3': 'objections',
      
      'prop1': 'commercial',
      'prop2': 'commercial',
      'prop3': 'commercial',
      'prop4': 'commercial',
      
      // Generic sales behavior categories
      'discovery': 'discovery',
      'solution': 'solution',
      'closing': 'closing',
      'professionalism': 'professionalism'
    };
    
    return legacyMappings[behaviorItemId] || 'Unknown Category';
  };

  // Get legacy item name for old evaluation IDs
  const getLegacyItemName = (behaviorItemId: string) => {
    // Handle the specific format: salesperson_LOW_SHARE_prep1, etc.
    if (behaviorItemId.includes('_prep1')) return 'Identified core products the client uses (in their menu) but does not buy from METRO';
    if (behaviorItemId.includes('_prep2')) return 'Determined type of establishment (restaurant/hotel) and cuisine style';
    if (behaviorItemId.includes('_prep3')) return 'Selected 1–2 focus products for the meeting';
    if (behaviorItemId.includes('_prep4')) return 'Knows where the client currently orders from and why';
    if (behaviorItemId.includes('_prep5')) return 'Analyzed client\'s restaurant prices and quality/price preferences';
    if (behaviorItemId.includes('_prep6')) return 'Prepared strategy for focus product (e.g. which mozzarella, which brand)';
    if (behaviorItemId.includes('_prep7')) return 'Visit aligned with METRO contact model';
    
    if (behaviorItemId.includes('_prob1')) return 'Asked about client\'s experience with current supplier';
    if (behaviorItemId.includes('_prob2')) return 'Checked for issues with price, quality, and delivery';
    if (behaviorItemId.includes('_prob3')) return 'Clarified how issues affect client\'s business';
    if (behaviorItemId.includes('_prob4')) return 'Explored problem with a core product METRO does not supply';
    
    if (behaviorItemId.includes('_obj1')) return 'Listened fully to objection without interrupting';
    if (behaviorItemId.includes('_obj2')) return 'Validated client\'s perspective';
    if (behaviorItemId.includes('_obj3')) return 'Put objection in market context & showed METRO\'s response';
    
    if (behaviorItemId.includes('_prop1')) return 'Presented product as solution to specific problem';
    if (behaviorItemId.includes('_prop2')) return 'Demonstrated product benefits with concrete examples';
    if (behaviorItemId.includes('_prop3')) return 'Proposed test of key products';
    if (behaviorItemId.includes('_prop4')) return 'Agreed on clear next step';
    
    const legacyMappings: Record<string, string> = {
      // Coaching items
      'obs1': 'Let salesperson lead the conversation',
      'obs2': 'Provided support when needed',
      'obs3': 'Stepped in with added value at right time',
      'obs4': 'Actively listened to client and salesperson',
      'env1': 'Ensured calm and safe atmosphere',
      'env2': 'Asked salesperson for self-assessment / feelings',
      'env3': 'Listened attentively without interrupting',
      'fb1': 'Started with positive practices',
      'fb2': 'Gave concrete examples from client meeting',
      'fb3': 'Identified areas for improvement with examples',
      'act1': 'Set clear tasks for a specific period',
      'act2': 'Reached agreement on evaluation and next steps',
      'act3': 'Encouraged salesperson to set a personal goal/commitment'
    };
    
    return legacyMappings[behaviorItemId] || behaviorItemId;
  };

  // Map English category names to translation keys
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

  // Map English behavior item names to translation keys
  const getBehaviorItemTranslationKey = (itemName: string): string => {
    const itemMap: Record<string, string> = {
      // Coaching items
      'Let salesperson lead the conversation': 'letSalespersonLead',
      'Provided support when needed': 'providedSupport',
      'Stepped in with added value at right time': 'steppedInValue',
      'Actively listened to client and salesperson': 'activelyListened',
      'Ensured calm and safe atmosphere': 'calmAtmosphere',
      'Asked salesperson for self-assessment / feelings': 'askedSelfAssessment',
      'Listened attentively without interrupting': 'listenedAttentively',
      'Started with positive practices': 'startedPositive',
      'Gave concrete examples from client meeting': 'concreteExamples',
      'Identified areas for improvement with examples': 'identifiedImprovement',
      'Set clear tasks for a specific period': 'setClearTasks',
      'Reached agreement on evaluation and next steps': 'reachedAgreement',
      'Encouraged salesperson to set a personal goal/commitment': 'encouragedGoal',
      
      // Sales behavior items - exact English descriptions from getLegacyItemName
      'Identified core products the client uses (in their menu) but does not buy from METRO': 'Identified core products the client uses (in their menu) but does not buy from METRO',
      'Determined type of establishment (restaurant/hotel) and cuisine style': 'Determined type of establishment (restaurant/hotel) and cuisine style',
      'Selected 1–2 focus products for the meeting': 'Selected 1–2 focus products for the meeting',
      'Knows where the client currently orders from and why': 'Knows where the client currently orders from and why',
      'Analyzed client\'s restaurant prices and quality/price preferences': 'Analyzed client\'s restaurant prices and quality/price preferences',
      'Prepared strategy for focus product (e.g. which mozzarella, which brand)': 'Prepared strategy for focus product (e.g. which mozzarella, which brand)',
      'Visit aligned with METRO contact model': 'Visit aligned with METRO contact model',
      
      'Asked about client\'s experience with current supplier': 'Asked about client\'s experience with current supplier',
      'Checked for issues with price, quality, and delivery': 'Checked for issues with price, quality, and delivery',
      'Clarified how issues affect client\'s business': 'Clarified how issues affect client\'s business',
      'Explored problem with a core product METRO does not supply': 'Explored problem with a core product METRO does not supply',
      
      'Listened fully to objection without interrupting': 'Listened fully to objection without interrupting',
      'Validated client\'s perspective': 'Validated client\'s perspective',
      'Put objection in market context & showed METRO\'s response': 'Put objection in market context & showed METRO\'s response',
      
      'Presented product as solution to specific problem': 'Presented product as solution to specific problem',
      'Demonstrated product benefits with concrete examples': 'Demonstrated product benefits with concrete examples',
      'Proposed test of key products': 'Proposed test of key products',
      'Agreed on clear next step': 'Agreed on clear next step',
      
      // Legacy sales behavior items
      'Research and preparation': 'sales:researchPreparation',
      'Agenda setting': 'sales:agendaSetting',
      'Materials preparation': 'sales:materialsPreparation',
      'Objective setting': 'sales:objectiveSetting',
      'Needs identification': 'sales:needsIdentification',
      'Pain point analysis': 'sales:painPointAnalysis',
      'Problem prioritization': 'sales:problemPrioritization',
      'Impact assessment': 'sales:impactAssessment',
      'Objection acknowledgment': 'sales:objectionAcknowledgment',
      'Objection exploration': 'sales:objectionExploration',
      'Solution presentation': 'sales:solutionPresentation',
      'Objection resolution': 'sales:objectionResolution',
      'Value proposition': 'sales:valueProposition',
      'Pricing presentation': 'sales:pricingPresentation',
      'Terms negotiation': 'sales:termsNegotiation',
      'Closing approach': 'sales:closingApproach'
    };
    return itemMap[itemName] || itemName;
  };

  const translateCategoryName = (categoryName: string) => {
    const key = getCategoryTranslationKey(categoryName);
    const namespace = coachingCategoryKeys.has(key) ? 'coaching' : 'salesperson';
    const translated = t(key, { ns: namespace });
    return translated === key ? categoryName : translated;
  };

  const translateItemName = (itemName: string) => {
    const key = getBehaviorItemTranslationKey(itemName);
    const namespace = coachingItemKeys.has(key) ? 'coaching' : 'salesperson';
    const translated = t(key, { ns: namespace });
    return translated === key ? itemName : translated;
  };

  // Get unique categories from evaluation items
  const getCategoriesFromEvaluation = (evaluation: Evaluation) => {
    const categories = new Set<string>();
    
    evaluation.items.forEach(item => {
      const legacyCategoryName = getLegacyCategoryName(item.behaviorItemId);
      
      const categoryName = item.behaviorItem.category?.name === 'Unknown Category' 
        ? legacyCategoryName
        : item.behaviorItem.category?.name || legacyCategoryName;
      
      if (categoryName) {
        categories.add(categoryName);
      }
    });
    
    return Array.from(categories);
  };

  // Separate evaluations into two categories
  const separateEvaluations = () => {
    if (!user) return { evaluationsICreated: [], evaluationsAboutMe: [] };

    const evaluationsICreated = evaluations.filter(evaluation => 
      evaluation.managerId === user.id
    );

    const evaluationsAboutMe = evaluations.filter(evaluation => 
      evaluation.salespersonId === user.id
    );

    return { evaluationsICreated, evaluationsAboutMe };
  };

  const { evaluationsICreated, evaluationsAboutMe } = separateEvaluations();

  // Get evaluations for the active tab
  const getCurrentEvaluations = () => {
    if (activeTab === 'created') {
      return evaluationsICreated;
    } else {
      return evaluationsAboutMe;
    }
  };

  const currentEvaluations = getCurrentEvaluations();

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  const isMobile = () => window.innerWidth <= 768;

  const toggleAllCategories = () => {
    const categories = getCategoriesFromEvaluation(selectedEvaluation || evaluations[0]);
    const allExpanded = categories.every(cat => expandedCategories.has(cat));
    
    if (allExpanded) {
      setExpandedCategories(new Set());
    } else {
      setExpandedCategories(new Set(categories));
    }
  };

  if (isLoading) {
    return (
      <div className="evaluation-history">
        <div className="loading">{t('history.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="evaluation-history">
        <div className="error">{error}</div>
      </div>
    );
  }

  // Always show the tabbed interface, even when there are no evaluations

  return (
    <div className="evaluation-history">
      <div className="history-header">
        <h2>{t('historyTitle')}</h2>
        <p>{t('historySubtitle')}</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'created' ? 'active' : ''}`}
          onClick={() => setActiveTab('created')}
        >
          <span className="tab-icon">📝</span>
          <span className="tab-text">{t('history.evaluationsICreated')}</span>
          <span className="tab-count">({evaluationsICreated.length})</span>
        </button>
        <button 
          className={`tab-button ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          <span className="tab-icon">👤</span>
          <span className="tab-text">{t('history.evaluationsAboutMe')}</span>
          <span className="tab-count">({evaluationsAboutMe.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {currentEvaluations.length === 0 ? (
          <div className="no-evaluations">
            <h3>{t('history.noEvaluationsYet')}</h3>
            <p>
              {activeTab === 'created' 
                ? t('history.youHaventCreated')
                : t('history.noEvaluationsAboutYou')
              }
            </p>
          </div>
        ) : (
          <div className="evaluations-grid">
            {currentEvaluations.map(evaluation => (
              <div key={evaluation.id} className="evaluation-card">
                <div className="evaluation-header">
                  <div className="evaluation-info">
                    <div className="evaluation-title">
                      <h3>{evaluation.salesperson.displayName || evaluation.salesperson.name || `${evaluation.salesperson.firstName} ${evaluation.salesperson.lastName}`}</h3>
                      <span className="evaluation-date">{formatDate(evaluation.visitDate)}</span>
                    </div>
                    
                    <div className="evaluation-details">
                    {evaluation.customerName && (
                        <div className="detail-item">
                          <span className="detail-label">{t('history.customer')}</span>
                          <span className="detail-value">{evaluation.customerName}</span>
                        </div>
                    )}
                    {evaluation.location && (
                        <div className="detail-item">
                          <span className="detail-label">{t('history.location')}</span>
                          <span className="detail-value">📍 {evaluation.location}</span>
                        </div>
                    )}
                    </div>
                  </div>
                  
                  <div className="overall-score">
                    <span 
                      className="score-value"
                      style={{ color: getScoreColor(evaluation.overallScore) }}
                    >
                      {evaluation.overallScore != null ? `${((evaluation.overallScore / 4) * 100).toFixed(0)}%` : 'N/A'}
                    </span>
                    <span className="score-label">{t('history.overall')}</span>
                  </div>
                </div>

                <div className="category-scores">
                  {getCategoriesFromEvaluation(evaluation).map(categoryName => {
                    const score = calculateCategoryScore(evaluation, categoryName);
                    const percentage = ((score / 4) * 100).toFixed(0);
                    return (
                      <div key={categoryName} className="category-score">
                        <span className="category-name">{translateCategoryName(categoryName)}</span>
                    <span 
                      className="score" 
                          style={{ color: getScoreColor(score) }}
                    >
                          {percentage}%
                    </span>
                  </div>
                    );
                  })}
                </div>

                {evaluation.overallComment && (
                  <div className="overall-comment">
                    <p><strong>{t('history.overallComment')}:</strong></p>
                    <p>{evaluation.overallComment}</p>
                  </div>
                )}

                <button 
                  className="view-details-button"
                  onClick={() => setSelectedEvaluation(evaluation)}
                >
{t('history.details')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedEvaluation && (
        <div className="evaluation-modal">
          <div className="modal-content">
            <div className="modal-header">
                <h3>{t('history.evaluationDetails')}</h3>
              <button 
                className="close-button"
                onClick={() => setSelectedEvaluation(null)}
              >
                {t('history.close')}
              </button>
            </div>
            
            <button 
              className="modal-close-x"
              onClick={() => setSelectedEvaluation(null)}
              title="Close"
            >
              ×
            </button>
            
            <div className="modal-body">
              <div className="evaluation-details">
                <h4>{selectedEvaluation.salesperson.displayName || selectedEvaluation.salesperson.name || `${selectedEvaluation.salesperson.firstName} ${selectedEvaluation.salesperson.lastName}`}</h4>
                <p><strong>{t('history.date')}</strong> {formatDate(selectedEvaluation.visitDate)}</p>
                {selectedEvaluation.customerName && (
                  <p><strong>{t('history.customer')}</strong> {selectedEvaluation.customerName}</p>
                )}
                {selectedEvaluation.location && (
                  <p><strong>{t('history.location')}</strong> {selectedEvaluation.location}</p>
                )}
              </div>

              {isMobile() && (
                <div className="mobile-controls">
                  <button 
                    className="toggle-all-button"
                    onClick={toggleAllCategories}
                  >
                    {getCategoriesFromEvaluation(selectedEvaluation).every(cat => expandedCategories.has(cat)) 
                      ? t('history.collapseAll') 
                      : t('history.expandAll')
                    }
                  </button>
                </div>
              )}

              <div className="detailed-scores">
                {getCategoriesFromEvaluation(selectedEvaluation).map(categoryName => {
                  const categoryItems = selectedEvaluation.items.filter(item => {
                    const itemCategoryName = item.behaviorItem.category?.name === 'Unknown Category'
                      ? getLegacyCategoryName(item.behaviorItemId)
                      : item.behaviorItem.category?.name || getLegacyCategoryName(item.behaviorItemId);
                    return itemCategoryName === categoryName;
                  });
                  
                  if (categoryItems.length === 0) return null;
                  
                  const isExpanded = expandedCategories.has(categoryName);
                  const showCollapsible = isMobile();
                  
                  return (
                    <div key={categoryName} className="category-detail">
                      <div 
                        className="category-header"
                        onClick={() => showCollapsible && toggleCategory(categoryName)}
                        style={{ cursor: showCollapsible ? 'pointer' : 'default' }}
                      >
                        <h5>{translateCategoryName(categoryName)}</h5>
                        {showCollapsible && (
                          <span className="category-toggle">
                            {isExpanded ? '−' : '+'}
                          </span>
                            )}
                          </div>
                      {(!showCollapsible || isExpanded) && (
                        <div className="category-items">
                          {categoryItems.map(item => {
                            const itemName = getLegacyItemName(item.behaviorItemId);
                            return (
                            <div key={item.id} className="item-detail">
                              <div className="item-name">{translateItemName(itemName)}</div>
                              <div className="item-score">
                                <span className="score">{item.rating}/4</span>
                              </div>
                              <div className="item-comment">
                                <div className="comment-label">{t('history.example')}</div>
                                <div className="comment-text">
                                  {(() => {
                                    // Handle empty or missing comments
                                    if (!item.comment) {
                                      return <em>{t('history.noExampleProvided')}</em>;
                                    }
                                    
                                    // Handle JSON comments
                                    if (typeof item.comment === 'string' && item.comment.startsWith('{')) {
                                      try {
                                        const parsed = JSON.parse(item.comment);
                                        // Check if this is just metadata (has behaviorItemId, itemName, categoryName)
                                        if (parsed.behaviorItemId && parsed.itemName && parsed.categoryName) {
                                          // This is metadata, not actual example text
                                          return <em>{t('history.noExampleProvided')}</em>;
                                        }
                                        // Return actual example text if it exists
                                        return parsed.text || parsed.comment || parsed.example || <em>{t('history.noExampleProvided')}</em>;
                                      } catch {
                                        return item.comment;
                                      }
                                    }
                                    
                                    // Handle plain text comments
                                    return item.comment || <em>{t('history.noExampleProvided')}</em>;
                                  })()}
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedEvaluation.overallComment && (
                <div className="overall-comment-detail">
                  <h5>{t('history.overallComment')}</h5>
                  <p>{selectedEvaluation.overallComment}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvaluationHistory;
