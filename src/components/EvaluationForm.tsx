import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService, User } from '../services/api';

interface EvaluationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const EvaluationForm: React.FC<EvaluationFormProps> = ({ onSuccess, onCancel }) => {
  const { user } = useAuth();
  const [evaluatableUsers, setEvaluatableUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [selectedUser, setSelectedUser] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [location, setLocation] = useState('');
  const [overallComment, setOverallComment] = useState('');

  // Evaluation scores and comments
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadEvaluatableUsers = async () => {
      try {
        const users = await apiService.getEvaluatableUsers();
        setEvaluatableUsers(users);
      } catch (err) {
        setError('Failed to load users for evaluation');
        console.error('Failed to load evaluatable users:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadEvaluatableUsers();
  }, []);

  const getEvaluationTitle = () => {
    if (!user) return 'New Evaluation';
    
    switch (user.role) {
      case 'SALES_DIRECTOR':
        return 'Regional Manager Evaluation';
      case 'REGIONAL_SALES_MANAGER':
      case 'REGIONAL_MANAGER':
        return 'Sales Lead Coaching Evaluation';
      case 'SALES_LEAD':
        return 'Salesperson Evaluation';
      default:
        return 'New Evaluation';
    }
  };

  const getEvaluationDescription = () => {
    if (!user) return 'Create a new evaluation';
    
    switch (user.role) {
      case 'SALES_DIRECTOR':
        return 'Evaluate Regional Manager performance and leadership';
      case 'REGIONAL_SALES_MANAGER':
      case 'REGIONAL_MANAGER':
        return 'Evaluate Sales Lead coaching abilities in the field';
      case 'SALES_LEAD':
        return 'Evaluate Salesperson performance during sales meetings';
      default:
        return 'Create a new evaluation';
    }
  };

  const getEvaluationCategories = () => {
    // All roles use the same evaluation structure as iOS app
    return [
      {
        id: 'discovery',
        name: 'Discovery',
        color: '#3B82F6',
        items: [
          { id: 'discovery-open-questions', name: 'Asks open-ended questions' },
          { id: 'discovery-pain-points', name: 'Uncovers customer pain points' },
          { id: 'discovery-decision-makers', name: 'Identifies decision makers' }
        ]
      },
      {
        id: 'solution',
        name: 'Solution Positioning',
        color: '#10B981',
        items: [
          { id: 'solution-tailors', name: 'Tailors solution to customer context' },
          { id: 'solution-value-prop', name: 'Articulates clear value proposition' },
          { id: 'solution-product-knowledge', name: 'Demonstrates product knowledge' }
        ]
      },
      {
        id: 'closing',
        name: 'Closing & Next Steps',
        color: '#F59E0B',
        items: [
          { id: 'closing-clear-asks', name: 'Makes clear asks' },
          { id: 'closing-next-steps', name: 'Identifies next steps' },
          { id: 'closing-commitments', name: 'Sets mutual commitments' }
        ]
      },
      {
        id: 'professionalism',
        name: 'Professionalism',
        color: '#8B5CF6',
        items: [
          { id: 'professionalism-prepared', name: 'Arrives prepared' },
          { id: 'professionalism-time', name: 'Manages time effectively' },
          { id: 'professionalism-demeanor', name: 'Maintains professional demeanor' }
        ]
      }
    ];
  };

  const handleScoreChange = (criteriaId: string, score: number) => {
    setScores(prev => ({ ...prev, [criteriaId]: score }));
  };

  const handleCommentChange = (criteriaId: string, comment: string) => {
    setComments(prev => ({ ...prev, [criteriaId]: comment }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setError('Please select a team member to evaluate');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const categories = getEvaluationCategories();
      const evaluationItems = categories.flatMap(category => 
        category.items.map(item => ({
          behaviorItemId: item.id,
          score: scores[item.id] || 0,
          comment: comments[item.id] || ''
        }))
      );

      await apiService.createEvaluation({
        salespersonId: selectedUser,
        visitDate,
        customerName: customerName || undefined,
        location: location || undefined,
        overallComment: overallComment || undefined,
        items: evaluationItems
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create evaluation');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="evaluation-form">
        <div className="loading">Loading evaluation form...</div>
      </div>
    );
  }

  if (!user || !canEvaluate(user.role)) {
    return (
      <div className="evaluation-form">
        <div className="error">You don't have permission to create evaluations.</div>
      </div>
    );
  }

  return (
    <div className="evaluation-form">
      <div className="form-header">
        <h2>{getEvaluationTitle()}</h2>
        <p>{getEvaluationDescription()}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>Evaluation Details</h3>
          
          <div className="form-group">
            <label htmlFor="user">Select Team Member to Evaluate *</label>
            <select
              id="user"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              required
            >
              <option value="">Choose a team member...</option>
              {evaluatableUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.displayName} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="visitDate">Evaluation Date *</label>
            <input
              type="date"
              id="visitDate"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="customerName">Customer/Context</label>
            <input
              type="text"
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name or context"
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">Location *</label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter where the sales meeting was conducted"
              required
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Evaluation Form</h3>
          <p>Rate each behavior on a scale of 1-5 (1 = Poor, 5 = Excellent)</p>

          {getEvaluationCategories().map(category => (
            <div key={category.id} className="evaluation-category" style={{ backgroundColor: `${category.color}10` }}>
              <h4 className="category-title" style={{ color: category.color }}>
                {category.name}
              </h4>
              
              {category.items.map(item => (
                <div key={item.id} className="behavior-item">
                  <div className="item-header">
                    <label className="item-label">{item.name}</label>
                    <div className="score-input">
                      {[1, 2, 3, 4, 5].map(score => (
                        <label key={score} className="score-option">
                          <input
                            type="radio"
                            name={`score-${item.id}`}
                            value={score}
                            checked={scores[item.id] === score}
                            onChange={() => handleScoreChange(item.id, score)}
                          />
                          <span className="score-number">{score}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <textarea
                    placeholder="Explain your rating..."
                    value={comments[item.id] || ''}
                    onChange={(e) => handleCommentChange(item.id, e.target.value)}
                    rows={2}
                    className="item-comment"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="form-section">
          <h3>Overall Assessment</h3>
          <div className="form-group">
            <label htmlFor="overallComment">Overall Comment</label>
            <textarea
              id="overallComment"
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              placeholder="Provide overall feedback and recommendations"
              rows={4}
            />
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="cancel-button">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="submit-button">
            {isSubmitting ? 'Submitting Evaluation...' : 'Complete Evaluation'}
          </button>
        </div>
      </form>
    </div>
  );
};

// Helper functions
const canEvaluate = (role: string): boolean => {
  return ['ADMIN', 'SALES_DIRECTOR', 'REGIONAL_SALES_MANAGER', 'REGIONAL_MANAGER', 'SALES_LEAD'].includes(role);
};

export default EvaluationForm;
