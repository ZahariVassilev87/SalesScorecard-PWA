import React, { useState, useEffect } from 'react';
import { apiService, Evaluation } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const EvaluationHistory: React.FC = () => {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [activeTab, setActiveTab] = useState<'created' | 'about'>('created');

  useEffect(() => {
    const loadEvaluations = async () => {
      try {
        console.log('🔄 Loading evaluations...');
        const data = await apiService.getMyEvaluations();
        console.log('📊 Loaded evaluations:', data);
        setEvaluations(data);
      } catch (err) {
        setError('Failed to load evaluations');
        console.error('Failed to load evaluations:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadEvaluations();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getScoreColor = (score?: number) => {
    if (!score) return '#8e8e93';
    if (score >= 4) return '#34c759';
    if (score >= 3) return '#ff9500';
    return '#ff3b30';
  };

  const calculateCategoryScore = (evaluation: Evaluation, categoryName: string) => {
    const categoryItems = evaluation.items.filter(item => 
      item.behaviorItem.category?.name === categoryName
    );
    
    if (categoryItems.length === 0) return 0;
    
    const totalScore = categoryItems.reduce((sum, item) => sum + item.rating, 0);
    return totalScore / categoryItems.length;
  };

  // Separate evaluations into two categories
  const separateEvaluations = () => {
    if (!user) return { evaluationsICreated: [], evaluationsAboutMe: [] };

    const evaluationsICreated = evaluations.filter(evaluation => 
      evaluation.managerId === user.id
    );

    const evaluationsAboutMe = evaluations.filter(evaluation => 
      evaluation.managerId !== user.id
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

  if (isLoading) {
    return (
      <div className="evaluation-history">
        <div className="loading">Loading evaluations...</div>
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
        <h2>Evaluation History</h2>
        <p>View and manage your past evaluations</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'created' ? 'active' : ''}`}
          onClick={() => setActiveTab('created')}
        >
          <span className="tab-icon">📝</span>
          <span className="tab-text">Evaluations I Created</span>
          <span className="tab-count">({evaluationsICreated.length})</span>
        </button>
        <button 
          className={`tab-button ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          <span className="tab-icon">👤</span>
          <span className="tab-text">Evaluations About Me</span>
          <span className="tab-count">({evaluationsAboutMe.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {currentEvaluations.length === 0 ? (
          <div className="no-evaluations">
            <h3>No Evaluations Yet</h3>
            <p>
              {activeTab === 'created' 
                ? "You haven't created any evaluations yet. Start by creating your first evaluation."
                : "No evaluations have been created about you yet."
              }
            </p>
          </div>
        ) : (
          <div className="evaluations-grid">
            {currentEvaluations.map(evaluation => (
              <div key={evaluation.id} className="evaluation-card">
                <div className="evaluation-header">
                  <div className="evaluation-info">
                    <h3>{evaluation.salesperson.displayName || `${evaluation.salesperson.firstName} ${evaluation.salesperson.lastName}`}</h3>
                    <p className="evaluation-date">{formatDate(evaluation.visitDate)}</p>
                    {evaluation.customerName && (
                      <p className="customer-name">Customer: {evaluation.customerName}</p>
                    )}
                    {evaluation.location && (
                      <p className="location">📍 {evaluation.location}</p>
                    )}
                  </div>
                  <div className="overall-score">
                    <span 
                      className="score-value"
                      style={{ color: getScoreColor(evaluation.overallScore) }}
                    >
                      {evaluation.overallScore ? evaluation.overallScore.toFixed(1) : 'N/A'}
                    </span>
                    <span className="score-label">Overall</span>
                  </div>
                </div>

                <div className="category-scores">
                  <div className="category-score">
                    <span className="category-name">Discovery</span>
                    <span 
                      className="score" 
                      style={{ color: getScoreColor(calculateCategoryScore(evaluation, 'Discovery')) }}
                    >
                      {calculateCategoryScore(evaluation, 'Discovery').toFixed(1)}
                    </span>
                  </div>
                  <div className="category-score">
                    <span className="category-name">Solution</span>
                    <span 
                      className="score" 
                      style={{ color: getScoreColor(calculateCategoryScore(evaluation, 'Solution Positioning')) }}
                    >
                      {calculateCategoryScore(evaluation, 'Solution Positioning').toFixed(1)}
                    </span>
                  </div>
                  <div className="category-score">
                    <span className="category-name">Closing</span>
                    <span 
                      className="score" 
                      style={{ color: getScoreColor(calculateCategoryScore(evaluation, 'Closing & Next Steps')) }}
                    >
                      {calculateCategoryScore(evaluation, 'Closing & Next Steps').toFixed(1)}
                    </span>
                  </div>
                  <div className="category-score">
                    <span className="category-name">Professional</span>
                    <span 
                      className="score" 
                      style={{ color: getScoreColor(calculateCategoryScore(evaluation, 'Professionalism')) }}
                    >
                      {calculateCategoryScore(evaluation, 'Professionalism').toFixed(1)}
                    </span>
                  </div>
                </div>

                {evaluation.overallComment && (
                  <div className="overall-comment">
                    <p><strong>Overall Comment:</strong></p>
                    <p>{evaluation.overallComment}</p>
                  </div>
                )}

                <button 
                  className="view-details-button"
                  onClick={() => setSelectedEvaluation(evaluation)}
                >
                  View Details
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
              <h3>Evaluation Details</h3>
              <button 
                className="close-button"
                onClick={() => setSelectedEvaluation(null)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="evaluation-details">
                <h4>{selectedEvaluation.salesperson.displayName || `${selectedEvaluation.salesperson.firstName} ${selectedEvaluation.salesperson.lastName}`}</h4>
                <p><strong>Date:</strong> {formatDate(selectedEvaluation.visitDate)}</p>
                {selectedEvaluation.customerName && (
                  <p><strong>Customer:</strong> {selectedEvaluation.customerName}</p>
                )}
                {selectedEvaluation.location && (
                  <p><strong>Location:</strong> {selectedEvaluation.location}</p>
                )}
              </div>

              <div className="detailed-scores">
                {['Discovery', 'Solution Positioning', 'Closing & Next Steps', 'Professionalism'].map(categoryName => {
                  const categoryItems = selectedEvaluation.items.filter(item => 
                    item.behaviorItem.category?.name === categoryName
                  );
                  
                  if (categoryItems.length === 0) return null;
                  
                  return (
                    <div key={categoryName} className="category-detail">
                      <h5>{categoryName}</h5>
                      {categoryItems.map(item => (
                        <div key={item.id} className="item-detail">
                          <div className="item-name">{item.behaviorItem.name}</div>
                          <div className="item-score">
                            <span className="score">{item.rating}/5</span>
                            {item.comment && (
                              <div className="item-comment">{item.comment}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {selectedEvaluation.overallComment && (
                <div className="overall-comment-detail">
                  <h5>Overall Comment</h5>
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
