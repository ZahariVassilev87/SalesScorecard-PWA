import React, { useState, useEffect } from 'react';
import { apiService, User } from '../services/api';
import { useTranslation } from 'react-i18next';

interface SalespersonEvaluationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const SalespersonEvaluationForm: React.FC<SalespersonEvaluationFormProps> = ({ onSuccess, onCancel }) => {
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
  const [customerType, setCustomerType] = useState('LOW_SHARE');
  const [overallComment, setOverallComment] = useState('');

  // Salesperson scores and examples
  const [scores, setScores] = useState<Record<string, number>>({});
  const [examples, setExamples] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const users = await apiService.getEvaluatableUsers();
        const salespeople = users.filter(u => u.role === 'SALESPERSON');
        setEvaluatableUsers(salespeople);
      } catch (err) {
        setError(t('common:evaluation.error'));
        console.error('Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [t]);

  // Force reload evaluatable users every 10 seconds - TEMPORARILY DISABLED FOR PWA DEBUGGING
  // useEffect(() => {
  //   const interval = setInterval(async () => {
  //     try {
  //       console.log('🔄 [SalespersonForm] Periodic reload...');
  //       const users = await apiService.getEvaluatableUsers();
  //       const salespeople = users.filter(u => u.role === 'SALESPERSON');
  //       setEvaluatableUsers(salespeople);
  //     } catch (err) {
  //       console.error('Periodic reload failed:', err);
  //     }
  //   }, 10000);

  //   return () => clearInterval(interval);
  // }, []);

  // Use hardcoded detailed form with translations
  const categories = [
    {
      id: 'prep',
      name: t('salesperson:cluster1'),
      color: '#8b5cf6',
      weight: 0.30,
      items: [
        { id: 'prep1', name: t('salesperson:coreProducts'), descriptions: [t('salesperson:prep1_1'), t('salesperson:prep1_2'), t('salesperson:prep1_3'), t('salesperson:prep1_4')] },
        { id: 'prep2', name: t('salesperson:establishmentType'), descriptions: [t('salesperson:prep2_1'), t('salesperson:prep2_2'), t('salesperson:prep2_3'), t('salesperson:prep2_4')] },
        { id: 'prep3', name: t('salesperson:focusProducts'), descriptions: [t('salesperson:prep3_1'), t('salesperson:prep3_2'), t('salesperson:prep3_3'), t('salesperson:prep3_4')] },
        { id: 'prep4', name: t('salesperson:currentSupplier'), descriptions: [t('salesperson:prep4_1'), t('salesperson:prep4_2'), t('salesperson:prep4_3'), t('salesperson:prep4_4')] },
        { id: 'prep5', name: t('salesperson:priceAnalysis'), descriptions: [t('salesperson:prep5_1'), t('salesperson:prep5_2'), t('salesperson:prep5_3'), t('salesperson:prep5_4')] },
        { id: 'prep6', name: t('salesperson:productStrategy'), descriptions: [t('salesperson:prep6_1'), t('salesperson:prep6_2'), t('salesperson:prep6_3'), t('salesperson:prep6_4')] },
        { id: 'prep7', name: t('salesperson:metroModel'), descriptions: [t('salesperson:prep7_1'), t('salesperson:prep7_2'), t('salesperson:prep7_3'), t('salesperson:prep7_4')] },
      ]
    },
    {
      id: 'prob',
      name: t('salesperson:cluster2'),
      color: '#3b82f6',
      weight: 0.233,
      items: [
        { id: 'prob1', name: t('salesperson:askedClientExperience'), descriptions: [t('salesperson:prob1_1'), t('salesperson:prob1_2'), t('salesperson:prob1_3'), t('salesperson:prob1_4')] },
        { id: 'prob2', name: t('salesperson:priceQualityDelivery'), descriptions: [t('salesperson:prob2_1'), t('salesperson:prob2_2'), t('salesperson:prob2_3'), t('salesperson:prob2_4')] },
        { id: 'prob3', name: t('salesperson:businessImpact'), descriptions: [t('salesperson:prob3_1'), t('salesperson:prob3_2'), t('salesperson:prob3_3'), t('salesperson:prob3_4')] },
        { id: 'prob4', name: t('salesperson:missingProduct'), descriptions: [t('salesperson:prob4_1'), t('salesperson:prob4_2'), t('salesperson:prob4_3'), t('salesperson:prob4_4')] },
      ]
    },
    {
      id: 'obj',
      name: t('salesperson:cluster3'),
      color: '#10b981',
      weight: 0.233,
      items: [
        { id: 'obj1', name: t('salesperson:listenedFully'), descriptions: [t('salesperson:obj1_1'), t('salesperson:obj1_2'), t('salesperson:obj1_3'), t('salesperson:obj1_4')] },
        { id: 'obj2', name: t('salesperson:validatedPerspective'), descriptions: [t('salesperson:obj2_1'), t('salesperson:obj2_2'), t('salesperson:obj2_3'), t('salesperson:obj2_4')] },
        { id: 'obj3', name: t('salesperson:marketContext'), descriptions: [t('salesperson:obj3_1'), t('salesperson:obj3_2'), t('salesperson:obj3_3'), t('salesperson:obj3_4')] },
      ]
    },
    {
      id: 'prop',
      name: t('salesperson:cluster4'),
      color: '#f59e0b',
      weight: 0.233,
      items: [
        { id: 'prop1', name: t('salesperson:presentedSolution'), descriptions: [t('salesperson:prop1_1'), t('salesperson:prop1_2'), t('salesperson:prop1_3'), t('salesperson:prop1_4')] },
        { id: 'prop2', name: t('salesperson:clientPriority'), descriptions: [t('salesperson:prop2_1'), t('salesperson:prop2_2'), t('salesperson:prop2_3'), t('salesperson:prop2_4')] },
        { id: 'prop3', name: t('salesperson:proposedTest'), descriptions: [t('salesperson:prop3_1'), t('salesperson:prop3_2'), t('salesperson:prop3_3'), t('salesperson:prop3_4')] },
        { id: 'prop4', name: t('salesperson:nextStep'), descriptions: [t('salesperson:prop4_1'), t('salesperson:prop4_2'), t('salesperson:prop4_3'), t('salesperson:prop4_4')] },
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
      .map((item: any) => scores[item.id] || 0)
      .filter((score: number) => score > 0);

    if (itemScores.length === 0) return 0;

    const avgScore = itemScores.reduce((sum: number, score: number) => sum + score, 0) / itemScores.length;
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

    const allItems = categories.flatMap(c => c.items);
    const missingScores = allItems.filter(item => !scores[item.id]);
    
    if (missingScores.length > 0) {
      setError('Please rate all criteria');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // For now, create a simple mapping of our frontend IDs to generic backend format
      // The backend will store this as a JSON structure
      const evaluationItems = categories.flatMap(category => 
        category.items.map((item: any) => ({
          behaviorItemId: `salesperson_${customerType}_${item.id}`, // Create unique ID
          rating: scores[item.id], // Backend expects 'rating' not 'score'
          comment: examples[item.id] || ''
        }))
      );

      const evaluationData = {
        salespersonId: selectedUser,
        visitDate,
        customerName,
        customerType: customerType,
        location,
        overallComment,
        items: evaluationItems
      };

      console.log('📤 Submitting evaluation:', evaluationData);
      
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
        setIsSubmitting(false);
        return;
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
        <h2>{t('salesperson:title')}</h2>
        <p>{t('salesperson:subtitle')}</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <form onSubmit={handleSubmit}>
        {/* Basic Info */}
        <div className="form-section">
          <h3>{t('common:evaluation.details')}</h3>

          <div className="form-group">
            <label htmlFor="salesperson">{t('common:evaluation.selectPerson')} *</label>
            <select
              id="salesperson"
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
            <label htmlFor="customerType">{t('common:evaluation.customerType')} *</label>
            <select
              id="customerType"
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as 'LOW_SHARE' | 'MID_SHARE' | 'HIGH_SHARE')}
              required
            >
              <option value="LOW_SHARE">{t('common:customerTypes.lowShare')}</option>
              <option value="MID_SHARE">{t('common:customerTypes.midShare')}</option>
              <option value="HIGH_SHARE">{t('common:customerTypes.highShare')}</option>
            </select>
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
              <div className="category-weight">Weight: {(category.weight * 100).toFixed(1)}%</div>

              {category.items.map((item: any) => (
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

export default SalespersonEvaluationForm;