import React, { useState, useEffect } from 'react';
import { apiService, Evaluation } from '../services/api';

const EvaluationHistory: React.FC = () => {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);

  useEffect(() => {
    const loadEvaluations = async () => {
      try {
        const data = await apiService.getMyEvaluations();
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
    
    const totalScore = categoryItems.reduce((sum, item) => sum + item.score, 0);
    return totalScore / categoryItems.length;
  };

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

  if (evaluations.length === 0) {
    return (
      <div className="evaluation-history">
        <div className="no-evaluations">
          <h3>No Evaluations Yet</h3>
          <p>You haven't created any evaluations yet. Start by creating your first evaluation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="evaluation-history">
      <div className="history-header">
        <h2>Evaluation History</h2>
        <p>View and manage your past evaluations</p>
      </div>

      <div className="evaluations-grid">
        {evaluations.map(evaluation => (
          <div key={evaluation.id} className="evaluation-card">
            <div className="evaluation-header">
              <div className="evaluation-info">
                <h3>{evaluation.salesperson.displayName}</h3>
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
                <h4>{selectedEvaluation.salesperson.displayName}</h4>
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
                            <span className="score">{item.score}/5</span>
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
