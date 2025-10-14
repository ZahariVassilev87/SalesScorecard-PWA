import React, { useState, useEffect, useRef } from 'react';
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
  const lastUserIdRef = useRef<string | null>(null);
  const hasLoadedRef = useRef(false);
  
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
  
  // Evaluation categories from backend
  const [categories, setCategories] = useState<any[]>([]);

  // Auto-save functionality - temporarily disabled for debugging
  // const { restoreData, clearSavedData } = useAutoSave({
  //   key: 'evaluation_form',
  //   data: {
  //     selectedUser,
  //     visitDate,
  //     customerName,
  //     customerType,
  //     location,
  //     overallComment,
  //     scores,
  //     comments
  //   }
  // });

  // // Restore saved data on component mount
  // useEffect(() => {
  //   const savedData = restoreData();
  //   if (savedData) {
  //     setSelectedUser(savedData.selectedUser || '');
  //     setVisitDate(savedData.visitDate || new Date().toISOString().split('T')[0]);
  //     setCustomerName(savedData.customerName || '');
  //     setCustomerType(savedData.customerType || '');
  //     setLocation(savedData.location || '');
  //     setOverallComment(savedData.overallComment || '');
  //     setScores(savedData.scores || {});
  //     setComments(savedData.comments || {});
  //     console.log('🔄 [AutoSave] Restored evaluation form data');
  //   }
  // }, [restoreData]);

  // PWA-specific fixes for form state management
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isStandalone && isIOS) {
      console.log('🔍 [PWA] iOS PWA detected - applying form state fixes');
      
      // Set viewport to prevent zoom without interfering with form inputs
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
      }
    }
  }, []);

  useEffect(() => {
    // Only load ONCE - prevent constant re-loading
    if (hasLoadedRef.current || !user?.id) {
      return;
    }
    
    // Check if user ID changed
    if (user.id === lastUserIdRef.current) {
      return;
    }
    
    hasLoadedRef.current = true;
    lastUserIdRef.current = user.id;
    
    const loadData = async () => {
      try {
        // Load evaluatable users
        const users = await apiService.getEvaluatableUsers();
        setEvaluatableUsers(users);
        
        if (users.length === 0) {
          setError('No users available for evaluation. Please check your permissions or team assignment.');
        }
        
        // Load evaluation categories from backend (role-based)
        const behaviorCategories = await apiService.getBehaviorCategories();
        setCategories(behaviorCategories);
      } catch (err) {
        console.error('Failed to load evaluation data:', err);
        setError(t('evaluation.error'));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.id, t]);

  const getEvaluationTitle = () => {
    return t('evaluation.title');
  };

  const getEvaluationDescription = () => {
    return t('evaluation.description');
  };

  const getEvaluationCategories = () => {
    // Return categories from backend (role-based forms)
    if (categories.length > 0) {
      console.log('📋 Using backend categories:', categories.length);
      // Add colors to categories for UI
      const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1'];
      return categories.map((cat, index) => ({
        ...cat,
        color: colors[index % colors.length]
      }));
    }
    
    // Fallback to default if backend fails
    console.log('⚠️ Using fallback categories');
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
        category.items.map((item: any) => ({
          behaviorItemId: item.id,
          rating: scores[item.id] || 0, // Backend expects 'rating' not 'score'
          comment: comments[item.id] || ''
        }))
      );

      const evaluationData = {
        salespersonId: selectedUser,
        visitDate,
        customerName: customerName || undefined,
        customerType: customerType || undefined,
        location: location || undefined,
        overallComment: overallComment || undefined,
        items: evaluationItems
      };

      try {
        // Try online submission first
        await apiService.createEvaluation(evaluationData);
        
        // Clear auto-save data on successful submission
        // clearSavedData();
        
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
      } catch (onlineError) {
        // Show error - no offline mode for now
        console.error('Evaluation submission failed:', onlineError);
        setError(onlineError instanceof Error ? onlineError.message : t('evaluation.error'));
        setIsSubmitting(false);
        return;
      }
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
              onChange={(e) => {
                console.log('🔍 [PWA] User selection changed:', e.target.value);
                setSelectedUser(e.target.value);
              }}
              autoComplete="off"
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
              onChange={(e) => {
                console.log('🔍 [PWA] Customer name changed:', e.target.value);
                setCustomerName(e.target.value);
              }}
              autoComplete="off"
              placeholder={t('evaluation.customerName')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="customerType">{t('evaluation.customerType')} *</label>
            <select
              id="customerType"
              value={customerType}
              onChange={(e) => {
                console.log('🔍 [PWA] Customer type changed:', e.target.value);
                setCustomerType(e.target.value);
              }}
              autoComplete="off"
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
              onChange={(e) => {
                console.log('🔍 [PWA] Location changed:', e.target.value);
                setLocation(e.target.value);
              }}
              autoComplete="off"
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
              
              {category.items.map((item: any) => (
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
