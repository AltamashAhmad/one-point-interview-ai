import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import {
  createSession,
  getSession,
  listSessions,
  sendSessionTurn,
  reviewSessionCode,
  endSession,
  updateSession,
} from '../services/api';
import { describeError } from '../utils/errors';
import { findModel } from '../services/modelCatalog';
import InterviewSetup from '../components/interview/InterviewSetup';
import InterviewTopBar from '../components/interview/InterviewTopBar';
import ChatPanel, { ErrorBanner } from '../components/interview/ChatPanel';
import Composer from '../components/interview/Composer';
import { Button, Dialog, Icon, IconButton, Tabs } from '../components/ui';
import { useVoiceToText } from '../hooks/useVoiceToText';
import { useCountdown, formatClock } from '../hooks/useCountdown';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import CodeEditor from '../components/CodeEditor';
import { TYPE_CONFIG } from '../utils/constants';
import './InterviewWorkspace.css';

const QUOTA_CODES = ['FREE_TRIAL_EXHAUSTED', 'DAILY_QUOTA_EXCEEDED'];
const MAX_MESSAGE_CHARS = 8000;
const MOBILE_MAX_WIDTH = 899;
const TIME_WARNINGS = [
  { seconds: 5 * 60, text: '5 minutes left — start wrapping up: final code and complexity.' },
  { seconds: 60, text: '1 minute left.' },
];
const errorCode = (err) => err?.response?.data?.code;
const resultPath = (s) => (s.scorecard ? `/scorecard/${s.id}` : `/history/${s.id}`);
const newTurnId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const draftKey = (id) => `interview_draft_${id}`;
const DRAFT_SAVE_DELAY_MS = 1200;
const hasTimedOut = (s) => Boolean(s.timerEndsAt) && Date.parse(s.timerEndsAt) <= Date.parse(s.serverNow || new Date().toISOString());
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const joinDictation = (prev, text) => (!prev || prev.trimEnd() !== prev ? `${prev}${text}` : `${prev} ${text}`);

/** Another tab/request is scoring this interview; wait (up to ~2 min) for its scorecard. */
async function waitForScorecard(id, { attempts = 40, intervalMs = 3000 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    await sleep(intervalMs);
    const s = await getSession(id).catch(() => null);
    if (s && s.status !== 'active') return s;
    if (s && !s.scoring) return null;
  }
  return null;
}

function readDraft(id) {
  try { return localStorage.getItem(draftKey(id)) || ''; } catch { return ''; }
}

function writeDraft(id, text) {
  try {
    if (text) localStorage.setItem(draftKey(id), text);
    else localStorage.removeItem(draftKey(id));
  } catch { /* storage disabled: drafts just aren't kept */ }
}

/**
 * Interview / tutor workspace. The server owns the session (transcript, question, timer, loop progress);
 * this page only renders it. URL: /interview/:type?session=<id>[&loopId=&roundIndex=]
 * Sheet practice passes location.state.practice = { questionTitle, sheetId, problemId, model, language }.
 */
export default function Interview() {
  const { type } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionParam = searchParams.get('session');
  const loopId = searchParams.get('loopId');
  const roundParam = searchParams.get('roundIndex');
  const practice = location.state?.practice || null;

  const { refreshUserProfile, setWallDismissed } = useAuth();
  const config = TYPE_CONFIG[type];
  const isTutor = !!config?.isTutor;
  const isBehavioral = type === 'managerial';

  const source = useMemo(() => {
    const roundIndex = roundParam === null ? NaN : Number(roundParam);
    if (loopId && Number.isInteger(roundIndex)) return { kind: 'loop', loopId, roundIndex };
    if (practice?.questionTitle) return { kind: 'sheet', sheetId: practice.sheetId || null, problemId: practice.problemId || null };
    return null;
  }, [loopId, roundParam, practice?.questionTitle, practice?.sheetId, practice?.problemId]);

  const practiceConfig = useMemo(() => (practice
    ? { model: practice.model || null, language: practice.language || 'Java', difficulty: 'ANY' }
    : null), [practice?.model, practice?.language]); // eslint-disable-line react-hooks/exhaustive-deps

  // loading → (resume | setup) → active
  const [phase, setPhase] = useState('loading');
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pendingResume, setPendingResume] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [input, setInput] = useState('');
  // Draft bookkeeping: what the server has, what the composer shows, the pending save and the save queue.
  const savedDraftRef = useRef({ id: null, text: '' });
  const draftRef = useRef({ id: null, text: '' });
  const draftTimerRef = useRef(null);
  const draftQueueRef = useRef(Promise.resolve());
  const [busy, setBusy] = useState(null); // null | 'starting' | 'replying' | 'reviewing' | 'ending'
  const [error, setError] = useState(null); // { message, retry? }
  const [modelNotice, setModelNotice] = useState(null);
  const [timeNotice, setTimeNotice] = useState(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [showConfirmNew, setShowConfirmNew] = useState(false);
  // Another interview is already running: { session, cfg } — cfg is what the candidate tried to start.
  const [blocking, setBlocking] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= MOBILE_MAX_WIDTH);
  const [mobileTab, setMobileTab] = useState('chat');

  const loadedIdRef = useRef(null);
  const modelRef = useRef(null);
  const autoEndTriedRef = useRef(false);
  const warnedRef = useRef(new Set());
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (!config) navigate('/'); }, [config, navigate]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= MOBILE_MAX_WIDTH);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const { isListening, isSupported: voiceSupported, startListening, stopListening, error: voiceError, interim: voiceInterim } =
    useVoiceToText({ onTranscript: (text) => setInput((prev) => joinDictation(prev, text).slice(0, MAX_MESSAGE_CHARS)) });

  const { formattedTime, secondsLeft, isUrgent, isExpired } = useCountdown(isTutor ? null : session?.timerEndsAt, clockOffset);
  const timeUp = !isTutor && isExpired;
  const sessionEnded = Boolean(session && session.status !== 'active');

  const setSessionParam = useCallback((id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('session', id);
      else next.delete('session');
      return next;
    }, { replace: true, state: location.state });
  }, [setSearchParams, location.state]);

  const reportError = useCallback((err, fallback, retry) => {
    const code = errorCode(err);
    if (QUOTA_CODES.includes(code)) {
      refreshUserProfile();
      setWallDismissed(false);
    }
    setError({ message: describeError(err, fallback), retry });
  }, [refreshUserProfile, setWallDismissed]);

  const openSession = useCallback((s) => {
    loadedIdRef.current = s.id;
    modelRef.current = s.config?.model || null;
    autoEndTriedRef.current = false;
    warnedRef.current = new Set();
    setClockOffset(s.serverNow ? Date.parse(s.serverNow) - Date.now() : 0);
    setSession(s);
    setMessages(s.messages || []);
    setSelectedModel(s.config?.model || null);
    savedDraftRef.current = { id: s.id, text: s.draft || '' };
    setInput(readDraft(s.id) || s.draft || '');
    setTimeNotice(null);
    setPhase('active');
    setSessionParam(s.id);
  }, [setSessionParam]);

  // Re-syncs with the server after another tab (or a lost connection) changed the session.
  const reloadSession = useCallback(async (id) => {
    const fresh = await getSession(id);
    if (fresh.status !== 'active') {
      navigate(resultPath(fresh), { replace: true });
      return null;
    }
    openSession(fresh);
    return fresh;
  }, [navigate, openSession]);

  const appendToStreamingMessage = useCallback((text) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last?.streaming) return prev;
      return [...prev.slice(0, -1), { ...last, content: last.content + text }];
    });
  }, []);

  // One conversational turn. `content` null = ask for the interviewer's opening message.
  // `turnId` stays the same across retries so the server can return an already-saved reply.
  const runTurn = useCallback(async (s, content, turnId = content ? newTurnId() : undefined) => {
    setError(null);
    setBusy('replying');
    const optimistic = content ? [{ role: 'user', content }] : [];
    setMessages((prev) => [...prev, ...optimistic, { role: 'assistant', content: '', streaming: true }]);
    try {
      const result = await sendSessionTurn(s.id, { content, model: modelRef.current || undefined, turnId }, { onToken: appendToStreamingMessage });
      setMessages((prev) => [...prev.filter((m) => !m.streaming), result.message]);
      setSession((prev) => (prev ? {
        ...prev,
        timerEndsAt: result.timerEndsAt ?? prev.timerEndsAt,
        messageCount: result.messageCount,
        userMessageCount: (prev.userMessageCount || 0) + (content ? 1 : 0),
      } : prev));
      if (content) writeDraft(s.id, '');
      if (result.fellBack) {
        setModelNotice(`The selected model was busy, so ${findModel(result.model)?.name || result.model} answered instead.`);
        setTimeout(() => setModelNotice(null), 5000);
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => !m.streaming && !optimistic.includes(m)));
      const code = errorCode(err);
      if (content) setInput(content);
      if (code === 'SESSION_ENDED') {
        navigate(resultPath(await getSession(s.id).catch(() => ({ id: s.id }))), { replace: true });
        return;
      }
      if (code === 'SESSION_CONFLICT') {
        const fresh = await reloadSession(s.id).catch(() => null);
        if (fresh && content) setInput(content);
        setError({ message: 'This interview was updated from another tab, so we loaded the latest messages. Send your answer again if it is still needed.' });
        return;
      }
      if (code === 'TIME_UP') {
        // The server's clock is authoritative; stop the countdown now so the interview gets scored.
        setSession((prev) => (prev ? { ...prev, timerEndsAt: new Date(Date.now() + clockOffset - 1000).toISOString() } : prev));
        return;
      }
      reportError(err, 'Failed to get a response. Please try again.', () => {
        setInput('');
        runTurn(s, content, turnId);
      });
    } finally {
      setBusy(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [appendToStreamingMessage, navigate, reportError, reloadSession, clockOffset]);

  const startSession = useCallback(async (cfg) => {
    setError(null);
    setMessages([]);
    setPhase('active');
    setBusy('starting');
    let created;
    try {
      created = await createSession({
        interviewType: type,
        config: cfg,
        questionTitle: practice?.questionTitle || undefined,
        source: source || undefined,
      });
    } catch (err) {
      setBusy(null);
      setPhase('setup');
      const running = err?.response?.data?.details?.session;
      if (errorCode(err) === 'ACTIVE_INTERVIEW' && running) {
        setBlocking({ session: running, cfg });
        return;
      }
      reportError(err, 'Could not start the session. Please try again.', () => startSession(cfg));
      return;
    }
    openSession(created);
    await runTurn(created, null);
  }, [type, practice?.questionTitle, source, openSession, runTurn, reportError]);

  // Load the session in the URL, offer to resume an unfinished one, or show setup.
  useEffect(() => {
    if (!config) return undefined;
    if (sessionParam && sessionParam === loadedIdRef.current) return undefined;
    let cancelled = false;

    (async () => {
      setPhase('loading');
      setError(null);
      if (sessionParam) {
        try {
          const s = await getSession(sessionParam);
          if (cancelled) return;
          if (s.status !== 'active') {
            navigate(resultPath(s), { replace: true });
          } else if (s.interviewType !== type) {
            navigate(`/interview/${s.interviewType}?session=${s.id}`, { replace: true });
          } else {
            openSession(s);
            if (!(s.messages || []).length) runTurn(s, null);
          }
        } catch (err) {
          if (cancelled) return;
          loadedIdRef.current = null;
          setSessionParam(null);
          setPhase('setup');
          reportError(err, 'Could not load that session. Start a new one below.');
        }
        return;
      }

      let unfinished = null;
      try {
        const active = await listSessions({
          status: 'active',
          interviewType: type,
          loopId: source?.kind === 'loop' ? source.loopId : undefined,
          question: practice?.questionTitle,
        });
        unfinished = active.find((s) => {
          if (source?.kind === 'loop') return s.source?.roundIndex === source.roundIndex;
          if (practice) return s.mode === 'sheet';
          return s.mode === 'interview' || s.mode === 'tutor';
        }) || null;
      } catch (err) {
        console.warn('Could not check for unfinished sessions:', err);
      }
      if (cancelled) return;
      if (unfinished && hasTimedOut(unfinished) && !unfinished.userMessageCount) {
        // Time ran out before any answer: close it quietly instead of offering a dead session.
        await endSession(unfinished.id).catch((err) => console.warn('Could not close timed-out session:', err));
        unfinished = null;
        if (cancelled) return;
      }
      if (unfinished) {
        setPendingResume(unfinished);
        setPhase('resume');
      } else if (practiceConfig) {
        startSession(practiceConfig);
      } else {
        setPhase('setup');
      }
    })();

    return () => { cancelled = true; };
  }, [sessionParam, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResume = () => {
    const id = pendingResume.id;
    setPendingResume(null);
    setSessionParam(id);
  };

  const handleStartFresh = async () => {
    const stale = pendingResume;
    setPendingResume(null);
    writeDraft(stale.id, '');
    await updateSession(stale.id, { status: 'archived' }).catch((err) => console.error('Archive failed:', err));
    if (practiceConfig) startSession(practiceConfig);
    else setPhase('setup');
  };

  const handleNewSession = async ({ discard = false } = {}) => {
    const answered = messages.some((m) => m.role === 'user');
    // Ended interviews can never be reopened, so don't throw away answers on one click.
    if (session?.status === 'active' && !isTutor && answered && !discard) {
      setShowConfirmNew(true);
      return;
    }
    setShowConfirmNew(false);
    if (session) writeDraft(session.id, '');
    if (session?.status === 'active') {
      // A tutor lesson with questions asked is kept as a finished lesson rather than discarded.
      const close = isTutor && answered ? endSession(session.id) : updateSession(session.id, { status: 'archived' });
      await close.catch((err) => console.error('Closing the session failed:', err));
    }
    loadedIdRef.current = null;
    setSession(null);
    setMessages([]);
    setInput('');
    setError(null);
    setShowConfirmEnd(false);
    if (practiceConfig) startSession(practiceConfig);
    else {
      setSessionParam(null);
      setPhase('setup');
    }
  };

  const resumeBlocking = () => {
    const running = blocking.session;
    setBlocking(null);
    navigate(`/interview/${running.interviewType}?session=${running.id}`);
  };

  const discardBlockingAndStart = async () => {
    const { session: running, cfg } = blocking;
    setBlocking(null);
    writeDraft(running.id, '');
    try {
      await updateSession(running.id, { status: 'archived' });
    } catch (err) {
      reportError(err, 'Could not discard the other interview. Please try again.');
      return;
    }
    startSession(cfg);
  };

  const cancelBlocking = () => {
    setBlocking(null);
    if (practiceConfig) goBack();
  };

  const saveCode = useCallback(async (code) => {
    if (!session?.id) return;
    try {
      await updateSession(session.id, { code });
    } catch (err) {
      if (errorCode(err) !== 'SESSION_ENDED') throw err;
    }
    setSession((prev) => (prev ? { ...prev, code } : prev));
  }, [session?.id]);

  const handleSend = () => {
    if (isListening) stopListening();
    const text = input.trim();
    if (!text || busy || !session || timeUp || sessionEnded) return;
    setInput('');
    runTurn(session, text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); }
  };

  const handleCodeSubmit = async (code, lang) => {
    if (!session || busy || !code?.trim() || timeUp || sessionEnded) return;
    setBusy('reviewing');
    setError(null);
    try {
      const added = await reviewSessionCode(session.id, code, lang);
      setMessages((prev) => [...prev, ...added]);
      setSession((prev) => (prev ? { ...prev, userMessageCount: (prev.userMessageCount || 0) + 1 } : prev));
    } catch (err) {
      const code_ = errorCode(err);
      if (code_ === 'SESSION_ENDED' || code_ === 'SESSION_CONFLICT') {
        await reloadSession(session.id).catch(() => null);
        return;
      }
      if (code_ === 'TIME_UP') {
        setSession((prev) => (prev ? { ...prev, timerEndsAt: new Date(Date.now() + clockOffset - 1000).toISOString() } : prev));
        return;
      }
      reportError(err, 'Failed to review your code. Please try again.', () => handleCodeSubmit(code, lang));
    } finally {
      setBusy(null);
    }
  };

  const handleModelChange = (modelId) => {
    if (modelId === selectedModel) return;
    modelRef.current = modelId;
    setSelectedModel(modelId);
    setModelNotice(`Switched to ${findModel(modelId)?.name || modelId}. Your next message will use this model.`);
    setTimeout(() => setModelNotice(null), 4000);
  };

  const handleEnd = useCallback(async ({ auto = false } = {}) => {
    if (!session || (busy && busy !== 'ending')) return;

    if (isTutor) {
      setBusy('ending');
      try {
        await endSession(session.id);
        navigate(`/history/${session.id}`, { replace: true });
      } catch (err) {
        reportError(err, 'Could not end the lesson. Please try again.');
        setBusy(null);
      }
      return;
    }

    if (!auto) {
      if (!messages.some((m) => m.role === 'user')) {
        setError({ message: "You haven't answered yet. Reply to at least one question before ending so there's something to score." });
        return;
      }
      if (!showConfirmEnd) {
        setShowConfirmEnd(true);
        return;
      }
    }

    setShowConfirmEnd(false);
    setError(null);
    setBusy('ending');
    try {
      const ended = await endSession(session.id, session.config?.scorecardModel || undefined);
      if (ended.status === 'archived') {
        setSession(ended);
        setBusy(null);
        return;
      }
      navigate(resultPath(ended), { replace: true });
    } catch (err) {
      if (errorCode(err) === 'SCORING_IN_PROGRESS') {
        const scored = await waitForScorecard(session.id);
        if (scored) {
          navigate(resultPath(scored), { replace: true });
          return;
        }
      }
      reportError(err, 'Failed to generate the scorecard.', () => handleEnd({ auto: true }));
      setBusy(null);
    }
  }, [session, busy, isTutor, messages, showConfirmEnd, navigate, reportError]);

  // When the clock runs out, score the interview (or close it if nothing was answered) exactly once.
  useEffect(() => {
    if (!timeUp || phase !== 'active' || busy || sessionEnded || autoEndTriedRef.current) return;
    autoEndTriedRef.current = true;
    setShowConfirmEnd(false);
    handleEnd({ auto: true });
  }, [timeUp, phase, busy, sessionEnded, handleEnd]);

  // A real interviewer calls out the remaining time; do the same at 5 and 1 minute(s).
  useEffect(() => {
    if (secondsLeft === null || secondsLeft === 0) return;
    const due = TIME_WARNINGS.find((w) => secondsLeft <= w.seconds && !warnedRef.current.has(w.seconds));
    if (!due) return;
    TIME_WARNINGS.filter((w) => w.seconds >= due.seconds).forEach((w) => warnedRef.current.add(w.seconds));
    setTimeNotice(due.text);
  }, [secondsLeft]);

  // Losing the page mid-answer or mid-scoring loses work, so ask first.
  useEffect(() => {
    if (busy !== 'replying' && busy !== 'ending' && busy !== 'reviewing') return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  // The draft is saved to the session after a short pause; until the server has it, this device keeps a copy.
  const flushDraft = useCallback(() => {
    clearTimeout(draftTimerRef.current);
    const { id, text } = draftRef.current;
    if (!id) return;
    draftQueueRef.current = draftQueueRef.current.then(async () => {
      if (savedDraftRef.current.id === id && savedDraftRef.current.text === text) return;
      await updateSession(id, { draft: text });
      savedDraftRef.current = { id, text };
      if (readDraft(id) === text) writeDraft(id, '');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const id = session?.id && !sessionEnded ? session.id : null;
    draftRef.current = { id, text: input };
    if (!id) return undefined;
    if (savedDraftRef.current.id === id && savedDraftRef.current.text === input) {
      writeDraft(id, '');
      return undefined;
    }
    writeDraft(id, input);
    draftTimerRef.current = setTimeout(flushDraft, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(draftTimerRef.current);
  }, [session?.id, sessionEnded, input, flushDraft]);

  useEffect(() => {
    const flushWhenHidden = () => { if (document.visibilityState === 'hidden') flushDraft(); };
    document.addEventListener('visibilitychange', flushWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden);
      flushDraft();
    };
  }, [flushDraft]);

  const goBack = () => {
    const origin = session?.source || source;
    if (origin?.kind === 'loop') navigate(`/loop/${origin.loopId}`);
    else if (origin?.kind === 'sheet' || session?.mode === 'sheet' || practice) navigate('/dsa-sheet');
    else navigate('/');
  };

  if (!config) return null;

  const question = session?.question;
  const sessionConfig = session?.config;
  const last = messages[messages.length - 1];
  const showTyping = busy === 'starting' || busy === 'reviewing' || (busy === 'replying' && !(last?.streaming && last.content));
  const inputDisabled = !!busy || timeUp || !session || sessionEnded;
  const clockLabel = formattedTime || (!isTutor && session?.timerMinutes ? formatClock(session.timerMinutes * 60) : null);

  const pageStyle = { '--type-color': config.color };
  const editorOpen = isEditorOpen && !!session;
  const endLabel = busy === 'ending' ? (isTutor ? 'Ending…' : 'Scoring…') : (isTutor ? 'End Lesson' : 'End Interview');
  const endDisabled = !session || !!busy || messages.length === 0 || sessionEnded;
  const hintTip = busy === 'reviewing'
    ? 'Reviewing your code for correctness, complexity and edge cases'
    : isTutor
      ? 'Tip: Ask questions and learn at your own pace'
      : isBehavioral
        ? 'Tip: Use one specific story: situation, what you did, and the measurable result'
        : 'Tip: Think out loud and communicate your reasoning';

  const openCodeEditor = () => { setIsEditorOpen(true); setMobileTab('code'); };
  const closeCodeEditor = () => { setIsEditorOpen(false); setMobileTab('chat'); };
  const retryError = () => { const retry = error?.retry; setError(null); retry?.(); };

  const topBar = (
    <InterviewTopBar
      config={config}
      title={question?.title || config.fullName}
      questionLink={question?.link}
      live={phase === 'active'}
      isMobile={isMobile}
      clock={phase === 'active' && clockLabel ? {
        label: clockLabel,
        title: formattedTime ? 'Time left' : 'The clock starts when the interviewer presents the problem',
        urgent: isUrgent,
        expired: isExpired,
      } : null}
      model={{ value: selectedModel, onChange: handleModelChange, disabled: !!busy }}
      showCodeButton={!isEditorOpen && !isBehavioral}
      codeDisabled={!session}
      onOpenCode={openCodeEditor}
      endLabel={endLabel}
      endBusy={busy === 'ending'}
      endDisabled={endDisabled}
      onEnd={() => handleEnd()}
      newSessionDisabled={!!busy}
      onNewSession={() => handleNewSession()}
      onBack={goBack}
    />
  );

  const chatSection = (
    <section className="chat-pane" hidden={isMobile && editorOpen && mobileTab === 'code'}>
      <ChatPanel
        sessionConfig={sessionConfig}
        showDifficulty={!isBehavioral}
        messages={messages}
        typeColor={config.color}
        notices={[modelNotice, timeUp ? null : timeNotice].filter(Boolean)}
        typing={showTyping}
        endingText={busy === 'ending' && !isTutor
          ? (timeUp ? "Time's up — scoring your interview…" : 'Scoring your interview… this can take up to a minute.')
          : null}
        archivedText={session?.status === 'archived'
          ? (session.endReason === 'timeout'
            ? "Time ran out before you answered, so there's nothing to score. This interview has been closed."
            : 'This session was closed.')
          : null}
        onStartNew={() => handleNewSession()}
        error={error}
        onRetry={retryError}
        endRef={messagesEndRef}
      />
      <Composer
        inputRef={inputRef}
        value={input}
        onChange={setInput}
        onKeyDown={handleKeyDown}
        onSend={handleSend}
        placeholder={sessionEnded
          ? 'This session has ended.'
          : timeUp
            ? "Time's up — your interview is being scored."
            : 'Type your answer…'}
        maxLength={MAX_MESSAGE_CHARS}
        disabled={inputDisabled}
        sendDisabled={!input.trim() || inputDisabled}
        sending={busy === 'replying'}
        voice={{
          supported: voiceSupported,
          listening: isListening,
          interim: voiceInterim,
          error: voiceError,
          onToggle: isListening ? stopListening : startListening,
          onStop: stopListening,
        }}
        hint={<>{isTutor ? 'Tutor' : 'Interviewer'}: <strong>{config.label} Mode</strong> · {hintTip}</>}
      />
    </section>
  );

  const editorPane = editorOpen ? (
    <section className="editor-pane" aria-label="Code editor">
      <div className="editor-pane__bar">
        <span className="editor-pane__title">Code editor</span>
        <IconButton icon="x" label="Close code editor" size="sm" onClick={closeCodeEditor} />
      </div>
      <CodeEditor
        key={session.id}
        sessionId={session.id}
        initialCode={session.code || ''}
        language={sessionConfig?.language || 'javascript'}
        onSubmitCode={handleCodeSubmit}
        onSave={saveCode}
        readOnly={timeUp || sessionEnded}
        isSubmitting={busy === 'reviewing'}
      />
    </section>
  ) : null;

  const mobileWorkspace = (
    <div className="workspace-mobile">
      {editorOpen && (
        <Tabs
          className="workspace-tabs"
          ariaLabel="Workspace view"
          items={[{ value: 'chat', label: 'Chat' }, { value: 'code', label: 'Code' }]}
          value={mobileTab}
          onChange={setMobileTab}
        />
      )}
      {chatSection}
      {editorOpen && <div className="editor-slot" hidden={mobileTab !== 'code'}>{editorPane}</div>}
    </div>
  );

  const desktopWorkspace = (
    <PanelGroup direction="horizontal" autoSaveId="interview-split-h">
      <Panel id="chat" order={1} defaultSize={editorOpen ? 50 : 100} minSize={30}>
        {chatSection}
      </Panel>
      {editorOpen && (
        <>
          <PanelResizeHandle className="resize-handle" />
          <Panel id="editor" order={2} defaultSize={50} minSize={30}>
            {editorPane}
          </Panel>
        </>
      )}
    </PanelGroup>
  );

  if (phase === 'loading') {
    return (
      <main className="interview-page" style={pageStyle}>
        {topBar}
        <div className="interview-state">
          <div className="spinner" />
          <p>Loading session…</p>
        </div>
      </main>
    );
  }

  if (phase === 'resume' && pendingResume) {
    const expired = hasTimedOut(pendingResume);
    const answered = (pendingResume.userMessageCount || 0) > 0;
    return (
      <main className="interview-page" style={pageStyle}>
        {topBar}
        <Dialog
          open
          title="Resume session?"
          footer={(
            <>
              <Button variant="secondary" onClick={handleStartFresh}>{answered ? 'Discard & start new' : 'Start fresh'}</Button>
              <Button onClick={handleResume}>{expired ? 'Get scorecard' : 'Resume'}</Button>
            </>
          )}
        >
          <p className="modal-body">
            You have an unfinished session{pendingResume.question?.title ? <> for <strong>{pendingResume.question.title}</strong></> : ''}.
          </p>
          <p className="modal-body">
            {expired
              ? 'Its time already ran out. Open it to get the scorecard for your answers, or discard it and start again.'
              : 'Pick up where you left off (the clock kept running while you were away), or discard it and start a new one.'}
          </p>
        </Dialog>
      </main>
    );
  }

  if (phase === 'setup') {
    const blockedBy = blocking?.session;
    const blockedType = blockedBy ? TYPE_CONFIG[blockedBy.interviewType] : null;
    const blockedExpired = blockedBy ? hasTimedOut(blockedBy) : false;
    const blockedMinutes = blockedBy?.timerEndsAt
      ? Math.max(1, Math.ceil((Date.parse(blockedBy.timerEndsAt) - Date.parse(blockedBy.serverNow || new Date().toISOString())) / 60_000))
      : null;
    return (
      <main className="interview-page" style={pageStyle}>
        {topBar}
        <Dialog
          open={Boolean(blocking)}
          onClose={cancelBlocking}
          title="You already have an interview running"
          footer={(
            <>
              <Button variant="ghost" onClick={cancelBlocking}>Cancel</Button>
              <Button variant="secondary" onClick={discardBlockingAndStart}>Discard it & start this one</Button>
              <Button onClick={resumeBlocking}>{blockedExpired ? 'Get its scorecard' : 'Resume it'}</Button>
            </>
          )}
        >
          {blockedBy && (
            <p className="modal-body">
              {blockedType?.icon && <Icon name={blockedType.icon} size={16} />} <strong>{blockedType?.label || blockedBy.interviewType}</strong>
              {blockedBy.question?.title ? <> — {blockedBy.question.title}</> : null}
              <br />
              {blockedExpired
                ? 'Its time is up. Open it to get your scorecard.'
                : `About ${blockedMinutes} min left. Only one interview runs at a time, just like the real thing.`}
            </p>
          )}
        </Dialog>
        {error && <div className="interview-notice"><ErrorBanner error={error} onRetry={retryError} /></div>}
        <InterviewSetup interviewType={type} typeConfig={config} onBegin={startSession} />
      </main>
    );
  }

  return (
    <main className="interview-page" style={pageStyle}>
      <Dialog
        open={showConfirmEnd}
        onClose={() => setShowConfirmEnd(false)}
        title="End interview?"
        description="Your answers will be scored and you'll see your scorecard."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowConfirmEnd(false)}>Cancel</Button>
            <Button onClick={() => handleEnd()}>Generate Scorecard</Button>
          </>
        )}
      />
      <Dialog
        open={showConfirmNew}
        onClose={() => setShowConfirmNew(false)}
        title="Leave this interview?"
        description="It's still running. Once you leave it can't be reopened, so choose what happens to your answers."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setShowConfirmNew(false)}>Keep going</Button>
            <Button variant="secondary" onClick={() => handleNewSession({ discard: true })}>Discard & start new</Button>
            <Button onClick={() => { setShowConfirmNew(false); handleEnd({ auto: true }); }}>End & get scorecard</Button>
          </>
        )}
      />

      {topBar}

      <div className="interview-body">
        {isMobile ? mobileWorkspace : desktopWorkspace}
      </div>
    </main>
  );
}
