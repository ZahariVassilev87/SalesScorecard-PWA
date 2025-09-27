import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService, User } from '../services/api';
import { useTranslation } from 'react-i18next';

interface EvaluationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const EvaluationForm: React.FC<EvaluationFormProps> = ({ onSuccess, onCancel }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [evaluatableUsers, setEvaluatableUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form state
  const [selectedUser, setSelectedUser] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [customerType, setCustomerType] = useState('');
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
        setError(t('evaluation.error'));
        console.error('Failed to load evaluatable users:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadEvaluatableUsers();
  }, [t]);

  const getEvaluationTitle = () => {
    return t('evaluation.title');
  };

  const getEvaluationDescription = () => {
    return t('evaluation.description');
  };

  const getEvaluationCategories = () => {
    // All roles use the same evaluation structure as iOS app
    return [
      {
        id: 'discovery',
        name: t('evaluation.discovery'),
        color: '#3B82F6',
        items: [
          { id: 'discovery-open-questions', name: t('evaluation.openQuestions') },
          { id: 'discovery-pain-points', name: t('evaluation.painPoints') },
          { id: 'discovery-decision-makers', name: t('evaluation.decisionMakers') }
        ]
      },
      {
        id: 'solution',
        name: t('evaluation.solution'),
        color: '#10B981',
        items: [
          { id: 'solution-tailors', name: t('evaluation.tailors') },
          { id: 'solution-value-prop', name: t('evaluation.valueProp') },
          { id: 'solution-product-knowledge', name: t('evaluation.productKnowledge') }
        ]
      },
      {
        id: 'closing',
        name: t('evaluation.closing'),
        color: '#F59E0B',
        items: [
          { id: 'closing-clear-asks', name: t('evaluation.clearAsks') },
          { id: 'closing-next-steps', name: t('evaluation.nextSteps') },
          { id: 'closing-commitments', name: t('evaluation.commitments') }
        ]
      },
      {
        id: 'professionalism',
        name: t('evaluation.professionalism'),
        color: '#8B5CF6',
        items: [
          { id: 'professionalism-prepared', name: t('evaluation.prepared') },
          { id: 'professionalism-time', name: t('evaluation.timeManagement') },
          { id: 'professionalism-demeanor', name: t('evaluation.demeanor') }
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
      setError(t('evaluation.selectTeamMember'));
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');

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
        customerType: customerType || undefined,
        location: location || undefined,
        overallComment: overallComment || undefined,
        items: evaluationItems
      });

      // Show success message
      setSuccessMessage(`✅ ${t('evaluation.success')}`);
      console.log('✅ Evaluation submitted successfully!');
      
      // Clear form
      setSelectedUser('');
      setCustomerName('');
      setCustomerType('');
      setLocation('');
      setOverallComment('');
      setScores({});
      setComments({});
      
      // Navigate to history after a longer delay to see the message
      setTimeout(() => {
        console.log('Navigating to history tab...');
        onSuccess();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('evaluation.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="evaluation-form">
        <div className="loading">{t('evaluation.loadingForm')}</div>
      </div>
    );
  }

  if (!user || !canEvaluate(user.role)) {
    return (
      <div className="evaluation-form">
        <div className="error">{t('evaluation.permissionError')}</div>
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
          <h3>{t('evaluation.details')}</h3>
          
          <div className="form-group">
            <label htmlFor="user">{t('evaluation.selectPerson')} *</label>
            <select
              id="user"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              required
            >
              <option value="">{t('common.select')} {t('common.team')} {t('common.member')}...</option>
              {evaluatableUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.displayName} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="visitDate">{t('evaluation.visitDate')} *</label>
            <input
              type="date"
              id="visitDate"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="customerName">{t('evaluation.customerName')}</label>
            <input
              type="text"
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t('evaluation.customerName')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="customerType">{t('evaluation.customerType')} *</label>
            <select
              id="customerType"
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
              required
            >
              <option value="">{t('common.select')} {t('evaluation.customerType')}...</option>
              <option value="low-share">{t('customerTypes.lowShare')}</option>
              <option value="mid-share">{t('customerTypes.midShare')}</option>
              <option value="high-share">{t('customerTypes.highShare')}</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="location">{t('evaluation.location')} *</label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('evaluation.location')}
              required
            />
          </div>
        </div>

        <div className="form-section">
          <h3>{t('evaluation.form')}</h3>
          <p>{t('evaluation.rating')}</p>

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
                    placeholder={t('evaluation.explainRating')}
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
          <h3>{t('evaluation.overallAssessment')}</h3>
          <div className="form-group">
            <label htmlFor="overallComment">{t('evaluation.overallComment')}</label>
            <textarea
              id="overallComment"
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              placeholder={t('evaluation.provideFeedback')}
              rows={4}
            />
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="success-message">
            {successMessage}
          </div>
        )}

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="cancel-button">
            {t('evaluation.cancel')}
          </button>
          <button type="submit" disabled={isSubmitting} className="submit-button">
            {isSubmitting ? t('evaluation.submitting') : t('evaluation.submit')}
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
