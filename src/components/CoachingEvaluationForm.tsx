import React, { useState, useEffect } from 'react';
import { apiService, User } from '../services/api';
import { useTranslation } from 'react-i18next';

interface CoachingEvaluationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const CoachingEvaluationForm: React.FC<CoachingEvaluationFormProps> = ({ onSuccess, onCancel }) => {
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
  const [location, setLocation] = useState('');
  const [overallComment, setOverallComment] = useState('');

  // Coaching scores and examples
  const [scores, setScores] = useState<Record<string, number>>({});
  const [examples, setExamples] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const users = await apiService.getEvaluatableUsers();
        const salesLeads = users.filter(u => u.role === 'SALES_LEAD');
        setEvaluatableUsers(salesLeads);
      } catch (err) {
        setError(t('common:evaluation.error'));
        console.error('Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [t]);

  // Hardcoded coaching categories
  const categories = [
    {
      id: 'observation',
      name: t('coaching:cluster1'),
      color: '#8b5cf6',
      weight: 0.40,
      items: [
        { id: 'obs1', name: t('coaching:letSalespersonLead'), descriptions: [t('coaching:score1'), t('coaching:score2'), t('coaching:score3'), t('coaching:score4')] },
        { id: 'obs2', name: t('coaching:providedSupport'), descriptions: [t('coaching:support1'), t('coaching:support2'), t('coaching:support3'), t('coaching:support4')] },
        { id: 'obs3', name: t('coaching:steppedInValue'), descriptions: [t('coaching:value1'), t('coaching:value2'), t('coaching:value3'), t('coaching:value4')] },
        { id: 'obs4', name: t('coaching:activelyListened'), descriptions: [t('coaching:listen1'), t('coaching:listen2'), t('coaching:listen3'), t('coaching:listen4')] },
      ]
    },
    {
      id: 'environment',
      name: t('coaching:cluster2'),
      color: '#3b82f6',
      weight: 0.20,
      items: [
        { id: 'env1', name: t('coaching:calmAtmosphere'), descriptions: [t('coaching:atmosphere1'), t('coaching:atmosphere2'), t('coaching:atmosphere3'), t('coaching:atmosphere4')] },
        { id: 'env2', name: t('coaching:askedSelfAssessment'), descriptions: [t('coaching:assessment1'), t('coaching:assessment2'), t('coaching:assessment3'), t('coaching:assessment4')] },
        { id: 'env3', name: t('coaching:listenedAttentively'), descriptions: [t('coaching:attentive1'), t('coaching:attentive2'), t('coaching:attentive3'), t('coaching:attentive4')] },
      ]
    },
    {
      id: 'feedback',
      name: t('coaching:cluster3'),
      color: '#10b981',
      weight: 0.20,
      items: [
        { id: 'fb1', name: t('coaching:startedPositive'), descriptions: [t('coaching:positive1'), t('coaching:positive2'), t('coaching:positive3'), t('coaching:positive4')] },
        { id: 'fb2', name: t('coaching:concreteExamples'), descriptions: [t('coaching:examples1'), t('coaching:examples2'), t('coaching:examples3'), t('coaching:examples4')] },
        { id: 'fb3', name: t('coaching:identifiedImprovement'), descriptions: [t('coaching:improvement1'), t('coaching:improvement2'), t('coaching:improvement3'), t('coaching:improvement4')] },
      ]
    },
    {
      id: 'action',
      name: t('coaching:cluster4'),
      color: '#f59e0b',
      weight: 0.20,
      items: [
        { id: 'act1', name: t('coaching:setClearTasks'), descriptions: [t('coaching:tasks1'), t('coaching:tasks2'), t('coaching:tasks3'), t('coaching:tasks4')] },
        { id: 'act2', name: t('coaching:reachedAgreement'), descriptions: [t('coaching:agreement1'), t('coaching:agreement2'), t('coaching:agreement3'), t('coaching:agreement4')] },
        { id: 'act3', name: t('coaching:encouragedGoal'), descriptions: [t('coaching:goal1'), t('coaching:goal2'), t('coaching:goal3'), t('coaching:goal4')] },
      ]
    }
  ];

  const handleScoreChange = (itemId: string, score: number) => {
    setScores(prev => ({ ...prev, [itemId]: score }));
  };

  const handleExampleChange = (itemId: string, example: string) => {
    setExamples(prev => ({ ...prev, [itemId]: example }));
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
    const evaluationItems = allItems.map(item => ({
      behaviorItemId: item.id, // Use actual item ID from database
      rating: scores[item.id], // Backend expects 'rating' not 'score'
      comment: examples[item.id] || ''
    }));

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

                  <textarea
                    placeholder="Give a specific example from the meeting..."
                    value={examples[item.id] || ''}
                    onChange={(e) => handleExampleChange(item.id, e.target.value)}
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: `2px solid ${category.color}30`,
                      borderRadius: '12px',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                      marginTop: '0.5rem',
                      background: 'white',
                      fontStyle: 'italic',
                      textAlign: 'center',
                      color: 'var(--gray-700)'
                    }}
                  />
                </div>
              ))}

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