import React, { useCallback, useEffect, useRef, useState } from 'react';
import './DevAiPlayground.css';

const API_BASE = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const VOICE_STORAGE_KEY = 'voiceDebriefPilot_sessions_v1';

/** Cap turns sent to the API to stay within reasonable context limits (system prompt is added server-side). */
const MAX_CHAT_MESSAGES = 48;

type Mode = 'chat' | 'command' | 'debrief';

type ChatTurn = { role: 'user' | 'assistant'; content: string };

type Props = {
  /** When AI returns a safe allowlisted tab, switch the app (dev command mode). */
  onNavigate?: (tab: string) => void;
};

const DevAiPlayground: React.FC<Props> = ({ onNavigate }) => {
  const [mode, setMode] = useState<Mode>('chat');
  const [status, setStatus] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [commandText, setCommandText] = useState('Go to history');
  const [debriefJson, setDebriefJson] = useState('{}');
  const [rubricJson, setRubricJson] = useState('{}');
  const [model, setModel] = useState('gpt-4o-mini');
  const [out, setOut] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [navMsg, setNavMsg] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch(`${API_BASE}/dev/ai/status`);
      const j = await r.json();
      setStatus(JSON.stringify(j, null, 2));
    } catch (e) {
      setStatus(null);
      setErr((e as Error).message);
    }
  }, []);

  const loadLastVoicePilot = () => {
    try {
      const raw = localStorage.getItem(VOICE_STORAGE_KEY);
      if (!raw) {
        setErr('No voice debrief pilot data in localStorage yet. Finish Voice debrief first.');
        return;
      }
      const arr = JSON.parse(raw) as Array<{
        answers?: Record<string, string>;
        rubric?: { categories?: unknown[] };
      }>;
      const last = arr[0];
      if (!last?.answers) {
        setErr('Last session has no answers.');
        return;
      }
      setDebriefJson(JSON.stringify(last.answers, null, 2));
      setRubricJson(last.rubric ? JSON.stringify(last.rubric, null, 2) : '{}');
      setErr(null);
      setNavMsg(
        last.rubric?.categories
          ? 'Loaded answers + scorecard rubric from last Voice debrief (for 1–4 scoring).'
          : 'Loaded answers from last Voice debrief (no rubric in save — add rubric JSON for scored criteria).'
      );
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || loading) return;

    const userMsg: ChatTurn = { role: 'user', content: text };
    const threadForApi = [...chatMessages, userMsg];
    const capped =
      threadForApi.length > MAX_CHAT_MESSAGES ? threadForApi.slice(-MAX_CHAT_MESSAGES) : threadForApi;

    setLoading(true);
    setErr(null);
    setOut(null);
    setNavMsg(null);
    setChatInput('');
    setChatMessages(threadForApi);

    try {
      const r = await fetch(`${API_BASE}/dev/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: capped.map((m) => ({ role: m.role, content: m.content }))
        })
      });
      const j = await r.json();
      setOut(JSON.stringify(j, null, 2));
      if (!r.ok) {
        setErr(`HTTP ${r.status}`);
        setChatMessages((prev) => (prev.length > 0 && prev[prev.length - 1]?.role === 'user' ? prev.slice(0, -1) : prev));
        setChatInput(text);
        return;
      }
      const assistantContent = j?.choices?.[0]?.message?.content;
      const reply =
        typeof assistantContent === 'string'
          ? assistantContent
          : assistantContent != null
            ? String(assistantContent)
            : '';
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply || '(empty reply)' }]);
    } catch (e) {
      setErr((e as Error).message);
      setChatMessages((prev) => (prev.length > 0 && prev[prev.length - 1]?.role === 'user' ? prev.slice(0, -1) : prev));
      setChatInput(text);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
    setChatInput('');
    setOut(null);
    setErr(null);
  };

  useEffect(() => {
    if (mode !== 'chat') return;
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chatMessages, mode, loading]);

  const sendCommand = async () => {
    setLoading(true);
    setErr(null);
    setOut(null);
    setNavMsg(null);
    try {
      const r = await fetch(`${API_BASE}/dev/ai/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, text: commandText })
      });
      const j = await r.json();
      setOut(JSON.stringify(j, null, 2));
      if (!r.ok) {
        setErr(`HTTP ${r.status}`);
        return;
      }
      const reply = typeof j.reply === 'string' ? j.reply : '';
      const nav = typeof j.navigate === 'string' ? j.navigate : null;
      if (nav && onNavigate) {
        onNavigate(nav);
        setNavMsg(`Navigated to: ${nav}`);
      } else if (reply) {
        setNavMsg(reply);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const sendDebrief = async () => {
    setLoading(true);
    setErr(null);
    setOut(null);
    setNavMsg(null);
    let answers: Record<string, string>;
    try {
      answers = JSON.parse(debriefJson);
      if (typeof answers !== 'object' || answers === null || Array.isArray(answers)) {
        throw new Error('JSON must be an object of behaviorItemId -> answer');
      }
    } catch (e) {
      setErr(`Invalid JSON: ${(e as Error).message}`);
      setLoading(false);
      return;
    }
    let rubric: unknown = undefined;
    try {
      const trimmed = rubricJson.trim();
      if (trimmed && trimmed !== '{}') {
        const parsed = JSON.parse(rubricJson);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray((parsed as any).categories)) {
          rubric = parsed;
        }
      }
    } catch (e) {
      setErr(`Invalid rubric JSON: ${(e as Error).message}`);
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/dev/ai/analyze-debrief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, answers, ...(rubric ? { rubric } : {}) })
      });
      const j = await r.json();
      setOut(JSON.stringify(j, null, 2));
      if (!r.ok) setErr(`HTTP ${r.status}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const debriefOutcome =
    out && mode === 'debrief'
      ? (() => {
          try {
            const p = JSON.parse(out);
            return p?.outcome ?? null;
          } catch {
            return null;
          }
        })()
      : null;

  return (
    <div className="dev-ai-playground">
      <h2>Dev AI playground</h2>
      <p className="dev-ai-playground__hint">
        Local only. Backend: <code>AI_DEV_ENABLED=true</code> + <code>OPENAI_API_KEY</code> in{' '}
        <code>production-backend/.env</code>. The server adds <strong>product context</strong> (what the Sales Scorecard
        PWA is and how it works) to Dev AI calls. Optional: <code>AI_DEV_EXTRA_CONTEXT</code> for more.{' '}
        <strong>Chat</strong> keeps a thread for this page until you clear it (each send includes prior turns). No
        server-side memory beyond that.
      </p>

      <div className="dev-ai-playground__modes" role="tablist">
        <button
          type="button"
          className={mode === 'chat' ? 'dev-ai-playground__mode active' : 'dev-ai-playground__mode'}
          onClick={() => setMode('chat')}
        >
          Chat
        </button>
        <button
          type="button"
          className={mode === 'command' ? 'dev-ai-playground__mode active' : 'dev-ai-playground__mode'}
          onClick={() => setMode('command')}
        >
          Command → app
        </button>
        <button
          type="button"
          className={mode === 'debrief' ? 'dev-ai-playground__mode active' : 'dev-ai-playground__mode'}
          onClick={() => setMode('debrief')}
        >
          Voice debrief outcome
        </button>
      </div>

      <div className="dev-ai-playground__row">
        <button type="button" className="dev-ai-playground__btn" onClick={refreshStatus}>
          Refresh status
        </button>
      </div>

      {status && <pre className="dev-ai-playground__pre">{status}</pre>}

      <label className="dev-ai-playground__label">
        Model
        <input className="dev-ai-playground__input" value={model} onChange={(e) => setModel(e.target.value)} />
      </label>

      {mode === 'chat' && (
        <>
          <div className="dev-ai-playground__chat-toolbar">
            <button type="button" className="dev-ai-playground__btn" onClick={clearChat} disabled={loading || chatMessages.length === 0}>
              Clear conversation
            </button>
            {chatMessages.length > MAX_CHAT_MESSAGES && (
              <span className="dev-ai-playground__chat-cap">
                Only the last {MAX_CHAT_MESSAGES} messages are sent to the model; older turns are not in context.
              </span>
            )}
          </div>
          <div className="dev-ai-playground__chat" aria-live="polite">
            {chatMessages.length === 0 && (
              <p className="dev-ai-playground__chat-empty">Ask anything about the app or your workflow. Follow-ups use this thread.</p>
            )}
            {chatMessages.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={m.role === 'user' ? 'dev-ai-playground__msg dev-ai-playground__msg--user' : 'dev-ai-playground__msg dev-ai-playground__msg--assistant'}
              >
                <span className="dev-ai-playground__msg-label">{m.role === 'user' ? 'You' : 'Assistant'}</span>
                <p className="dev-ai-playground__msg-body">{m.content}</p>
              </div>
            ))}
            {loading && (
              <div className="dev-ai-playground__msg dev-ai-playground__msg--assistant dev-ai-playground__msg--pending">
                <span className="dev-ai-playground__msg-label">Assistant</span>
                <p className="dev-ai-playground__msg-body">…</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <label className="dev-ai-playground__label">
            Message
            <textarea
              className="dev-ai-playground__textarea"
              rows={4}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  sendChat();
                }
              }}
              placeholder="Type a message… (⌘/Ctrl+Enter to send)"
            />
          </label>
          <button type="button" className="dev-ai-playground__btn dev-ai-playground__btn--primary" onClick={sendChat} disabled={loading || !chatInput.trim()}>
            {loading ? 'Sending…' : 'Send'}
          </button>
        </>
      )}

      {mode === 'command' && (
        <>
          <p className="dev-ai-playground__subhint">
            Try: “Go to history”, “Open voice debrief”, “Open dev ai”. Only allowlisted tabs can run — same idea as Lovable-style
            safe actions, not arbitrary code execution.
          </p>
          <label className="dev-ai-playground__label">
            Command
            <textarea
              className="dev-ai-playground__textarea"
              rows={2}
              value={commandText}
              onChange={(e) => setCommandText(e.target.value)}
            />
          </label>
          <button type="button" className="dev-ai-playground__btn dev-ai-playground__btn--primary" onClick={sendCommand} disabled={loading}>
            {loading ? 'Running…' : 'Run command'}
          </button>
        </>
      )}

      {mode === 'debrief' && (
        <>
          <p className="dev-ai-playground__subhint">
            Answers use <strong>behavior item IDs</strong> as keys (same as the live scorecard). Load last session to pull
            answers + rubric from Voice debrief, or paste manually. Rubric enables <strong>1–4 criterion scores</strong> and
            weighted overall.
          </p>
          <div className="dev-ai-playground__row">
            <button type="button" className="dev-ai-playground__btn" onClick={loadLastVoicePilot}>
              Load last from Voice debrief
            </button>
          </div>
          <label className="dev-ai-playground__label">
            Answers (JSON: behaviorItemId → text)
            <textarea
              className="dev-ai-playground__textarea"
              rows={10}
              value={debriefJson}
              onChange={(e) => setDebriefJson(e.target.value)}
            />
          </label>
          <label className="dev-ai-playground__label">
            Rubric (optional JSON — auto-filled from pilot save)
            <textarea
              className="dev-ai-playground__textarea"
              rows={6}
              value={rubricJson}
              onChange={(e) => setRubricJson(e.target.value)}
              placeholder='{"customerType":"low-share","categories":[...]}'
            />
          </label>
          <button type="button" className="dev-ai-playground__btn dev-ai-playground__btn--primary" onClick={sendDebrief} disabled={loading}>
            {loading ? 'Analyzing…' : 'Get AI outcome'}
          </button>
        </>
      )}

      {err && <p className="dev-ai-playground__err">{err}</p>}
      {navMsg && mode === 'command' && <p className="dev-ai-playground__ok">{navMsg}</p>}
      {mode === 'debrief' && navMsg && !loading && <p className="dev-ai-playground__ok">{navMsg}</p>}

      {debriefOutcome && mode === 'debrief' && (
        <div className="dev-ai-playground__reply">
          <strong>Scores &amp; outcome</strong>
          {typeof debriefOutcome.overall_score === 'number' && (
            <p className="dev-ai-playground__overall">
              Overall (1–4): <strong>{Number(debriefOutcome.overall_score).toFixed(2)}</strong>
            </p>
          )}
          {Array.isArray(debriefOutcome.criterion_scores) && debriefOutcome.criterion_scores.length > 0 && (
            <ul className="dev-ai-playground__criteria">
              {(debriefOutcome.criterion_scores as Array<{
                behavior_item_id?: string;
                name?: string;
                score?: number;
                rationale?: string;
              }>).map((row, i) => (
                <li key={row.behavior_item_id || i}>
                  <strong>{row.score}</strong> — {row.name || row.behavior_item_id}
                  {row.rationale ? <span className="dev-ai-playground__rationale"> — {row.rationale}</span> : null}
                </li>
              ))}
            </ul>
          )}
          <pre className="dev-ai-playground__pre dev-ai-playground__pre--light">{JSON.stringify(debriefOutcome, null, 2)}</pre>
        </div>
      )}

      {out && (
        <details className="dev-ai-playground__details">
          <summary>Full API JSON</summary>
          <pre className="dev-ai-playground__pre">{out}</pre>
        </details>
      )}
    </div>
  );
};

export default DevAiPlayground;
