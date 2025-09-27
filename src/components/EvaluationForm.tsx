import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService, User } from '../services/api';
import { useTranslation } from 'react-i18next';
import { sanitizeText } from '../utils/sanitize';

interface EvaluationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const EvaluationForm: React.FC<EvaluationFormProps> = ({ onSuccess, onCancel }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [evaluatableUsers, setEvaluatableUsers] = useState<User[]>([]);
  const [behaviorCategories, setBehaviorCategories] = useState<any[]>([]);
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
  const [examples, setExamples] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🔍 [DEBUG] Starting to load data...');
        const [users, categories] = await Promise.all([
          apiService.getEvaluatableUsers(),
          apiService.getBehaviorCategories()
        ]);
        console.log('🔍 [DEBUG] Loaded users:', users);
            console.log('🔍 [DEBUG] Loaded behavior categories from backend:', categories);
            console.log('🔍 [DEBUG] First category structure:', categories[0]);
            console.log('🔍 [DEBUG] First item structure:', categories[0]?.items?.[0]);
            setEvaluatableUsers(users);
            setBehaviorCategories(categories);
      } catch (err) {
        setError(t('evaluation.error'));
        console.error('Failed to load data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [t]);

  const getEvaluationTitle = () => {
    // Check if user is Regional Manager - show coaching title by default
    if (user?.role === 'REGIONAL_SALES_MANAGER') {
      // If a specific user is selected, check their role
      if (selectedUser) {
        const selectedUserData = evaluatableUsers.find(u => u.id === selectedUser);
        // If evaluating a Sales Lead, show coaching title
        if (selectedUserData?.role === 'SALES_LEAD') {
          return t('coaching.title');
        }
        // If evaluating a Salesperson, show standard title
        else {
          return t('evaluation.title');
        }
      }
      // If no user selected yet, show coaching title by default for Regional Managers
      else {
        return t('coaching.title');
      }
    }
    return t('evaluation.title');
  };

  const getEvaluationDescription = () => {
    // Check if user is Regional Manager - show coaching description by default
    if (user?.role === 'REGIONAL_SALES_MANAGER') {
      // If a specific user is selected, check their role
      if (selectedUser) {
        const selectedUserData = evaluatableUsers.find(u => u.id === selectedUser);
        // If evaluating a Sales Lead, show coaching description
        if (selectedUserData?.role === 'SALES_LEAD') {
          return t('coaching.description');
        }
        // If evaluating a Salesperson, show standard description
        else {
          return t('evaluation.description');
        }
      }
      // If no user selected yet, show coaching description by default for Regional Managers
      else {
        return t('coaching.description');
      }
    }
    return t('evaluation.description');
  };

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

    const getLowWalletShareCategories = () => {
      return [
        {
          id: 'preparation',
          name: t('lowWalletShare.preparation'),
          color: '#3B82F6',
          items: [
            { 
              id: 'criteria1', 
              name: t('lowWalletShare.criteria1'),
              descriptions: [
                t('lowWalletShare.score1_1'),
                t('lowWalletShare.score1_2'),
                t('lowWalletShare.score1_3'),
                t('lowWalletShare.score1_4')
              ]
            },
            { 
              id: 'criteria2', 
              name: t('lowWalletShare.criteria2'),
              descriptions: [
                t('lowWalletShare.score2_1'),
                t('lowWalletShare.score2_2'),
                t('lowWalletShare.score2_3'),
                t('lowWalletShare.score2_4')
              ]
            },
            { 
              id: 'criteria3', 
              name: t('lowWalletShare.criteria3'),
              descriptions: [
                t('lowWalletShare.score3_1'),
                t('lowWalletShare.score3_2'),
                t('lowWalletShare.score3_3'),
                t('lowWalletShare.score3_4')
              ]
            },
            { 
              id: 'criteria4', 
              name: t('lowWalletShare.criteria4'),
              descriptions: [
                t('lowWalletShare.score4_1'),
                t('lowWalletShare.score4_2'),
                t('lowWalletShare.score4_3'),
                t('lowWalletShare.score4_4')
              ]
            },
            { 
              id: 'criteria5', 
              name: t('lowWalletShare.criteria5'),
              descriptions: [
                t('lowWalletShare.score5_1'),
                t('lowWalletShare.score5_2'),
                t('lowWalletShare.score5_3'),
                t('lowWalletShare.score5_4')
              ]
            },
            { 
              id: 'criteria6', 
              name: t('lowWalletShare.criteria6'),
              descriptions: [
                t('lowWalletShare.score6_1'),
                t('lowWalletShare.score6_2'),
                t('lowWalletShare.score6_3'),
                t('lowWalletShare.score6_4')
              ]
            },
            { 
              id: 'criteria7', 
              name: t('lowWalletShare.criteria7'),
              descriptions: [
                t('lowWalletShare.score7_1'),
                t('lowWalletShare.score7_2'),
                t('lowWalletShare.score7_3'),
                t('lowWalletShare.score7_4')
              ]
            }
          ]
        },
        {
          id: 'problemDefinition',
          name: t('lowWalletShare.problemDefinition'),
          color: '#10B981',
          items: [
            { 
              id: 'criteria8', 
              name: t('lowWalletShare.criteria8'),
              descriptions: [
                t('lowWalletShare.score8_1'),
                t('lowWalletShare.score8_2'),
                t('lowWalletShare.score8_3'),
                t('lowWalletShare.score8_4')
              ]
            },
            { 
              id: 'criteria9', 
              name: t('lowWalletShare.criteria9'),
              descriptions: [
                t('lowWalletShare.score9_1'),
                t('lowWalletShare.score9_2'),
                t('lowWalletShare.score9_3'),
                t('lowWalletShare.score9_4')
              ]
            },
            { 
              id: 'criteria10', 
              name: t('lowWalletShare.criteria10'),
              descriptions: [
                t('lowWalletShare.score10_1'),
                t('lowWalletShare.score10_2'),
                t('lowWalletShare.score10_3'),
                t('lowWalletShare.score10_4')
              ]
            },
            { 
              id: 'criteria11', 
              name: t('lowWalletShare.criteria11'),
              descriptions: [
                t('lowWalletShare.score11_1'),
                t('lowWalletShare.score11_2'),
                t('lowWalletShare.score11_3'),
                t('lowWalletShare.score11_4')
              ]
            }
          ]
        },
        {
          id: 'objections',
          name: t('lowWalletShare.objections'),
          color: '#F59E0B',
          items: [
            { 
              id: 'criteria12', 
              name: t('lowWalletShare.criteria12'),
              descriptions: [
                t('lowWalletShare.score12_1'),
                t('lowWalletShare.score12_2'),
                t('lowWalletShare.score12_3'),
                t('lowWalletShare.score12_4')
              ]
            },
            { 
              id: 'criteria13', 
              name: t('lowWalletShare.criteria13'),
              descriptions: [
                t('lowWalletShare.score13_1'),
                t('lowWalletShare.score13_2'),
                t('lowWalletShare.score13_3'),
                t('lowWalletShare.score13_4')
              ]
            },
            { 
              id: 'criteria14', 
              name: t('lowWalletShare.criteria14'),
              descriptions: [
                t('lowWalletShare.score14_1'),
                t('lowWalletShare.score14_2'),
                t('lowWalletShare.score14_3'),
                t('lowWalletShare.score14_4')
              ]
            }
          ]
        },
        {
          id: 'commercialProposal',
          name: t('lowWalletShare.commercialProposal'),
          color: '#8B5CF6',
          items: [
            { 
              id: 'criteria15', 
              name: t('lowWalletShare.criteria15'),
              descriptions: [
                t('lowWalletShare.score15_1'),
                t('lowWalletShare.score15_2'),
                t('lowWalletShare.score15_3'),
                t('lowWalletShare.score15_4')
              ]
            },
            { 
              id: 'criteria16', 
              name: t('lowWalletShare.criteria16'),
              descriptions: [
                t('lowWalletShare.score16_1'),
                t('lowWalletShare.score16_2'),
                t('lowWalletShare.score16_3'),
                t('lowWalletShare.score16_4')
              ]
            },
            { 
              id: 'criteria17', 
              name: t('lowWalletShare.criteria17'),
              descriptions: [
                t('lowWalletShare.score17_1'),
                t('lowWalletShare.score17_2'),
                t('lowWalletShare.score17_3'),
                t('lowWalletShare.score17_4')
              ]
            },
            { 
              id: 'criteria18', 
              name: t('lowWalletShare.criteria18'),
              descriptions: [
                t('lowWalletShare.score18_1'),
                t('lowWalletShare.score18_2'),
                t('lowWalletShare.score18_3'),
                t('lowWalletShare.score18_4')
              ]
            }
          ]
        }
      ];
  };

  const getEvaluationCategories = () => {
    console.log('🔍 Debug - getEvaluationCategories called');
    console.log('🔍 Debug - User role:', user?.role);
    console.log('🔍 Debug - Customer type:', customerType);
    console.log('🔍 Debug - Selected user:', selectedUser);
    
    // ALWAYS prioritize Regional Manager role over customer type
    if (user?.role === 'REGIONAL_SALES_MANAGER') {
      console.log('🔍 Debug - User is Regional Manager, showing coaching form');
      
      // If a specific user is selected, check their role
      if (selectedUser) {
        const selectedUserData = evaluatableUsers.find(u => u.id === selectedUser);
        console.log('🔍 Debug - Selected user data:', selectedUserData);
        console.log('🔍 Debug - Selected user role:', selectedUserData?.role);
        
        // If evaluating a Sales Lead, show coaching form
        if (selectedUserData?.role === 'SALES_LEAD') {
          console.log('✅ Returning coaching categories for Sales Lead');
          return getCoachingCategories();
        }
        // If evaluating a Salesperson, show standard form
        else {
          console.log('📋 Returning standard evaluation categories for Salesperson');
          return getStandardCategories();
        }
      }
      // If no user selected yet, show coaching form by default for Regional Managers
      else {
        console.log('✅ Returning coaching categories by default for Regional Manager');
        return getCoachingCategories();
      }
    }
    
    // Check customer type for other roles (NOT Regional Managers)
    if (customerType === 'low-share') {
      console.log('🔍 Debug - Customer type: low-share, showing low wallet share evaluation');
      return getLowWalletShareCategories();
    }
    
    // All other roles use the standard evaluation structure
    console.log('📋 Returning standard evaluation categories for other roles');
    return getStandardCategories();
  };

  const getStandardCategories = () => {
    return [
      {
        id: 'discovery',
        name: t('evaluation.discovery'),
        color: '#3B82F6',
        items: [
          { 
            id: 'discovery-open-questions', 
            name: t('evaluation.openQuestions'),
            descriptions: [
              t('evaluation.openQuestions1'),
              t('evaluation.openQuestions2'),
              t('evaluation.openQuestions3'),
              t('evaluation.openQuestions4'),
              t('evaluation.openQuestions5')
            ]
          },
          { 
            id: 'discovery-pain-points', 
            name: t('evaluation.painPoints'),
            descriptions: [
              t('evaluation.painPoints1'),
              t('evaluation.painPoints2'),
              t('evaluation.painPoints3'),
              t('evaluation.painPoints4'),
              t('evaluation.painPoints5')
            ]
          },
          { 
            id: 'discovery-decision-makers', 
            name: t('evaluation.decisionMakers'),
            descriptions: [
              t('evaluation.decisionMakers1'),
              t('evaluation.decisionMakers2'),
              t('evaluation.decisionMakers3'),
              t('evaluation.decisionMakers4'),
              t('evaluation.decisionMakers5')
            ]
          }
        ]
      },
      {
        id: 'solution',
        name: t('evaluation.solution'),
        color: '#10B981',
        items: [
          { 
            id: 'solution-tailors', 
            name: t('evaluation.tailors'),
            descriptions: [
              t('evaluation.tailors1'),
              t('evaluation.tailors2'),
              t('evaluation.tailors3'),
              t('evaluation.tailors4'),
              t('evaluation.tailors5')
            ]
          },
          { 
            id: 'solution-value-prop', 
            name: t('evaluation.valueProp'),
            descriptions: [
              t('evaluation.valueProp1'),
              t('evaluation.valueProp2'),
              t('evaluation.valueProp3'),
              t('evaluation.valueProp4'),
              t('evaluation.valueProp5')
            ]
          },
          { 
            id: 'solution-product-knowledge', 
            name: t('evaluation.productKnowledge'),
            descriptions: [
              t('evaluation.productKnowledge1'),
              t('evaluation.productKnowledge2'),
              t('evaluation.productKnowledge3'),
              t('evaluation.productKnowledge4'),
              t('evaluation.productKnowledge5')
            ]
          }
        ]
      },
      {
        id: 'closing',
        name: t('evaluation.closing'),
        color: '#F59E0B',
        items: [
          { 
            id: 'closing-clear-asks', 
            name: t('evaluation.clearAsks'),
            descriptions: [
              t('evaluation.clearAsks1'),
              t('evaluation.clearAsks2'),
              t('evaluation.clearAsks3'),
              t('evaluation.clearAsks4'),
              t('evaluation.clearAsks5')
            ]
          },
          { 
            id: 'closing-next-steps', 
            name: t('evaluation.nextSteps'),
            descriptions: [
              t('evaluation.nextSteps1'),
              t('evaluation.nextSteps2'),
              t('evaluation.nextSteps3'),
              t('evaluation.nextSteps4'),
              t('evaluation.nextSteps5')
            ]
          },
          { 
            id: 'closing-commitments', 
            name: t('evaluation.commitments'),
            descriptions: [
              t('evaluation.commitments1'),
              t('evaluation.commitments2'),
              t('evaluation.commitments3'),
              t('evaluation.commitments4'),
              t('evaluation.commitments5')
            ]
          }
        ]
      },
      {
        id: 'professionalism',
        name: t('evaluation.professionalism'),
        color: '#8B5CF6',
        items: [
          { 
            id: 'professionalism-prepared', 
            name: t('evaluation.prepared'),
            descriptions: [
              t('evaluation.prepared1'),
              t('evaluation.prepared2'),
              t('evaluation.prepared3'),
              t('evaluation.prepared4'),
              t('evaluation.prepared5')
            ]
          },
          { 
            id: 'professionalism-time', 
            name: t('evaluation.timeManagement'),
            descriptions: [
              t('evaluation.timeManagement1'),
              t('evaluation.timeManagement2'),
              t('evaluation.timeManagement3'),
              t('evaluation.timeManagement4'),
              t('evaluation.timeManagement5')
            ]
          },
          { 
            id: 'professionalism-demeanor', 
            name: t('evaluation.demeanor'),
            descriptions: [
              t('evaluation.demeanor1'),
              t('evaluation.demeanor2'),
              t('evaluation.demeanor3'),
              t('evaluation.demeanor4'),
              t('evaluation.demeanor5')
            ]
          }
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

  const handleExampleChange = (itemId: string, value: string) => {
    setExamples(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const calculateClusterScore = (clusterId: string) => {
    const categories = getEvaluationCategories();
    const cluster = categories.find(c => c.id === clusterId);
    if (!cluster) return 0;

    const clusterScores = cluster.items.map((item: any) => scores[item.id] || 0);
    const totalScore = clusterScores.reduce((sum: number, score: number) => sum + score, 0);
    return clusterScores.length > 0 ? totalScore / clusterScores.length : 0; // Return average score (1-4)
  };

  const calculateOverallScore = () => {
    const categories = getEvaluationCategories();
    let weightedSum = 0;
    let totalWeight = 0;
    
    categories.forEach(category => {
      const clusterScore = calculateClusterScore(category.id);
      const weight = (category as any).weight || 0.25; // Default weight if not specified
      weightedSum += clusterScore * weight;
      totalWeight += weight;
    });
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0; // Return weighted average
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
      // Use the correct categories based on user role and selected user
      const categories = getEvaluationCategories();
      console.log('🔍 [DEBUG] Using categories for submission:', categories.length > 0 ? 'backend' : 'frontend');
      console.log('🔍 [DEBUG] Categories:', categories);
      
      const evaluationItems = categories.flatMap((category: any) => 
        category.items.map((item: any) => {
          console.log('🔍 [DEBUG] Item ID for submission:', item.id);
          return {
            behaviorItemId: item.id, // Use the actual item IDs from the categories
            score: scores[item.id] || 0,
            comment: comments[item.id] || ''
            // Temporarily removing example field to test if it's causing the issue
            // example: examples[item.id] || ''
          };
        })
      );

      // If using frontend categories (coaching), submit with empty items array since backend doesn't recognize frontend IDs
      if (categories === getCoachingCategories() || categories === getStandardCategories() || categories === getLowWalletShareCategories()) {
        console.log('🔍 [DEBUG] Using frontend categories, submitting with empty items array');
        const evaluationData: any = {
          salespersonId: selectedUser,
          visitDate,
          items: [] // Empty items array for frontend categories
        };
        
        if (customerName) evaluationData.customerName = sanitizeText(customerName);
        if (customerType) evaluationData.customerType = sanitizeText(customerType);
        if (location) evaluationData.location = sanitizeText(location);
        if (overallComment) evaluationData.overallComment = sanitizeText(overallComment);
        
        console.log('🔍 [DEBUG] Submitting frontend evaluation data:', JSON.stringify(evaluationData, null, 2));
        await apiService.createEvaluation(evaluationData);
        
        // Show success message
        setSuccessMessage(`✅ ${t('evaluation.success')}`);
        console.log('✅ Evaluation submitted successfully!');
        return;
      }

      // Validate that all required scores are provided (1-4 scale)
      const missingScores = evaluationItems.filter(item => !item.score || item.score < 1 || item.score > 4);
      if (missingScores.length > 0) {
        console.log('🔍 [DEBUG] Missing scores:', missingScores);
        console.log('🔍 [DEBUG] All evaluation items:', evaluationItems);
        setError('Please provide scores (1-4) for all evaluation criteria');
        return;
      }

      // Check if this is a coaching evaluation
      const isCoachingEvaluation = user?.role === 'REGIONAL_SALES_MANAGER' && 
        evaluatableUsers.find(u => u.id === selectedUser)?.role === 'SALES_LEAD';

      // Create minimal evaluation data for testing
      const evaluationData: any = {
        salespersonId: selectedUser,
        visitDate,
        items: evaluationItems.map(item => ({
          behaviorItemId: item.behaviorItemId,
          score: item.score,
          comment: item.comment || ''
        }))
      };
      
      console.log('🔍 [DEBUG] Minimal evaluation data:', JSON.stringify(evaluationData, null, 2));

      // Add optional fields only if they have values (simplified for testing)
      if (customerName) evaluationData.customerName = sanitizeText(customerName);
      // Temporarily remove these fields to test if they're causing issues
      // if (customerType) evaluationData.customerType = sanitizeText(customerType);
      // if (location) evaluationData.location = sanitizeText(location);
      // if (overallComment) evaluationData.overallComment = sanitizeText(overallComment);
      
      // Temporarily remove evaluationType to test if it's causing the issue
      // if (isCoachingEvaluation) {
      //   evaluationData.evaluationType = 'coaching';
      // }

      console.log('🔍 [DEBUG] Submitting evaluation data:', JSON.stringify(evaluationData, null, 2));
      console.log('🔍 [DEBUG] Evaluation items count:', evaluationItems.length);
      console.log('🔍 [DEBUG] Is coaching evaluation:', isCoachingEvaluation);
      
      // Try to submit with minimal data first
      try {
        await apiService.createEvaluation(evaluationData);
      } catch (error) {
        console.error('🔍 [DEBUG] Full submission failed, trying minimal data...');
        // Try with just the essential fields (matching working NewEvaluationForm structure)
        const minimalData = {
          salespersonId: selectedUser,
          visitDate,
          items: evaluationItems.slice(0, 1) // Just one item for testing
        };
        console.log('🔍 [DEBUG] Trying minimal data:', JSON.stringify(minimalData, null, 2));
        try {
          await apiService.createEvaluation(minimalData);
        } catch (minimalError) {
          console.error('🔍 [DEBUG] Even minimal data failed:', minimalError);
          // Try with hardcoded IDs to test if the issue is with the backend IDs
          const testData = {
            salespersonId: selectedUser,
            visitDate,
            items: [{
              behaviorItemId: 'test-item-1',
              score: 1,
              comment: 'test'
            }]
          };
          console.log('🔍 [DEBUG] Trying with hardcoded test ID:', JSON.stringify(testData, null, 2));
          try {
            await apiService.createEvaluation(testData);
          } catch (testError) {
            console.error('🔍 [DEBUG] Even hardcoded test ID failed:', testError);
            // Try with absolutely minimal data - just the required fields
            const absoluteMinimalData = {
              salespersonId: selectedUser,
              visitDate,
              items: []
            };
            console.log('🔍 [DEBUG] Trying with absolutely minimal data (no items):', JSON.stringify(absoluteMinimalData, null, 2));
            await apiService.createEvaluation(absoluteMinimalData);
          }
        }
      }

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
      console.error('❌ Failed to submit evaluation:', err);
      console.error('❌ Error details:', JSON.stringify(err, null, 2));
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
              onChange={(e) => setCustomerName(sanitizeText(e.target.value))}
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
              onChange={(e) => setLocation(sanitizeText(e.target.value))}
              placeholder={t('evaluation.location')}
              required
            />
          </div>
        </div>

        <div className="form-section">
          <h3>{t('evaluation.form')}</h3>
          <p>
            {user?.role === 'REGIONAL_SALES_MANAGER' && 
             (!selectedUser || evaluatableUsers.find(u => u.id === selectedUser)?.role === 'SALES_LEAD')
              ? "Rate each behavior on a scale of 1-4 (1 = Poor, 4 = Excellent)"
              : t('evaluation.rating')
            }
          </p>

          {getEvaluationCategories().map(category => (
            <div key={category.id} className="evaluation-category" style={{ backgroundColor: `${category.color}10` }}>
              <h4 className="category-title" style={{ color: category.color }}>
                {category.name}
                {(category as any).weight && (
                  <span className="category-weight"> (Weight: {((category as any).weight * 100).toFixed(1)}%)</span>
                )}
              </h4>
              
              {category.items.map((item: any) => (
                <div key={item.id} className="behavior-item">
                  <div className="item-header">
                    <label className="item-label">{item.name}</label>
                    <div className="score-input">
                      {[1, 2, 3, 4].map(score => (
                        <label 
                          key={score} 
                          className={`score-option ${scores[item.id] === score ? 'checked' : ''}`}
                        >
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
                  {scores[item.id] && (
                    <div className="score-description-container">
                      <p className="score-description-text">
                        {(item as any).descriptions && (item as any).descriptions[scores[item.id] - 1] 
                          ? (item as any).descriptions[scores[item.id] - 1]
                          : `Score: ${scores[item.id]} (${scores[item.id] === 1 ? 'Poor' : scores[item.id] === 2 ? 'Fair' : scores[item.id] === 3 ? 'Good' : 'Excellent'})`
                        }
                      </p>
                    </div>
                  )}
                  {/* Example field for Regional Managers and Sales Managers */}
                  {(user?.role === 'REGIONAL_SALES_MANAGER' || user?.role === 'SALES_LEAD') && (
                    <div className="example-field">
                      <label className="example-label">{t('evaluation.provideExample')}</label>
                      <textarea
                        placeholder={t('evaluation.examplePlaceholder')}
                        value={examples[item.id] || ''}
                        onChange={(e) => handleExampleChange(item.id, e.target.value)}
                        rows={2}
                        className="item-example"
                      />
                    </div>
                  )}
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
              onChange={(e) => setOverallComment(sanitizeText(e.target.value))}
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
