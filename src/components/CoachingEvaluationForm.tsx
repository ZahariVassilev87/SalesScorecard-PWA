import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService, User } from '../services/api';
import { useTranslation } from 'react-i18next';

interface CoachingEvaluationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const CoachingEvaluationForm: React.FC<CoachingEvaluationFormProps> = ({ onSuccess, onCancel }) => {
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
  const [location, setLocation] = useState('');
  const [overallComment, setOverallComment] = useState('');

  // Coaching scores
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadEvaluatableUsers = async () => {
      try {
        const users = await apiService.getEvaluatableUsers();
        // Filter to only show Sales Leads for Regional Managers
        const salesLeads = users.filter(u => u.role === 'SALES_LEAD');
        setEvaluatableUsers(salesLeads);
      } catch (err) {
        setError(t('evaluation.error'));
        console.error('Failed to load evaluatable users:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadEvaluatableUsers();
  }, [t]);

  const getCoachingCategories = () => {
    return [
      {
        id: 'cluster1',
        name: t('coaching.cluster1'),
        color: '#3B82F6',
        weight: 0.35, // 35% weight
        items: [
          { 
            id: 'let-salesperson-lead', 
            name: t('coaching.letSalespersonLead'),
            descriptions: [
              t('coaching.score1'),
              t('coaching.score2'),
              t('coaching.score3'),
              t('coaching.score4')
            ]
          },
          { 
            id: 'provided-support', 
            name: t('coaching.providedSupport'),
            descriptions: [
              t('coaching.support1'),
              t('coaching.support2'),
              t('coaching.support3'),
              t('coaching.support4')
            ]
          },
          { 
            id: 'stepped-in-value', 
            name: t('coaching.steppedInValue'),
            descriptions: [
              t('coaching.value1'),
              t('coaching.value2'),
              t('coaching.value3'),
              t('coaching.value4')
            ]
          },
          { 
            id: 'actively-listened', 
            name: t('coaching.activelyListened'),
            descriptions: [
              t('coaching.listen1'),
              t('coaching.listen2'),
              t('coaching.listen3'),
              t('coaching.listen4')
            ]
          }
        ]
      },
      {
        id: 'cluster2',
        name: t('coaching.cluster2'),
        color: '#10B981',
        weight: 0.2167, // 65% / 3 = 21.67% each
        items: [
          { 
            id: 'calm-atmosphere', 
            name: t('coaching.calmAtmosphere'),
            descriptions: [
              t('coaching.atmosphere1'),
              t('coaching.atmosphere2'),
              t('coaching.atmosphere3'),
              t('coaching.atmosphere4')
            ]
          },
          { 
            id: 'asked-self-assessment', 
            name: t('coaching.askedSelfAssessment'),
            descriptions: [
              t('coaching.assessment1'),
              t('coaching.assessment2'),
              t('coaching.assessment3'),
              t('coaching.assessment4')
            ]
          },
          { 
            id: 'listened-attentively', 
            name: t('coaching.listenedAttentively'),
            descriptions: [
              t('coaching.attentive1'),
              t('coaching.attentive2'),
              t('coaching.attentive3'),
              t('coaching.attentive4')
            ]
          }
        ]
      },
      {
        id: 'cluster3',
        name: t('coaching.cluster3'),
        color: '#F59E0B',
        weight: 0.2167,
        items: [
          { 
            id: 'started-positive', 
            name: t('coaching.startedPositive'),
            descriptions: [
              t('coaching.positive1'),
              t('coaching.positive2'),
              t('coaching.positive3'),
              t('coaching.positive4')
            ]
          },
          { 
            id: 'concrete-examples', 
            name: t('coaching.concreteExamples'),
            descriptions: [
              t('coaching.examples1'),
              t('coaching.examples2'),
              t('coaching.examples3'),
              t('coaching.examples4')
            ]
          },
          { 
            id: 'identified-improvement', 
            name: t('coaching.identifiedImprovement'),
            descriptions: [
              t('coaching.improvement1'),
              t('coaching.improvement2'),
              t('coaching.improvement3'),
              t('coaching.improvement4')
            ]
          }
        ]
      },
      {
        id: 'cluster4',
        name: t('coaching.cluster4'),
        color: '#8B5CF6',
        weight: 0.2167,
        items: [
          { 
            id: 'set-clear-tasks', 
            name: t('coaching.setClearTasks'),
            descriptions: [
              t('coaching.tasks1'),
              t('coaching.tasks2'),
              t('coaching.tasks3'),
              t('coaching.tasks4')
            ]
          },
          { 
            id: 'reached-agreement', 
            name: t('coaching.reachedAgreement'),
            descriptions: [
              t('coaching.agreement1'),
              t('coaching.agreement2'),
              t('coaching.agreement3'),
              t('coaching.agreement4')
            ]
          },
          { 
            id: 'encouraged-goal', 
            name: t('coaching.encouragedGoal'),
            descriptions: [
              t('coaching.goal1'),
              t('coaching.goal2'),
              t('coaching.goal3'),
              t('coaching.goal4')
            ]
          }
        ]
      }
    ];
  };

  const handleScoreChange = (criteriaId: string, score: number) => {
    setScores(prev => ({ ...prev, [criteriaId]: score }));
  };

  const calculateClusterScore = (clusterId: string) => {
    const categories = getCoachingCategories();
    const cluster = categories.find(c => c.id === clusterId);
    if (!cluster) return 0;

    const clusterScores = cluster.items.map(item => scores[item.id] || 0);
    const totalScore = clusterScores.reduce((sum, score) => sum + score, 0);
    return clusterScores.length > 0 ? (totalScore / clusterScores.length) * 25 : 0; // Convert to percentage
  };

  const calculateOverallScore = () => {
    const categories = getCoachingCategories();
    let weightedSum = 0;
    
    categories.forEach(category => {
      const clusterScore = calculateClusterScore(category.id);
      weightedSum += clusterScore * category.weight;
    });
    
    return weightedSum;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setError(t('evaluation.selectTeamMember'));
      return;
    }

    // Check if all required scores are provided
    const categories = getCoachingCategories();
    const allItems = categories.flatMap(c => c.items);
    const missingScores = allItems.filter(item => !scores[item.id]);
    
    if (missingScores.length > 0) {
      setError('Please provide scores for all criteria');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const evaluationItems = allItems.map(item => ({
        behaviorItemId: item.id,
        score: scores[item.id],
        comment: ''
      }));

      // Add cluster scores and overall score as additional data
      const clusterScores = categories.map(category => ({
        clusterId: category.id,
        score: calculateClusterScore(category.id),
        weight: category.weight
      }));

      const overallScore = calculateOverallScore();

      await apiService.createEvaluation({
        salespersonId: selectedUser,
        visitDate,
        customerName: customerName || undefined,
        location: location || undefined,
        overallComment: overallComment || undefined,
        items: evaluationItems,
        evaluationType: 'coaching',
        clusterScores,
        overallScore
      });

      // Show success message
      setSuccessMessage(`✅ ${t('evaluation.success')}`);
      console.log('✅ Coaching evaluation submitted successfully!');
      
      // Clear form
      setSelectedUser('');
      setCustomerName('');
      setLocation('');
      setOverallComment('');
      setScores({});
      
      // Call success callback after a short delay
      setTimeout(() => {
        onSuccess();
      }, 2000);

    } catch (err) {
      setError(t('evaluation.error'));
      console.error('Failed to submit coaching evaluation:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="evaluation-form">
        <div className="loading">{t('evaluation.loading')}</div>
      </div>
    );
  }

  const categories = getCoachingCategories();

  return (
    <div className="evaluation-form">
      <div className="form-header">
        <h2>{t('coaching.title')}</h2>
        <p>{t('coaching.description')}</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <form onSubmit={handleSubmit} className="evaluation-form-content">
        {/* Basic Information */}
        <div className="form-section">
          <h3>Basic Information</h3>
          <div className="form-group">
            <label htmlFor="selectedUser">{t('evaluation.selectTeamMember')}</label>
            <select
              id="selectedUser"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              required
            >
              <option value="">Select a Sales Lead...</option>
              {evaluatableUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.displayName} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="visitDate">{t('evaluation.visitDate')}</label>
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
              placeholder="Customer/Context"
            />
          </div>

          <div className="form-group">
            <label htmlFor="location">{t('evaluation.location')}</label>
            <input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
            />
          </div>
        </div>

        {/* Coaching Evaluation */}
        <div className="form-section">
          <h3>Coaching Skills Evaluation</h3>
          <p>Rate each criterion on a scale of 1-4 (1 = Poor, 4 = Excellent)</p>
          
          {categories.map(category => (
            <div key={category.id} className="category-section">
              <h4 style={{ color: category.color }}>
                {category.name} (Weight: {(category.weight * 100).toFixed(1)}%)
              </h4>
              
              {category.items.map(item => (
                <div key={item.id} className="criteria-item">
                  <div className="criteria-question">
                    <strong>{item.name}</strong>
                  </div>
                  
                  <div className="score-options">
                    {[1, 2, 3, 4].map(score => (
                      <label key={score} className="score-option">
                        <input
                          type="radio"
                          name={item.id}
                          value={score}
                          checked={scores[item.id] === score}
                          onChange={() => handleScoreChange(item.id, score)}
                          required
                        />
                        <div className="score-content">
                          <span className="score-number">{score}</span>
                          <span className="score-description">{item.descriptions[score - 1]}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              
              <div className="cluster-score">
                <strong>Cluster Score: {calculateClusterScore(category.id).toFixed(1)}%</strong>
              </div>
            </div>
          ))}
          
          <div className="overall-score">
            <h3>Overall Coaching Score: {calculateOverallScore().toFixed(1)}%</h3>
          </div>
        </div>

        {/* Overall Comment */}
        <div className="form-section">
          <div className="form-group">
            <label htmlFor="overallComment">{t('evaluation.overallComment')}</label>
            <textarea
              id="overallComment"
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              rows={4}
              placeholder="Overall feedback and recommendations..."
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button type="button" onClick={onCancel} className="cancel-button">
            {t('evaluation.cancel')}
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="submit-button"
          >
            {isSubmitting ? t('evaluation.loading') : t('evaluation.submit')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CoachingEvaluationForm;
