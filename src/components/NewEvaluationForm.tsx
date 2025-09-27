import React, { useState, useEffect } from 'react';
import { apiService, BehaviorCategory, User } from '../services/api';

interface NewEvaluationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const NewEvaluationForm: React.FC<NewEvaluationFormProps> = ({ onSuccess, onCancel }) => {
  const [categories, setCategories] = useState<BehaviorCategory[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [selectedSalesperson, setSelectedSalesperson] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [location, setLocation] = useState('');
  const [overallComment, setOverallComment] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const [categoriesData, teamData] = await Promise.all([
          apiService.getBehaviorCategories(),
          apiService.getMyTeam()
        ]);
        
        setCategories(categoriesData);
        if (teamData) {
          setTeamMembers(teamData.members.filter(member => member.role === 'SALESPERSON'));
        }
      } catch (err) {
        setError('Failed to load evaluation data');
        console.error('Failed to load data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleScoreChange = (itemId: string, score: number) => {
    setScores(prev => ({ ...prev, [itemId]: score }));
  };

  const handleCommentChange = (itemId: string, comment: string) => {
    setComments(prev => ({ ...prev, [itemId]: comment }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalesperson) {
      setError('Please select a salesperson to evaluate');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const evaluationItems = categories.flatMap(category =>
        category.items.map(item => ({
          behaviorItemId: item.id,
          score: scores[item.id] || 0,
          comment: comments[item.id] || ''
        }))
      );

      await apiService.createEvaluation({
        salespersonId: selectedSalesperson,
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

  return (
    <div className="evaluation-form">
      <div className="form-header">
        <h2>New Sales Evaluation</h2>
        <p>Evaluate a salesperson's performance during a sales meeting</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>Meeting Details</h3>
          
          <div className="form-group">
            <label htmlFor="salesperson">Salesperson *</label>
            <select
              id="salesperson"
              value={selectedSalesperson}
              onChange={(e) => setSelectedSalesperson(e.target.value)}
              required
            >
              <option value="">Select a salesperson</option>
              {teamMembers.map(member => (
                <option key={member.id} value={member.id}>
                  {member.displayName} ({member.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="visitDate">Visit Date *</label>
            <input
              type="date"
              id="visitDate"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="customerName">Customer Name</label>
            <input
              type="text"
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Enter meeting location"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Behavior Evaluation</h3>
          <p>Rate each behavior on a scale of 1-4 (1 = Poor, 4 = Excellent)</p>

          {categories.map(category => (
            <div key={category.id} className="category-section">
              <h4>{category.name}</h4>
              <p className="category-weight">Weight: {(category.weight * 100).toFixed(0)}%</p>
              
              {category.items.map(item => (
                <div key={item.id} className="behavior-item">
                  <div className="item-header">
                    <label>{item.name}</label>
                    <div className="score-input">
                      {[1, 2, 3, 4].map(score => (
                        <label key={score} className="score-option">
                          <input
                            type="radio"
                            name={`score-${item.id}`}
                            value={score}
                            checked={scores[item.id] === score}
                            onChange={() => handleScoreChange(item.id, score)}
                          />
                          <span>{score}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <textarea
                    placeholder="Add comment (optional)"
                    value={comments[item.id] || ''}
                    onChange={(e) => handleCommentChange(item.id, e.target.value)}
                    rows={2}
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
            {isSubmitting ? 'Creating Evaluation...' : 'Create Evaluation'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewEvaluationForm;
