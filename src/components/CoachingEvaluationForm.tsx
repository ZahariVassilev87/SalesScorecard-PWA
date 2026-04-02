import React, { useState, useEffect } from 'react';
import { apiService, User } from '../services/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

interface CoachingEvaluationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const CoachingEvaluationForm: React.FC<CoachingEvaluationFormProps> = ({ onSuccess, onCancel }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [evaluatableUsers, setEvaluatableUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form state
  const [selectedUser, setSelectedUser] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [location, setLocation] = useState('');
  const [overallComment, setOverallComment] = useState('');

  // Coaching scores and comments
  const [scores, setScores] = useState<Record<string, number>>({});
  const [clusterComments, setClusterComments] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        // For coaching, RM/RSM evaluate SALES_LEAD users specifically.
        // Do not use getEvaluatableUsers() here because that endpoint is salesperson-oriented.
        let salesLeads: User[] = [];
        const team = await apiService.getMyTeam();
        salesLeads = (team?.members || []).filter(member => member.role === 'SALES_LEAD');

        if (salesLeads.length === 0) {
          const orgTeams = await apiService.getTeams();
          salesLeads = Array.from(
            new Map(
              orgTeams
                .flatMap((t) => t.members || [])
                .filter((m) => m && m.role === 'SALES_LEAD')
                .map((m) => [m.id, m])
            ).values()
          );
        }

        const uniqueSalesLeads = Array.from(new Map(salesLeads.map(item => [item.id, item])).values());
        setEvaluatableUsers(uniqueSalesLeads);
      } catch (err) {
        setError(t('common:evaluation.error'));
        console.error('Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [t, user?.id]);

  // Hardcoded coaching categories (source of truth for RM/RSM coaching form).
  // Weights proportional to criterion count (12 total): 3 + 2 + 4 + 3.
  const categories = [
    {
      id: 'preMeeting',
      name: t('coaching:clusterPreMeeting'),
      color: '#8b5cf6',
      weight: 3 / 12,
      items: [
        { id: 'pre1', name: t('coaching:clarifiedObjective'), descriptions: [t('coaching:clarifiedObjective1'), t('coaching:clarifiedObjective2'), t('coaching:clarifiedObjective3'), t('coaching:clarifiedObjective4')] },
        { id: 'pre2', name: t('coaching:reviewedPreparation'), descriptions: [t('coaching:reviewedPreparation1'), t('coaching:reviewedPreparation2'), t('coaching:reviewedPreparation3'), t('coaching:reviewedPreparation4')] },
        { id: 'pre3', name: t('coaching:clearStrategy'), descriptions: [t('coaching:clearStrategy1'), t('coaching:clearStrategy2'), t('coaching:clearStrategy3'), t('coaching:clearStrategy4')] },
      ]
    },
    {
      id: 'duringMeeting',
      name: t('coaching:clusterDuringMeeting'),
      color: '#3b82f6',
      weight: 2 / 12,
      items: [
        { id: 'meet1', name: t('coaching:allowedLead'), descriptions: [t('coaching:allowedLead1'), t('coaching:allowedLead2'), t('coaching:allowedLead3'), t('coaching:allowedLead4')] },
        { id: 'meet2', name: t('coaching:interveneWhenNeeded'), descriptions: [t('coaching:interveneWhenNeeded1'), t('coaching:interveneWhenNeeded2'), t('coaching:interveneWhenNeeded3'), t('coaching:interveneWhenNeeded4')] },
      ]
    },
    {
      id: 'analysisFeedback',
      name: t('coaching:clusterAnalysis'),
      color: '#10b981',
      weight: 4 / 12,
      items: [
        { id: 'ana1', name: t('coaching:selfAssessmentFirst'), descriptions: [t('coaching:selfAssessmentFirst1'), t('coaching:selfAssessmentFirst2'), t('coaching:selfAssessmentFirst3'), t('coaching:selfAssessmentFirst4')] },
        { id: 'ana2', name: t('coaching:positiveBIR'), descriptions: [t('coaching:positiveBIR1'), t('coaching:positiveBIR2'), t('coaching:positiveBIR3'), t('coaching:positiveBIR4')] },
        { id: 'ana3', name: t('coaching:constructiveBIR'), descriptions: [t('coaching:constructiveBIR1'), t('coaching:constructiveBIR2'), t('coaching:constructiveBIR3'), t('coaching:constructiveBIR4')] },
        { id: 'ana4', name: t('coaching:realExamples'), descriptions: [t('coaching:realExamples1'), t('coaching:realExamples2'), t('coaching:realExamples3'), t('coaching:realExamples4')] },
      ]
    },
    {
      id: 'action',
      name: t('coaching:clusterAction'),
      color: '#f59e0b',
      weight: 3 / 12,
      items: [
        { id: 'act1', name: t('coaching:nextVisitFocus'), descriptions: [t('coaching:nextVisitFocus1'), t('coaching:nextVisitFocus2'), t('coaching:nextVisitFocus3'), t('coaching:nextVisitFocus4')] },
        { id: 'act2', name: t('coaching:ensuredUnderstanding'), descriptions: [t('coaching:ensuredUnderstanding1'), t('coaching:ensuredUnderstanding2'), t('coaching:ensuredUnderstanding3'), t('coaching:ensuredUnderstanding4')] },
        { id: 'act3', name: t('coaching:weeklyFocus'), descriptions: [t('coaching:weeklyFocus1'), t('coaching:weeklyFocus2'), t('coaching:weeklyFocus3'), t('coaching:weeklyFocus4')] },
      ]
    }
  ];

  const handleScoreChange = (itemId: string, score: number) => {
    setScores(prev => ({ ...prev, [itemId]: score }));
  };

  const handleClusterCommentChange = (categoryId: string, comment: string) => {
    setClusterComments(prev => ({ ...prev, [categoryId]: comment }));
  };

  const calculateClusterScore = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return 0;

    const itemScores = category.items
      .map(item => scores[item.id] || 0)
      .filter(score => score > 0);

    if (itemScores.length === 0) return 0;

    const avgScore = itemScores.reduce((sum, score) => sum + score, 0) / itemScores.length;
    return (avgScore / 4) * 100;
  };

  const calculateOverallScore = () => {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    categories.forEach(category => {
      const clusterScore = calculateClusterScore(category.id);
      if (clusterScore > 0) {
        totalWeightedScore += clusterScore * category.weight;
        totalWeight += category.weight;
      }
    });

    return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser || !customerName || !location) {
      setError('Please fill in all required fields');
      return;
    }

    const allItems = categories.flatMap(category => category.items);
    
    // Check for missing or invalid scores (must be between 1 and 4)
    const missingScores = allItems.filter(item => {
      const score = scores[item.id];
      return !score || score < 1 || score > 4;
    });
    
    if (missingScores.length > 0) {
      setError('Моля, оценете всички критерии с оценка между 1 и 4');
      return;
    }

    // All items have valid scores, create evaluation items
    const categoryByItemId = categories.reduce<Record<string, string>>((acc, category) => {
      category.items.forEach(item => {
        acc[item.id] = category.id;
      });
      return acc;
    }, {});

    const evaluationItems = allItems.map(item => {
      const categoryId = categoryByItemId[item.id];
      return {
        behaviorItemId: item.id, // Use actual item ID from database
        rating: scores[item.id], // Backend expects 'rating' not 'score'
        // Keep backend payload unchanged by saving the cluster comment on each cluster item.
        comment: categoryId ? (clusterComments[categoryId] || '') : ''
      };
    });

    setIsSubmitting(true);
    setError('');

    try {

      const evaluationData = {
        salespersonId: selectedUser,
        visitDate,
        customerName,
        customerType: 'COACHING', // Special type for coaching evaluations
        location,
        overallComment,
        items: evaluationItems
      };

      try {
        // Try to submit online first
        await apiService.createEvaluation(evaluationData);
        
        setSuccessMessage(t('common:evaluation.success'));
        
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } catch (onlineError) {
        console.error('Evaluation submission failed:', onlineError);
        setError(onlineError instanceof Error ? onlineError.message : t('common:evaluation.error'));
      }
    } catch (err) {
      setError(t('common:evaluation.error'));
      console.error('Submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="evaluation-form">
      <div className="form-header">
        <h2>{t('coaching:title')}</h2>
        <p>{t('coaching:subtitle')}</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <div className="form-section">
          <h3>{t('common:evaluation.details')}</h3>

          <div className="form-group">
            <label htmlFor="salesLead">{t('common:evaluation.selectPerson')} *</label>
            <select
              id="salesLead"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              required
            >
              <option value="">{t('common:select')}</option>
              {evaluatableUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.displayName} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="visitDate">{t('common:evaluation.visitDate')} *</label>
            <input
              type="date"
              id="visitDate"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="customerName">{t('common:evaluation.customerName')} *</label>
            <input
              type="text"
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              placeholder="Hotel Grand, Restaurant Milano..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">{t('common:evaluation.location')} *</label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              placeholder="Sofia, Plovdiv, Varna..."
            />
          </div>
        </div>

        {/* Evaluation Categories */}
        <div className="form-section">
          <h3>{t('common:evaluation.form')}</h3>
          <p>Rate each criterion on a scale of 1-4 (1 = Poor, 4 = Excellent)</p>

          {categories.map(category => (
            <div key={category.id} className="category-section" style={{ backgroundColor: `${category.color}10`, borderColor: `${category.color}30` }}>
              <h4 style={{ color: category.color }}>{category.name}</h4>
              <div className="category-weight">Weight: {(category.weight * 100).toFixed(0)}%</div>

              {category.items.map(item => (
                <div key={item.id} className="behavior-item">
                  <div className="item-header">
                    <label className="item-label">{item.name}</label>
                  </div>
                  
                  {/* Large Score Buttons for Mobile */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    {[1, 2, 3, 4].map(score => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => handleScoreChange(item.id, score)}
                        style={{
                          padding: '16px 8px',
                          fontSize: '1.5rem',
                          fontWeight: '700',
                          border: scores[item.id] === score ? `3px solid ${category.color}` : '2px solid var(--gray-300)',
                          borderRadius: '12px',
                          background: scores[item.id] === score ? `${category.color}15` : 'white',
                          color: scores[item.id] === score ? category.color : 'var(--gray-600)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          minHeight: '64px',
                          WebkitTapHighlightColor: 'transparent',
                          touchAction: 'manipulation',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: scores[item.id] === score ? `0 4px 12px ${category.color}40` : 'var(--shadow-sm)'
                        }}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                  
                  {/* Show description for selected score */}
                  {scores[item.id] && item.descriptions && item.descriptions[scores[item.id] - 1] && (
                    <div style={{
                      background: `${category.color}10`,
                      border: `1px solid ${category.color}30`,
                      borderRadius: '0.75rem',
                      padding: '0.75rem 1rem',
                      marginTop: '0.75rem',
                      marginBottom: '0.75rem',
                      fontSize: '0.875rem',
                      fontStyle: 'italic',
                      color: 'var(--gray-700)',
                      textAlign: 'center',
                      lineHeight: '1.5'
                    }}>
                      {item.descriptions[scores[item.id] - 1]}
                    </div>
                  )}

                </div>
              ))}

              <div style={{ marginTop: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--gray-700)'
                  }}
                >
                  Cluster comment
                </label>
                <textarea
                  placeholder="Add one comment for this cluster..."
                  value={clusterComments[category.id] || ''}
                  onChange={(e) => handleClusterCommentChange(category.id, e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `2px solid ${category.color}30`,
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    background: 'white',
                    color: 'var(--gray-700)'
                  }}
                />
              </div>

              {/* Cluster Score Display */}
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: 'white',
                borderRadius: '0.75rem',
                textAlign: 'center',
                border: `2px solid ${category.color}40`
              }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Cluster Score
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: category.color }}>
                  {calculateClusterScore(category.id).toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Overall Score */}
        <div className="form-section" style={{
          background: 'linear-gradient(135deg, var(--primary-500), var(--primary-600))',
          color: 'white',
          textAlign: 'center'
        }}>
          <h3 style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}>
            Overall Score
          </h3>
          <div style={{ fontSize: '3rem', fontWeight: 800, margin: '1rem 0' }}>
            {calculateOverallScore().toFixed(1)}%
          </div>
        </div>

        {/* Overall Comment */}
        <div className="form-section">
          <h3>{t('common:evaluation.overallAssessment')}</h3>
          <div className="form-group">
            <label htmlFor="overallComment">{t('common:evaluation.overallComment')}</label>
            <textarea
              id="overallComment"
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              rows={4}
              placeholder="Provide overall feedback and recommendations..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="cancel-button"
          >
            {t('common:cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="submit-button"
          >
            {isSubmitting ? t('common:evaluation.submitting') : t('common:evaluation.submit')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CoachingEvaluationForm;