import React, { useState, useEffect } from 'react';
import { apiService, User } from '../services/api';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

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
  
  // Evaluation categories from backend
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const users = await apiService.getEvaluatableUsers();
        const salespeople = users.filter(u => u.role === 'SALESPERSON');
        setEvaluatableUsers(salespeople);
        
        // Don't load categories from backend on initial load
        // Categories will be loaded based on customerType selection
        // Default to empty array to use hardcoded defaultCategories
        setCategories([]);
        console.log('✅ [SalespersonForm] Initialized, will load categories based on customerType');
      } catch (err) {
        setError(t('common:evaluation.error'));
        console.error('Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [t]);
  
  // Reload categories when customerType changes
  useEffect(() => {
    const loadCategories = async () => {
      if (!customerType) return;
      
      try {
        // Only reload categories for HIGH_SHARE
        // For LOW_SHARE and MID_SHARE, use hardcoded defaultCategories (don't reload from backend)
        if (customerType === 'HIGH_SHARE') {
          // Convert HIGH_SHARE to high-share for API
          const apiCustomerType = 'high-share';
          console.log('🔍 [SalespersonForm] Loading HIGH_SHARE categories');
          setIsLoading(true);
          const behaviorCategories = await apiService.getBehaviorCategories(apiCustomerType);
          console.log('🔍 [SalespersonForm] Received HIGH_SHARE categories:', behaviorCategories.length);
          if (behaviorCategories.length > 0) {
            console.log('🔍 [SalespersonForm] First category:', behaviorCategories[0].name);
          }
          setCategories(behaviorCategories);
          // Reset scores and examples when categories change
          setScores({});
          setExamples({});
          console.log('✅ [SalespersonForm] Loaded HIGH_SHARE categories:', behaviorCategories.length);
        } else {
          // For LOW_SHARE and MID_SHARE, clear categories to use defaultCategories fallback
          console.log('🔍 [SalespersonForm] Using default categories for:', customerType);
          setCategories([]); // Clear to trigger fallback to defaultCategories
          // Reset scores and examples when categories change
          setScores({});
          setExamples({});
          console.log('✅ [SalespersonForm] Using default categories for:', customerType);
        }
      } catch (err) {
        console.error('❌ [SalespersonForm] Failed to reload categories:', err);
        setError(t('common:evaluation.error'));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCategories();
  }, [customerType, t]);

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

  // Use categories from backend, fallback to hardcoded if empty
  const defaultCategories = [
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
  
  // Translation mapping for high-share categories and items from backend
  const translateCategoryName = (name: string): string => {
    if (name.includes('Preparation Before the Meeting')) {
      return t('salesperson:cluster1');
    }
    if (name.includes('Problem Definition')) {
      return t('salesperson:cluster2');
    }
    if (name.includes('Handling Objections')) {
      return t('salesperson:cluster3');
    }
    if (name.includes('Commercial Proposal')) {
      return t('salesperson:cluster4');
    }
    return name; // Fallback to original name
  };
  
  const translateItemName = (name: string): string => {
    // Map high-share item names to translation keys
    const itemMap: Record<string, string> = {
      'Identify core products the client uses (in their menu) but does not buy from METRO': 'coreProducts',
      'Determined type of establishment (restaurant/hotel) and cuisine style': 'establishmentType',
      'Selected 1–2 focus products for the meeting': 'focusProducts',
      'Knows where the client currently orders from and why': 'currentSupplier',
      'Analyzed client\'s restaurant prices and quality/price preferences': 'priceAnalysis',
      'Prepared strategy for focus product (e.g. which mozzarella, which brand)': 'productStrategy',
      'Visit aligned with METRO contact model': 'metroModel',
      'Did the salesperson ask about opportunities to improve collaboration with METRO?': 'Did the salesperson ask about opportunities to improve collaboration with METRO?',
      'Did the salesperson propose specific products (prepared in advance) for the customer to start sourcing from METRO?': 'Did the salesperson propose specific products (prepared in advance) for the customer to start sourcing from METRO?',
      'Did the salesperson connect the customer\'s long-term goals with the proposed new products?': 'Did the salesperson connect the customer\'s long-term goals with the proposed new products?',
      'Listened fully to objection without interrupting': 'listenedFully',
      'Validated client\'s perspective': 'validatedPerspective',
      'Put objection in market context & showed METRO\'s response': 'Put objection in market context & showed METRO\'s response',
      'Did the salesperson present a product/service as a sustainable partnership solution with METRO?': 'Did the salesperson present a product/service as a sustainable partnership solution with METRO?',
      'Did the salesperson emphasize the customer benefits of adding more products?': 'Did the salesperson emphasize the customer benefits of adding more products?',
      'Proposed test of key products': 'Proposed test of key products',
      'Did the salesperson agree on a next step with a longer-term perspective?': 'Did the salesperson agree on a next step with a longer-term perspective?'
    };
    const key = itemMap[name];
    if (key) {
      try {
        // Try using t() function first
        const translationKey = `salesperson:${key}`;
        let translated = t(translationKey);
        
        // If translation returns the key itself, try accessing resources directly
        if (translated === translationKey || translated.startsWith('salesperson:')) {
          const currentLang = i18n.language || 'en';
          const resources = i18n.getResourceBundle(currentLang, 'salesperson');
          if (resources && resources[key]) {
            translated = resources[key];
          }
        }
        
        // Check if we got a real translation
        if (translated && translated !== translationKey && !translated.startsWith('salesperson:')) {
          return translated;
        }
      } catch (err) {
        console.error('Translation error for:', name, err);
      }
    }
    return name; // Fallback to original name if no translation found
  };
  
  // Get score descriptions for high-share items
  const getItemDescriptions = (itemName: string): string[] | null => {
    // Map item names to their score description keys
    const descriptionMap: Record<string, string[]> = {
      'Identify core products the client uses (in their menu) but does not buy from METRO': [
        t('salesperson:prep1_1'),
        t('salesperson:prep1_2'),
        t('salesperson:prep1_3'),
        t('salesperson:prep1_4')
      ],
      'Determined type of establishment (restaurant/hotel) and cuisine style': [
        t('salesperson:prep2_1'),
        t('salesperson:prep2_2'),
        t('salesperson:prep2_3'),
        t('salesperson:prep2_4')
      ],
      'Selected 1–2 focus products for the meeting': [
        t('salesperson:prep3_1'),
        t('salesperson:prep3_2'),
        t('salesperson:prep3_3'),
        t('salesperson:prep3_4')
      ],
      'Knows where the client currently orders from and why': [
        t('salesperson:prep4_1'),
        t('salesperson:prep4_2'),
        t('salesperson:prep4_3'),
        t('salesperson:prep4_4')
      ],
      'Analyzed client\'s restaurant prices and quality/price preferences': [
        t('salesperson:prep5_1'),
        t('salesperson:prep5_2'),
        t('salesperson:prep5_3'),
        t('salesperson:prep5_4')
      ],
      'Prepared strategy for focus product (e.g. which mozzarella, which brand)': [
        t('salesperson:prep6_1'),
        t('salesperson:prep6_2'),
        t('salesperson:prep6_3'),
        t('salesperson:prep6_4')
      ],
      'Visit aligned with METRO contact model': [
        t('salesperson:prep7_1'),
        t('salesperson:prep7_2'),
        t('salesperson:prep7_3'),
        t('salesperson:prep7_4')
      ],
      'Did the salesperson ask about opportunities to improve collaboration with METRO?': [
        t('salesperson:highshare_prob1_1'),
        t('salesperson:highshare_prob1_2'),
        t('salesperson:highshare_prob1_3'),
        t('salesperson:highshare_prob1_4')
      ],
      'Did the salesperson propose specific products (prepared in advance) for the customer to start sourcing from METRO?': [
        t('salesperson:highshare_prob2_1'),
        t('salesperson:highshare_prob2_2'),
        t('salesperson:highshare_prob2_3'),
        t('salesperson:highshare_prob2_4')
      ],
      'Did the salesperson connect the customer\'s long-term goals with the proposed new products?': [
        t('salesperson:highshare_prob3_1'),
        t('salesperson:highshare_prob3_2'),
        t('salesperson:highshare_prob3_3'),
        t('salesperson:highshare_prob3_4')
      ],
      'Listened fully to objection without interrupting': [
        t('salesperson:obj1_1'),
        t('salesperson:obj1_2'),
        t('salesperson:obj1_3'),
        t('salesperson:obj1_4')
      ],
      'Validated client\'s perspective': [
        t('salesperson:obj2_1'),
        t('salesperson:obj2_2'),
        t('salesperson:obj2_3'),
        t('salesperson:obj2_4')
      ],
      'Put objection in market context & showed METRO\'s response': [
        t('salesperson:obj3_1'),
        t('salesperson:obj3_2'),
        t('salesperson:obj3_3'),
        t('salesperson:obj3_4')
      ],
      'Did the salesperson present a product/service as a sustainable partnership solution with METRO?': [
        t('salesperson:highshare_prop1_1'),
        t('salesperson:highshare_prop1_2'),
        t('salesperson:highshare_prop1_3'),
        t('salesperson:highshare_prop1_4')
      ],
      'Did the salesperson emphasize the customer benefits of adding more products?': [
        t('salesperson:highshare_prop2_1'),
        t('salesperson:highshare_prop2_2'),
        t('salesperson:highshare_prop2_3'),
        t('salesperson:highshare_prop2_4')
      ],
      'Proposed test of key products': [
        t('salesperson:prop3_1'),
        t('salesperson:prop3_2'),
        t('salesperson:prop3_3'),
        t('salesperson:prop3_4')
      ],
      'Did the salesperson agree on a next step with a longer-term perspective?': [
        t('salesperson:prop4_1'),
        t('salesperson:prop4_2'),
        t('salesperson:prop4_3'),
        t('salesperson:prop4_4')
      ]
    };
    return descriptionMap[itemName] || null;
  };

  const getActiveCategories = () => (categories.length > 0 ? categories : defaultCategories);

  const calculateClusterScore = (categoryId: string) => {
    const activeCategories = getActiveCategories();
    const category = activeCategories.find(c => c.id === categoryId);
    if (!category) return 0;

    const itemScores = category.items
      .map((item: any) => scores[item.id] || 0)
      .filter((score: number) => score > 0);

    if (itemScores.length === 0) return 0;

    const avgScore = itemScores.reduce((sum: number, score: number) => sum + score, 0) / itemScores.length;
    return (avgScore / 4) * 100;
  };

  const calculateOverallScore = () => {
    const activeCategories = getActiveCategories();
    let totalWeightedScore = 0;
    let totalWeight = 0;

    activeCategories.forEach(category => {
      // Check if this category has any items with valid scores
      const hasScoredItems = category.items.some((item: any) => {
        const score = scores[item.id];
        return score && score >= 1 && score <= 4;
      });

      if (hasScoredItems) {
        const clusterScore = calculateClusterScore(category.id);
        if (clusterScore > 0) {
          totalWeightedScore += clusterScore * category.weight;
          totalWeight += category.weight;
        }
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

    const activeCategories = getActiveCategories();
    const allItems = activeCategories.flatMap(category => category.items);
    
    // Check for missing or invalid scores (must be between 1 and 4)
    const missingScores = allItems.filter((item: any) => {
      const score = scores[item.id];
      return !score || score < 1 || score > 4;
    });
    
    if (missingScores.length > 0) {
      setError('Моля, оценете всички критерии с оценка между 1 и 4');
      return;
    }

    // All items have valid scores, create evaluation items
    const validScoreEntries = allItems.map((item: any) => ({
      item,
      score: scores[item.id]
    }));

    setIsSubmitting(true);
    setError('');

    try {
      // For now, create a simple mapping of our frontend IDs to generic backend format
      // The backend will store this as a JSON structure
      const useBackendCategories = categories.length > 0;
      const evaluationItems = validScoreEntries.map(({ item, score }) => ({
        behaviorItemId: useBackendCategories ? item.id : `salesperson_${customerType}_${item.id}`,
        rating: score,
        comment: examples[item.id] || ''
      }));

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

  const activeCategoriesForRender = getActiveCategories();

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

          {activeCategoriesForRender.map(category => {
            const categoryColor = category.color || '#8b5cf6';
            // Translate category name if it's from backend (high-share)
            const categoryName = categories.length > 0 ? translateCategoryName(category.name) : category.name;
            return (
            <div key={category.id} className="category-section" style={{ backgroundColor: `${categoryColor}10`, borderColor: `${categoryColor}30` }}>
              <h4 style={{ color: categoryColor }}>{categoryName}</h4>
              <div className="category-weight">Weight: {(category.weight * 100).toFixed(1)}%</div>

              {category.items.map((item: any) => {
                // Translate item name if it's from backend (high-share)
                const itemName = categories.length > 0 ? translateItemName(item.name) : item.name;
                // Get descriptions for high-share items if they don't have them
                const itemDescriptions = categories.length > 0 && (!item.descriptions || !Array.isArray(item.descriptions))
                  ? getItemDescriptions(item.name)
                  : item.descriptions;
                return (
                <div key={item.id} className="behavior-item">
                  <div className="item-header">
                    <label className="item-label">{itemName}</label>
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
                          border: scores[item.id] === score ? `3px solid ${categoryColor}` : '2px solid var(--gray-300)',
                          borderRadius: '12px',
                          background: scores[item.id] === score ? `${categoryColor}15` : 'white',
                          color: scores[item.id] === score ? categoryColor : 'var(--gray-600)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          minHeight: '64px',
                          WebkitTapHighlightColor: 'transparent',
                          touchAction: 'manipulation',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: scores[item.id] === score ? `0 4px 12px ${categoryColor}40` : 'var(--shadow-sm)'
                        }}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                  
                  {/* Show description for selected score */}
                  {scores[item.id] && itemDescriptions && Array.isArray(itemDescriptions) && itemDescriptions[scores[item.id] - 1] && (
                    <div style={{
                      background: `${categoryColor}10`,
                      border: `1px solid ${categoryColor}30`,
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
                      {itemDescriptions[scores[item.id] - 1]}
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
                      border: `2px solid ${categoryColor}30`,
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
                );
              })}

              {/* Cluster Score Display */}
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: 'white',
                borderRadius: '0.75rem',
                textAlign: 'center',
                border: `2px solid ${categoryColor}40`
              }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Cluster Score
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: categoryColor }}>
                  {calculateClusterScore(category.id).toFixed(1)}%
                </div>
              </div>
            </div>
            );
          })}
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