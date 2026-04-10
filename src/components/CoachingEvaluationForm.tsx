import React, { useState, useEffect, useRef } from 'react';
import { apiService, User } from '../services/api';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useAuth } from '../contexts/AuthContext';

interface CoachingEvaluationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const API_BASE = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
// Dictation hard limit for comment fields
const MAX_DICTATION_COMMENT_CHARS = 2000;

const sanitizeObjectArtifacts = (value: string) =>
  String(value || '')
    .replace(/\[object Object\]/gi, '')
    .replace(/\bobject object\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const toUserFriendlyTranscriptionError = (raw: unknown, isBg: boolean) => {
  const msg =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object' && 'message' in raw
        ? String((raw as { message?: unknown }).message || '')
        : '';
  const lower = msg.toLowerCase();
  if (
    lower.includes('too large') ||
    lower.includes('payload') ||
    lower.includes('entity too large') ||
    lower.includes('413') ||
    lower.includes('[object object]') ||
    lower.includes('object object')
  ) {
    return isBg
      ? 'Достигнат е лимитът за запис. Записаното е запазено; допиши остатъка ръчно.'
      : 'Recording limit reached. Saved transcription is kept; type the rest manually.';
  }
  return msg || (isBg ? 'Грешка при транскрипция.' : 'Transcription failed.');
};

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
  const [sectionStates, setSectionStates] = useState<Record<string, { na: boolean; comment: string }>>({});
  const sectionCommentRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [activeVoiceTarget, setActiveVoiceTarget] = useState<string | null>(null);
  const [transcribingTarget, setTranscribingTarget] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceErrorTarget, setVoiceErrorTarget] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
      } catch {
        // ignore
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

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
    const cleaned = sanitizeObjectArtifacts(comment);
    setClusterComments(prev => ({ ...prev, [categoryId]: cleaned }));
  };

  const getSectionState = (sectionId: string) => sectionStates[sectionId] || { na: false, comment: '' };

  const clearSectionScores = (itemIds: string[]) => {
    setScores((prev) => {
      const next = { ...prev };
      itemIds.forEach((id) => delete next[id]);
      return next;
    });
  };

  const handleSectionNaToggle = (sectionId: string, nextNa: boolean, itemIds: string[]) => {
    if (nextNa) {
      const ok = window.confirm('Are you sure? This will remove all scores in this section.');
      if (!ok) return;
      clearSectionScores(itemIds);
      setSectionStates((prev) => ({
        ...prev,
        [sectionId]: { na: true, comment: prev[sectionId]?.comment || '' },
      }));
      setTimeout(() => {
        sectionCommentRefs.current[sectionId]?.focus();
      }, 0);
      return;
    }
    setSectionStates((prev) => ({
      ...prev,
      [sectionId]: { na: false, comment: '' },
    }));
  };

  const appendWithLimit = (prev: string, incoming: string) => {
    const safePrev = sanitizeObjectArtifacts(prev);
    const safeIncoming = sanitizeObjectArtifacts(incoming);
    if (!safeIncoming) {
      return { value: safePrev, hitLimit: false };
    }
    const merged = safePrev ? `${safePrev} ${safeIncoming}` : safeIncoming;
    if (merged.length <= MAX_DICTATION_COMMENT_CHARS) {
      return { value: merged, hitLimit: false };
    }
    return { value: merged.slice(0, MAX_DICTATION_COMMENT_CHARS), hitLimit: true };
  };

  const transcribeAudioBlob = async (blob: Blob) => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const raw = result.includes(',') ? result.split(',')[1] : result;
        resolve(raw);
      };
      reader.onerror = () => reject(new Error('Failed to read audio'));
      reader.readAsDataURL(blob);
    });

    const response = await fetch(`${API_BASE}/dev/ai/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64: base64,
        mimeType: blob.type || 'audio/webm',
        language: 'bg',
        model: 'whisper-1'
      })
    });
    const raw = await response.text();
    let payload: any = null;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = null;
    }
    if (!payload) {
      throw new Error(
        i18n.language === 'bg'
          ? 'Грешка при транскрипция: сървърът върна невалиден отговор.'
          : 'Transcription failed: server returned a non-JSON response.'
      );
    }
    if (!response.ok) {
      const payloadErr =
        typeof payload?.error === 'string'
          ? payload.error
          : typeof payload?.error?.message === 'string'
            ? payload.error.message
            : `Transcription failed (HTTP ${response.status})`;
      throw new Error(payloadErr);
    }
    const rawText =
      typeof payload?.text === 'string'
        ? payload.text
        : typeof payload?.text?.text === 'string'
          ? payload.text.text
          : '';
    return String(rawText || '').trim();
  };

  const stopVoiceInput = () => {
    try {
      recorderRef.current?.stop();
    } catch {
      // ignore
    }
  };

  const startVoiceInput = (targetId: string, appendText: (text: string) => void) => {
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setVoiceError(i18n.language === 'bg' ? 'Аудио записът не се поддържа в този браузър.' : 'Audio recording is not supported in this browser.');
        setVoiceErrorTarget(targetId);
        return;
      }
      setVoiceError(null);
      setVoiceErrorTarget(null);
      if (activeVoiceTarget && activeVoiceTarget !== targetId) {
        stopVoiceInput();
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
        const mimeType = preferred.find((m) => {
          try {
            return MediaRecorder.isTypeSupported(m);
          } catch {
            return false;
          }
        });
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        recorderRef.current = recorder;
        let stopped = false;
        const chunks: Blob[] = [];

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            chunks.push(ev.data);
          }
        };
        recorder.onerror = () => {
          setVoiceError(i18n.language === 'bg' ? 'Грешка при записа на аудио.' : 'Audio recording failed.');
          setVoiceErrorTarget(targetId);
          setActiveVoiceTarget(null);
        };
        recorder.onstop = async () => {
          if (stopped) return;
          stopped = true;
          setActiveVoiceTarget(null);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
          recorderRef.current = null;
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          if (blob.size < 800) return;
          setTranscribingTarget(targetId);
          try {
            const text = String(await transcribeAudioBlob(blob)).trim();
            if (!text || text === '[object Object]' || text.toLowerCase() === 'object object') {
              setVoiceError(toUserFriendlyTranscriptionError('object object', i18n.language === 'bg'));
              setVoiceErrorTarget(targetId);
              return;
            }
            appendText(text);
          } catch (e) {
            setVoiceError(toUserFriendlyTranscriptionError(e, i18n.language === 'bg'));
            setVoiceErrorTarget(targetId);
          } finally {
            setTranscribingTarget(null);
          }
        };

        recorder.start();
        setActiveVoiceTarget(targetId);
      } catch {
        setVoiceError(i18n.language === 'bg' ? 'Не може да се стартира микрофонът.' : 'Could not start microphone.');
        setVoiceErrorTarget(targetId);
        setActiveVoiceTarget(null);
      }
    })();
  };

  const calculateClusterScore = (categoryId: string) => {
    if (getSectionState(categoryId).na) return null;
    const category = categories.find(c => c.id === categoryId);
    if (!category) return null;

    const itemScores = category.items
      .map(item => scores[item.id] || 0)
      .filter(score => score > 0);

    if (itemScores.length === 0) return null;

    const avgScore = itemScores.reduce((sum, score) => sum + score, 0) / itemScores.length;
    return (avgScore / 4) * 100;
  };

  const calculateOverallScore = () => {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    categories.forEach(category => {
      const clusterScore = calculateClusterScore(category.id);
      if (typeof clusterScore === 'number' && clusterScore > 0) {
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
    const notNaCount = categories.filter((category) => !getSectionState(category.id).na).length;
    if (notNaCount === 0) {
      setError('At least one section must not be marked as N/A.');
      return;
    }
    for (const category of categories) {
      const s = getSectionState(category.id);
      if (s.na) {
        if (!(clusterComments[category.id] || '').trim()) {
          setError(
            i18n.language === 'bg'
              ? 'Добавете обяснение защо секцията е N/A.'
              : 'Explain why this section is not applicable.'
          );
          return;
        }
        continue;
      }
      for (const item of category.items) {
        const score = scores[item.id];
        if (!score || score < 1 || score > 4) {
          setError('Моля, оценете всички критерии с оценка между 1 и 4');
          return;
        }
      }
      if (!(clusterComments[category.id] || '').trim()) {
        setError(
          i18n.language === 'bg'
            ? 'Трябва да дадете конкретен пример, като коментар след всяка секция.'
            : 'You need to give a concrete example as a comment after each stage to submit the evaluation form.'
        );
        return;
      }
    }

    // All items have valid scores, create evaluation items
    const categoryByItemId = categories.reduce<Record<string, string>>((acc, category) => {
      category.items.forEach(item => {
        acc[item.id] = category.id;
      });
      return acc;
    }, {});

    const evaluationItems = categories
      .filter((category) => !getSectionState(category.id).na)
      .flatMap((category) => category.items)
      .map(item => {
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
            <div
              key={category.id}
              className={`category-section ${getSectionState(category.id).na ? 'evaluation-category-na' : ''}`}
              style={{ backgroundColor: `${category.color}10`, borderColor: `${category.color}30` }}
            >
              <h4 style={{ color: category.color }}>{category.name}</h4>
              <div className="category-weight">Weight: {(category.weight * 100).toFixed(0)}%</div>
              <div className="section-na-row">
                <label className="section-na-toggle">
                  <input
                    type="checkbox"
                    checked={getSectionState(category.id).na}
                    onChange={(e) =>
                      handleSectionNaToggle(
                        category.id,
                        e.target.checked,
                        category.items.map((item) => item.id)
                      )
                    }
                  />
                  <span>Not applicable for this visit</span>
                </label>
              </div>
              {getSectionState(category.id).na && (
                <div className="section-na-details">
                  <p className="section-na-helper">This section will not affect the score</p>
                </div>
              )}

              {!getSectionState(category.id).na && category.items.map(item => (
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
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = `cluster:${category.id}`;
                      if (activeVoiceTarget === targetId) {
                        stopVoiceInput();
                        return;
                      }
                      startVoiceInput(targetId, (t) => {
                        setClusterComments(prev => {
                          const current = prev[category.id] || '';
                          const out = appendWithLimit(current, t);
                          if (out.hitLimit) {
                            setVoiceError(
                              i18n.language === 'bg'
                                ? `Достигнат е лимитът за диктовка (${MAX_DICTATION_COMMENT_CHARS} символа).`
                                : `Dictation limit reached (${MAX_DICTATION_COMMENT_CHARS} characters).`
                            );
                            setVoiceErrorTarget(targetId);
                            stopVoiceInput();
                          }
                          return { ...prev, [category.id]: out.value };
                        });
                      });
                    }}
                    title={activeVoiceTarget === `cluster:${category.id}` ? 'Stop voice input' : 'Start voice input'}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '10px',
                      width: '32px',
                      height: '32px',
                      borderRadius: '999px',
                      border: 'none',
                      background: 'transparent',
                      color: '#3f4349',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2
                    }}
                    aria-label={activeVoiceTarget === `cluster:${category.id}` ? 'Stop voice input' : 'Start voice input'}
                  >
                    {activeVoiceTarget === `cluster:${category.id}` ? (
                      <span
                        aria-hidden="true"
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '999px',
                          background: '#ef4444',
                          boxShadow: '0 0 0 0 rgba(239,68,68,.65)',
                          animation: 'voicePulse 1.25s ease-out infinite'
                        }}
                      />
                    ) : (
                      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V7a3.5 3.5 0 1 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Zm6-3.5a1 1 0 0 0-2 0 4 4 0 1 1-8 0 1 1 0 0 0-2 0 6 6 0 0 0 5 5.91V20H9.5a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2H13v-2.09A6 6 0 0 0 18 12Z"
                        />
                      </svg>
                    )}
                  </button>
                  <textarea
                    placeholder={i18n.language === 'bg' ? 'Дай конкретен пример от разговора' : 'Give concrete example from the conversation'}
                    value={clusterComments[category.id] || ''}
                    onChange={(e) => handleClusterCommentChange(category.id, e.target.value)}
                    ref={(el) => {
                      sectionCommentRefs.current[category.id] = el;
                    }}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px 48px 12px 12px',
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
                {activeVoiceTarget === `cluster:${category.id}` && (
                  <div style={{ marginTop: '0.35rem', marginBottom: '0.5rem', fontSize: '0.78rem', color: '#b91c1c' }}>
                    {i18n.language === 'bg' ? 'Записва... натисни иконата, за да спреш.' : 'Recording... tap the icon to stop.'}
                  </div>
                )}
                {transcribingTarget === `cluster:${category.id}` && (
                  <div style={{ marginTop: '0.35rem', marginBottom: '0.5rem', fontSize: '0.78rem', color: '#475569' }}>
                    {i18n.language === 'bg' ? 'Транскрибиране...' : 'Transcribing...'}
                  </div>
                )}
                {voiceError && voiceErrorTarget === `cluster:${category.id}` && (
                  <div style={{ marginBottom: '0.5rem', fontSize: '0.8rem', color: '#b91c1c' }}>
                    {voiceError}
                  </div>
                )}
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
                  {typeof calculateClusterScore(category.id) === 'number'
                    ? `${calculateClusterScore(category.id)!.toFixed(1)}%`
                    : 'N/A'}
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
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  if (activeVoiceTarget === 'overall') {
                    stopVoiceInput();
                    return;
                  }
                  startVoiceInput('overall', (t) => {
                    setOverallComment((prev) => {
                      const out = appendWithLimit(prev, t);
                      if (out.hitLimit) {
                        setVoiceError(
                          i18n.language === 'bg'
                            ? `Достигнат е лимитът за диктовка (${MAX_DICTATION_COMMENT_CHARS} символа).`
                            : `Dictation limit reached (${MAX_DICTATION_COMMENT_CHARS} characters).`
                        );
                        setVoiceErrorTarget('overall');
                        stopVoiceInput();
                      }
                      return out.value;
                    });
                  });
                }}
                title={activeVoiceTarget === 'overall' ? 'Stop voice input' : 'Start voice input'}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '10px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '999px',
                  border: 'none',
                  background: 'transparent',
                  color: '#3f4349',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2
                }}
                aria-label={activeVoiceTarget === 'overall' ? 'Stop voice input' : 'Start voice input'}
              >
                {activeVoiceTarget === 'overall' ? (
                  <span
                    aria-hidden="true"
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '999px',
                      background: '#ef4444',
                      boxShadow: '0 0 0 0 rgba(239,68,68,.65)',
                      animation: 'voicePulse 1.25s ease-out infinite'
                    }}
                  />
                ) : (
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V7a3.5 3.5 0 1 0-7 0v5a3.5 3.5 0 0 0 3.5 3.5Zm6-3.5a1 1 0 0 0-2 0 4 4 0 1 1-8 0 1 1 0 0 0-2 0 6 6 0 0 0 5 5.91V20H9.5a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2H13v-2.09A6 6 0 0 0 18 12Z"
                    />
                  </svg>
                )}
              </button>
              <textarea
                id="overallComment"
                value={overallComment}
                onChange={(e) =>
                  setOverallComment(sanitizeObjectArtifacts(e.target.value))
                }
                rows={4}
                placeholder="Provide overall feedback and recommendations..."
                style={{ paddingRight: '48px' }}
              />
            </div>
            {activeVoiceTarget === 'overall' && (
              <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#b91c1c' }}>
                {i18n.language === 'bg' ? 'Записва... натисни иконата, за да спреш.' : 'Recording... tap the icon to stop.'}
              </div>
            )}
            {transcribingTarget === 'overall' && (
              <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#475569' }}>
                {i18n.language === 'bg' ? 'Транскрибиране...' : 'Transcribing...'}
              </div>
            )}
            {voiceError && voiceErrorTarget === 'overall' && (
              <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#b91c1c' }}>
                {voiceError}
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes voicePulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,.65); }
            70% { transform: scale(1.06); box-shadow: 0 0 0 10px rgba(239,68,68,0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          }
        `}</style>

        {error && (
          <div
            className="error-message"
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              lineHeight: 1.45,
              padding: '0.9rem 1rem',
              borderWidth: '2px',
              marginBottom: '1rem'
            }}
          >
            {error}
          </div>
        )}

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