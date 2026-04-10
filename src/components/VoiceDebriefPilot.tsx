import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { apiService, BehaviorCategory } from '../services/api';
import {
  getDefaultApiCustomerType,
  hideEvaluationCustomerTypeSelector
} from '../config/evaluationUi';
import {
  buildRubricSnapshot,
  buildVoiceDebriefQuestionsFromCategories,
  VoiceDebriefRubricSnapshot
} from '../utils/voiceDebriefFromCategories';
import './VoiceDebriefPilot.css';

const STORAGE_KEY = 'voiceDebriefPilot_sessions_v1';

type SessionRecord = {
  id: string;
  createdAt: string;
  meetingStartedAt: string | null;
  meetingEndedAt: string | null;
  answers: Record<string, string>;
  /** Same rubric used to build questions — needed for AI scoring in Dev AI. */
  rubric?: VoiceDebriefRubricSnapshot;
};

type Props = {
  onClose?: () => void;
};

/** Minimal typing — Web Speech API (not always in TS lib) */
type PilotSpeechResult = { transcript: string };
type PilotSpeechResultList = { length: number; [i: number]: { [j: number]: PilotSpeechResult } };
type PilotSpeechRecognitionEvent = { resultIndex: number; results: PilotSpeechResultList };
type PilotSpeechErrorEvent = { error?: string };

type PilotRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: PilotSpeechRecognitionEvent) => void) | null;
  onerror: ((ev: PilotSpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type PilotRecognitionCtor = new () => PilotRecognition;

function getSpeechRecognitionCtor(): PilotRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: PilotRecognitionCtor;
    webkitSpeechRecognition?: PilotRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const VoiceDebriefPilot: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [categories, setCategories] = useState<BehaviorCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [customerType, setCustomerType] = useState<string>(getDefaultApiCustomerType());

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [meetingStartedAt, setMeetingStartedAt] = useState<string | null>(null);
  const [meetingEndedAt, setMeetingEndedAt] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const recRef = useRef<PilotRecognition | null>(null);
  const speechCtor = useMemo(() => getSpeechRecognitionCtor(), []);
  const prevCustomerTypeRef = useRef(customerType);

  const questions = useMemo(
    () => buildVoiceDebriefQuestionsFromCategories(categories),
    [categories]
  );

  const apiCustomerType = hideEvaluationCustomerTypeSelector
    ? getDefaultApiCustomerType()
    : customerType || undefined;

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    (async () => {
      setCategoriesError(null);
      setCategoriesLoading(true);
      try {
        const list = await apiService.getBehaviorCategories(apiCustomerType);
        if (cancelled) return;
        setCategories(list);
        if (list.length === 0) {
          setCategoriesError(
            'No scorecard categories returned. Check your role, company setup, or customer type.'
          );
        }
      } catch {
        if (!cancelled) {
          setCategories([]);
          setCategoriesError(t('evaluation.error'));
        }
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, apiCustomerType, t]);

  useEffect(() => {
    if (hideEvaluationCustomerTypeSelector) return;
    if (prevCustomerTypeRef.current !== customerType) {
      setStep(0);
      setAnswers({});
      setDraft('');
      prevCustomerTypeRef.current = customerType;
    }
  }, [customerType]);

  const current = questions[step];
  const isLast = questions.length > 0 && step >= questions.length - 1;
  const speechSupported = Boolean(speechCtor);

  const persistSession = useCallback(
    (finalAnswers: Record<string, string>) => {
      const id = crypto.randomUUID();
      const rubric = buildRubricSnapshot(categories, hideEvaluationCustomerTypeSelector ? getDefaultApiCustomerType() : customerType);
      const row: SessionRecord = {
        id,
        createdAt: new Date().toISOString(),
        meetingStartedAt,
        meetingEndedAt,
        answers: finalAnswers,
        rubric
      };
      try {
        const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as SessionRecord[];
        prev.unshift(row);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prev.slice(0, 50)));
        setSavedNotice('Saved locally (pilot). Use Dev AI → Voice debrief outcome with rubric for scored analysis.');
      } catch {
        setSavedNotice('Could not save to local storage.');
      }
    },
    [categories, customerType, meetingEndedAt, meetingStartedAt]
  );

  useEffect(() => {
    if (!current) return;
    setDraft(answers[current.id] || '');
  }, [step, current, answers]);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const startListen = useCallback(() => {
    if (!speechCtor) return;
    setSpeechError(null);
    const r = new speechCtor();
    recRef.current = r;
    r.lang = navigator.language || 'en-US';
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (ev: PilotSpeechRecognitionEvent) => {
      const ttext = ev.results[0]?.[0]?.transcript?.trim() || '';
      if (!ttext) return;
      setDraft((prev) => (prev.trim() ? `${prev.trim()} ${ttext}` : ttext));
    };
    r.onerror = (ev: PilotSpeechErrorEvent) => {
      setSpeechError(ev.error || 'speech error');
      setListening(false);
    };
    r.onend = () => setListening(false);
    try {
      r.start();
      setListening(true);
    } catch {
      setSpeechError('Could not start microphone. Try typing instead.');
      setListening(false);
    }
  }, [speechCtor]);

  const stopListen = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const saveStepAndNext = () => {
    if (!current) return;
    const nextAnswers = { ...answers, [current.id]: draft.trim() };
    setAnswers(nextAnswers);
    if (isLast) {
      persistSession(nextAnswers);
      setStep(0);
      setAnswers({});
      setDraft('');
      setMeetingStartedAt(null);
      setMeetingEndedAt(null);
    } else {
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (step <= 0) return;
    if (current) {
      setAnswers((a) => ({ ...a, [current.id]: draft.trim() }));
    }
    setStep((s) => s - 1);
  };

  if (!user?.id) {
    return (
      <div className="voice-debrief-pilot">
        <p className="voice-debrief-pilot__notice">Sign in to load your company scorecard.</p>
      </div>
    );
  }

  if (categoriesLoading) {
    return (
      <div className="voice-debrief-pilot">
        <p className="voice-debrief-pilot__lede">Loading scorecard from the server…</p>
      </div>
    );
  }

  if (categoriesError || questions.length === 0) {
    return (
      <div className="voice-debrief-pilot">
        <div className="voice-debrief-pilot__header">
          <h2>Voice debrief (pilot)</h2>
          <p className="voice-debrief-pilot__err">{categoriesError || 'No behavior items in scorecard.'}</p>
          {!hideEvaluationCustomerTypeSelector && (
            <div className="voice-debrief-pilot__form-row">
              <label htmlFor="vdp-customer-type">{t('evaluation.customerType')}</label>
              <select
                id="vdp-customer-type"
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value)}
              >
                <option value="low-share">{t('customerTypes.lowShare')}</option>
                <option value="mid-share">{t('customerTypes.midShare')}</option>
                <option value="high-share">{t('customerTypes.highShare')}</option>
              </select>
            </div>
          )}
          {onClose && (
            <button type="button" className="voice-debrief-pilot__ghost" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="voice-debrief-pilot">
      <div className="voice-debrief-pilot__header">
        <h2>Voice debrief (pilot)</h2>
        <p className="voice-debrief-pilot__lede">
          Questions are built from your live <strong>evaluation scorecard</strong> (same API as the evaluation form).
          One step per behavior — answer keys match behavior item IDs for AI scoring. Data stays on this device until
          you finish; we save a pilot copy in <strong>local storage</strong> only (no evaluation submission API).
        </p>
        {!hideEvaluationCustomerTypeSelector && (
          <div className="voice-debrief-pilot__form-row">
            <label htmlFor="vdp-customer-type">{t('evaluation.customerType')}</label>
            <select
              id="vdp-customer-type"
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
            >
              <option value="low-share">{t('customerTypes.lowShare')}</option>
              <option value="mid-share">{t('customerTypes.midShare')}</option>
              <option value="high-share">{t('customerTypes.highShare')}</option>
            </select>
          </div>
        )}
        {onClose && (
          <button type="button" className="voice-debrief-pilot__ghost" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      <div className="voice-debrief-pilot__markers">
        <button
          type="button"
          className="voice-debrief-pilot__marker"
          onClick={() => setMeetingStartedAt(new Date().toISOString())}
          disabled={!!meetingStartedAt}
        >
          {meetingStartedAt ? `Meeting started ✓` : 'Mark meeting start'}
        </button>
        <button
          type="button"
          className="voice-debrief-pilot__marker"
          onClick={() => setMeetingEndedAt(new Date().toISOString())}
          disabled={!!meetingEndedAt}
        >
          {meetingEndedAt ? `Meeting ended ✓` : 'Mark meeting end'}
        </button>
      </div>

      <div className="voice-debrief-pilot__progress">
        Question {step + 1} of {questions.length}
      </div>

      <div className="voice-debrief-pilot__card">
        <p className="voice-debrief-pilot__prompt">{current.prompt}</p>

        <textarea
          className="voice-debrief-pilot__textarea"
          rows={6}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            speechSupported
              ? 'Speak (tap Start voice input as needed) or type…'
              : 'Type your answer (voice not supported in this browser)…'
          }
          aria-label="Answer"
        />

        {speechSupported && (
          <div className="voice-debrief-pilot__voice">
            {!listening ? (
              <button type="button" className="voice-debrief-pilot__primary" onClick={startListen}>
                Start voice input
              </button>
            ) : (
              <button type="button" className="voice-debrief-pilot__danger" onClick={stopListen}>
                Stop listening
              </button>
            )}
            {speechError && <span className="voice-debrief-pilot__err">{speechError}</span>}
          </div>
        )}

        <div className="voice-debrief-pilot__actions">
          <button type="button" className="voice-debrief-pilot__ghost" onClick={goBack} disabled={step === 0}>
            Back
          </button>
          <button type="button" className="voice-debrief-pilot__primary" onClick={saveStepAndNext}>
            {isLast ? 'Finish & save pilot' : 'Next question'}
          </button>
        </div>
      </div>

      {savedNotice && <p className="voice-debrief-pilot__notice">{savedNotice}</p>}
    </div>
  );
};

export default VoiceDebriefPilot;
