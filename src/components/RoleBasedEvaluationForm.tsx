import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService, User } from '../services/api';

interface RoleBasedEvaluationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const RoleBasedEvaluationForm: React.FC<RoleBasedEvaluationFormProps> = ({ onSuccess, onCancel }) => {
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
        return 'Evaluate Sales Lead coaching abilities in the field';
      case 'SALES_LEAD':
        return 'Evaluate Salesperson performance during sales meetings';
      default:
        return 'Create a new evaluation';
    }
  };

  const getEvaluationCriteria = () => {
    if (!user) return [];

    switch (user.role) {
      case 'SALES_DIRECTOR':
        return [
          { id: 'leadership', name: 'Leadership & Team Management', weight: 0.3 },
          { id: 'strategy', name: 'Strategic Planning & Execution', weight: 0.25 },
          { id: 'results', name: 'Results & Performance', weight: 0.25 },
          { id: 'communication', name: 'Communication & Collaboration', weight: 0.2 }
        ];
      case 'REGIONAL_SALES_MANAGER':
        return [
          { id: 'exploratory', name: 'Asks exploratory/diagnostic questions before offering feedback', weight: 0.2 },
          { id: 'behavioral', name: 'Provides feedback on behavior, not just results', weight: 0.2 },
          { id: 'collaborative', name: 'Involves rep in setting next steps for improvement', weight: 0.2 },
          { id: 'specific', name: 'Goal links to a specific sales activity', weight: 0.2 },
          { id: 'identification', name: 'Identifies specific behavior that needs improvement', weight: 0.1 },
          { id: 'impact', name: 'Discusses behavior effect on customer', weight: 0.1 }
        ];
      case 'SALES_LEAD':
        return [
          { id: 'discovery', name: 'Discovery & Needs Assessment', weight: 0.25 },
          { id: 'solution', name: 'Solution Positioning', weight: 0.25 },
          { id: 'closing', name: 'Closing & Next Steps', weight: 0.25 },
          { id: 'professionalism', name: 'Professionalism', weight: 0.25 }
        ];
      default:
        return [];
    }
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
      setError('Please select a user to evaluate');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // For now, we'll use the existing evaluation structure
      // In a real implementation, you'd have different evaluation types
      const evaluationItems = getEvaluationCriteria().map(criteria => ({
        behaviorItemId: criteria.id, // This would need to be mapped to actual behavior item IDs
        score: scores[criteria.id] || 0,
        comment: comments[criteria.id] || ''
      }));

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

  const criteria = getEvaluationCriteria();

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
            <label htmlFor="user">Select {getUserTypeLabel(user.role)} *</label>
            <select
              id="user"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              required
            >
              <option value="">Select a {getUserTypeLabel(user.role).toLowerCase()}</option>
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
            <label htmlFor="location">Location</label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter evaluation location"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Evaluation Criteria</h3>
          <p>Rate each criterion on a scale of 1-5 (1 = Poor, 5 = Excellent)</p>

          {criteria.map(criterion => (
            <div key={criterion.id} className="behavior-item">
              <div className="item-header">
                <label>{criterion.name}</label>
                <span className="criterion-weight">Weight: {(criterion.weight * 100).toFixed(0)}%</span>
                <div className="score-input">
                  {[1, 2, 3, 4, 5].map(score => (
                    <label key={score} className="score-option">
                      <input
                        type="radio"
                        name={`score-${criterion.id}`}
                        value={score}
                        checked={scores[criterion.id] === score}
                        onChange={() => handleScoreChange(criterion.id, score)}
                      />
                      <span>{score}</span>
                    </label>
                  ))}
                </div>
              </div>
              <textarea
                placeholder="Add comment (optional)"
                value={comments[criterion.id] || ''}
                onChange={(e) => handleCommentChange(criterion.id, e.target.value)}
                rows={2}
              />
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
            {isSubmitting ? 'Creating Evaluation...' : 'Create Evaluation'}
          </button>
        </div>
      </form>
    </div>
  );
};

// Helper functions
const canEvaluate = (role: string): boolean => {
  return ['SALES_DIRECTOR', 'REGIONAL_SALES_MANAGER', 'SALES_LEAD'].includes(role);
};

const getUserTypeLabel = (role: string): string => {
  switch (role) {
    case 'SALES_DIRECTOR':
      return 'Regional Manager';
    case 'REGIONAL_SALES_MANAGER':
      return 'Sales Lead';
    case 'SALES_LEAD':
      return 'Salesperson';
    default:
      return 'User';
  }
};

export default RoleBasedEvaluationForm;
