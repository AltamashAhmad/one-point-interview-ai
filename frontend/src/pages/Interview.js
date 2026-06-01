import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { sendMessage, saveSession, generateScorecard } from '../services/api';
import MessageBubble from '../components/MessageBubble';
import TypingIndicator from '../components/TypingIndicator';
import ModelSelector, { AVAILABLE_MODELS } from '../components/ModelSelector';
import InterviewSetup  from '../components/InterviewSetup';
import { useVoiceToText }     from '../hooks/useVoiceToText';
import { useSessionPersist }  from '../hooks/useSessionPersist';
import { useInterviewTimer }  from '../hooks/useInterviewTimer';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import CodeEditor from '../components/CodeEditor';
import { TYPE_CONFIG } from '../utils/constants';
import './Interview.css';

export default function Interview() {
  const { type }     = useParams();
  const navigate     = useNavigate();
  const location     = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const loopId       = searchParams.get('loopId');
  const roundIndex   = searchParams.get('roundIndex');
  
  const { user }     = useAuth();
  const config       = TYPE_CONFIG[type];
  const isTutor      = config?.isTutor || false;

  const userName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  // ── Session persistence (survives page refresh) ─────────────────────
  const { persist, restore, clear } = useSessionPersist(type);

  // Restore from localStorage on first render ONLY (lazy state initializer)
  const [setupPhase,    setSetupPhaseRaw]    = useState(() => { const s = restore(); return s ? s.setupPhase    : true; });
  const [sessionConfig, setSessionConfigRaw] = useState(() => { const s = restore(); return s ? s.sessionConfig : null; });
  const [messages,      setMessagesRaw]      = useState(() => { const s = restore(); return s ? s.messages      : [];   });
  const [sessionId,     setSessionIdRaw]     = useState(() => { const s = restore(); return s ? s.sessionId     : null; });
  const [questionMeta,  setQuestionMetaRaw]  = useState(() => { const s = restore(); return s ? s.questionMeta  : null; });
  const [selectedModel, setSelectedModelRaw] = useState(() => { const s = restore(); return s ? s.selectedModel : null; });
  const [scorecardModel,setScorecardModelRaw] = useState(() => { const s = restore(); return s ? s.scorecardModel : null; });

  const setSetupPhase    = (v) => { setSetupPhaseRaw(v);    };
  const setSessionConfig = (v) => { setSessionConfigRaw(v); };
  const setMessages      = (v) => { setMessagesRaw(v);      };
  const setSessionId     = (v) => { setSessionIdRaw(v);     };
  const setQuestionMeta  = (v) => { setQuestionMetaRaw(v);  };
  const setSelectedModel = (v) => { setSelectedModelRaw(v); };
  const setScorecardModel= (v) => { setScorecardModelRaw(v);};

  const [input,       setInput]       = useState('');
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState(null);
  const [modelNotice, setModelNotice] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isGeneratingScorecard, setIsGeneratingScorecard] = useState(false);
  const pendingCodeSubmitRef = useRef(null);

  // ── Voice to text ───────────────────────────────────────────────
  const { isListening, isSupported: voiceSupported, startListening, stopListening, error: voiceError } =
    useVoiceToText({
      onTranscript: (text) => setInput(prev => prev ? `${prev} ${text}` : text),
    });

  // ── Interview Timer ─────────────────────────────────────────────
  const { formattedTime, isUrgent, isExpired } = useInterviewTimer(
    isTutor ? null : sessionId,
    !isTutor && !!sessionId,
    type
  );

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // ── Guards ────────────────────────────────────────────────────────────
  useEffect(() => { if (!config) navigate('/'); }, [config, navigate]);

  // ── Persist to localStorage whenever important state changes ─────────
  useEffect(() => {
    persist({ setupPhase, sessionConfig, messages, sessionId, questionMeta, selectedModel, scorecardModel });
  }, [setupPhase, sessionConfig, messages, sessionId, questionMeta, selectedModel, scorecardModel, persist]);

  // ── Auto-scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // ── Build initial message from session config ─────────────────────────
  const buildInitialMessage = useCallback((cfg) => ({
    role: 'user',
    content: isTutor
      ? [
          'Hello! I want to learn and practice.',
          cfg.difficulty ? `Difficulty: ${cfg.difficulty}.` : '',
          cfg.language ? `Preferred language: ${cfg.language}.` : '',
          'Please present a problem and teach me step-by-step how to approach and solve it.',
        ].filter(Boolean).join(' ')
      : [
          'Hello, I am ready to start the interview.',
          cfg.company    ? `Target company: ${cfg.company}.`    : '',
          cfg.difficulty ? `Difficulty: ${cfg.difficulty}.`     : '',
          cfg.language   ? `Preferred language: ${cfg.language}.` : '',
          'Please present the problem and begin.',
        ].filter(Boolean).join(' '),
  }), [isTutor]);

  // ── Start interview (called once when user clicks "Begin") ────────────
  const startInterview = useCallback(async (cfg) => {
    setIsLoading(true);
    setError(null);
    setMessages([]);
    setSessionConfig(cfg);
    setSelectedModel(cfg.model);
    setScorecardModel(cfg.scorecardModel || 'gemini-3.1-pro-preview');

    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);

    const initialMessage  = buildInitialMessage(cfg);
    const initialMessages = [initialMessage];

    try {
      const response = await sendMessage(
        initialMessages,
        type,
        userName,
        cfg.model,
        { company: cfg.company, difficulty: cfg.difficulty, language: cfg.language }
      );

      const updatedMessages = [{ role: 'assistant', content: response.content }];
      setMessages(updatedMessages);

      // Save question metadata for display in the header
      if (response.questionTitle) {
        setQuestionMeta({
          title:       response.questionTitle,
          link:        response.questionLink,
          companyName: response.companyName,
        });
      }

      // Fire-and-forget session save — include full metadata so History shows it
      const meta = {
        company:       cfg.company       || null,
        difficulty:    cfg.difficulty     || 'ANY',
        language:      cfg.language       || null,
        questionTitle: response.questionTitle || null,
        questionLink:  response.questionLink  || null,
      };
      saveSession(newSessionId, type, cfg.model, updatedMessages, meta).catch(console.error);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect to the AI interviewer. Please check your connection.');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [type, userName, buildInitialMessage]);

  // ── Handle "Begin Interview" from setup screen ────────────────────────
  const handleBegin = useCallback((cfg) => {
    setSetupPhase(false);
    startInterview(cfg);
  }, [startInterview]);

  // ── Handle Submitting Code from Editor ────────────────────────────────
  const handleCodeSubmit = useCallback((code, lang) => {
    const formattedCode = `Here is my implementation in ${lang}:\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\nPlease review my code and provide feedback.`;
    pendingCodeSubmitRef.current = formattedCode;
    setInput(formattedCode);
  }, []);

  // ── Send a chat message ───────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage  = { role: 'user', content: trimmed };
    const newMessages  = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setError(null);

    // Always prepend the initial message so the AI has full context
    const initialMessage = buildInitialMessage(sessionConfig);
    const apiMessages    = [initialMessage, ...newMessages];

    try {
      const response = await sendMessage(
        apiMessages,
        type,
        userName,
        selectedModel,        // use currently selected model
        { company: sessionConfig.company, difficulty: sessionConfig.difficulty, language: sessionConfig.language }
      );

      const finalMessages = [...newMessages, { role: 'assistant', content: response.content }];
      setMessages(finalMessages);
      saveSession(sessionId, type, selectedModel, finalMessages).catch(console.error);
    } catch (err) {
      // Handle both axios response errors (Gemini) and direct SDK errors (Groq)
      const msg = err.response?.data?.error || err.message || 'Failed to get a response. Please try again.';
      setError(msg);
      setMessages(prev => prev.slice(0, -1)); // revert optimistic add using functional update
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, isLoading, messages, type, userName, selectedModel, sessionId, sessionConfig, buildInitialMessage]);

  // ── Auto-send when code is submitted from editor ──────────────────────
  useEffect(() => {
    if (pendingCodeSubmitRef.current && input === pendingCodeSubmitRef.current) {
      pendingCodeSubmitRef.current = null;
      handleSend();
    }
  }, [input, handleSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Model switch mid-interview (ZERO tokens wasted) ───────────────────
  const handleModelChange = (modelId) => {
    if (modelId === selectedModel) return;
    const modelInfo = AVAILABLE_MODELS.find(m => m.id === modelId);
    const newName   = modelInfo?.name || modelId;
    setSelectedModel(modelId);
    // Show a transient notice — NO API call, context fully preserved, zero tokens wasted
    setModelNotice(`🔄 Switched to ${newName} — your next message will use this model`);
    setTimeout(() => setModelNotice(null), 4000);
  };

  // ── Clean up session-scoped localStorage keys (timer + editor code) ───
  const clearSessionArtifacts = useCallback((id) => {
    if (!id) return;
    try {
      localStorage.removeItem(`interview_timer_${id}`);
      localStorage.removeItem(`code_${id}`);
    } catch (_) { /* private mode / storage disabled — ignore */ }
  }, []);

  // ── New session ───────────────────────────────────────────────────────
  const handleNewSession = () => {
    clearSessionArtifacts(sessionId); // remove old timer + code before resetting
    clear();                     // wipe localStorage
    setSetupPhase(true);
    setMessages([]);
    setInput('');
    setError(null);
    setQuestionMeta(null);       // Bug #7 fix: reset all session state
    setSessionId(null);
    setSessionConfig(null);
    setSelectedModel(null);
    setScorecardModel(null);
    setModelNotice(null);
  };

  const handleEndInterview = useCallback(async (auto = false) => {
    if (messages.length === 0) return;

    if (isTutor) {
      clearSessionArtifacts(sessionId);
      clear();
      navigate('/');
      return;
    }

    if (!auto) {
      // Check if the user has actually responded to any questions
      const userMsgCount = messages.filter(m => m.role === 'user').length;
      if (userMsgCount === 0) {
        alert("You haven't sent any responses yet. Answer at least one question before ending the interview to get a meaningful scorecard.");
        return;
      }

      const confirmed = window.confirm("Are you sure you want to end the interview and generate your scorecard?");
      if (!confirmed) return;
    }

    setIsGeneratingScorecard(true);
    try {
      await generateScorecard(sessionId, scorecardModel);
      clearSessionArtifacts(sessionId); // remove timer + editor code for this session
      clear(); // Wipe local storage session data upon successful completion
      const queryParams = loopId ? `?loopId=${loopId}&roundIndex=${roundIndex}` : '';
      navigate(`/scorecard/${sessionId}${queryParams}`);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || err.message || "Unknown error";
      if (!auto) alert(`Failed to generate scorecard: ${msg}`);
      setIsGeneratingScorecard(false);
    }
  }, [messages, sessionId, scorecardModel, navigate, isTutor, clear, clearSessionArtifacts, loopId, roundIndex]);

  // ── Auto-submit when timer expires ────────────────────────────────────
  useEffect(() => {
    if (isExpired && !isTutor && !isGeneratingScorecard && messages.length > 0) {
      handleEndInterview(true);
    }
  }, [isExpired, isGeneratingScorecard, messages.length, handleEndInterview, isTutor]);

  if (!config) return null;

  // ── Setup phase ───────────────────────────────────────────────────────
  if (setupPhase) {
    return (
      <div className="interview-page">
        <header className="interview-header" style={{ '--type-color': config.color }}>
          <button className="back-btn" onClick={() => navigate('/')} aria-label="Back to home">← Back</button>
          <div className="interview-type-info">
            <span className="type-emoji">{config.emoji}</span>
            <div>
              <div className="type-label" style={{ color: config.color }}>{config.label}{isTutor ? ' Session' : ' Interview'}</div>
              <div className="type-fullname">{config.fullName}</div>
            </div>
          </div>
          <div className="header-right" />
        </header>
        <InterviewSetup interviewType={type} typeConfig={config} onBegin={handleBegin} />
      </div>
    );
  }

  // ── Interview phase ───────────────────────────────────────────────────
  return (
    <div className="interview-page">
      {/* Header */}
      <header className="interview-header" style={{ '--type-color': config.color }}>
        <button className="back-btn" onClick={() => navigate('/')} aria-label="Back to home">← Back</button>
        <div className="interview-type-info">
          <span className="type-emoji">{config.emoji}</span>
          <div>
            <div className="type-label" style={{ color: config.color }}>{config.label}{isTutor ? ' Session' : ' Interview'}</div>
            <div className="type-fullname">
              {questionMeta?.title
                ? <>
                    {questionMeta.title}
                    {questionMeta.link && (
                      <a href={questionMeta.link} target="_blank" rel="noopener noreferrer" className="question-link" title="View on LeetCode">
                        ↗
                      </a>
                    )}
                  </>
                : config.fullName}
            </div>
          </div>
        </div>
        <div className="header-right">
          {!isEditorOpen && (
            <button className="btn btn-outline" onClick={() => setIsEditorOpen(true)} disabled={isLoading} title="Open Code Editor">
              &lt;/&gt; Code
            </button>
          )}
          {!isTutor && (
            <div className={`interview-timer ${isUrgent ? 'interview-timer--urgent' : ''} ${isExpired ? 'interview-timer--expired' : ''}`}>
              ⏱ {formattedTime}
            </div>
          )}
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            disabled={isLoading}
          />
          <div className="session-badge">
            <span className="session-dot" />
            Live
          </div>
          <button 
            className="btn btn-outline new-session-btn" 
            onClick={handleEndInterview} 
            disabled={isLoading || isGeneratingScorecard || messages.length === 0}
            style={{ borderColor: '#ef4444', color: '#ef4444' }}
          >
            {isGeneratingScorecard ? 'Generating...' : (isTutor ? 'End Lesson' : 'End Interview')}
          </button>
          <button className="btn btn-outline new-session-btn" onClick={handleNewSession} disabled={isLoading || isGeneratingScorecard}>
            New Session
          </button>
        </div>
      </header>

      {/* Main Body (Chat + optional Editor) */}
      <div className="interview-body">
        <PanelGroup direction="horizontal" autoSaveId="interview-split">
          {/* Chat Panel */}
          <Panel defaultSize={isEditorOpen ? 50 : 100} minSize={30}>
            <div className="chat-full-width">
              <main className="chat-area">
                <div className="messages-container">
                  {/* Session config badge */}
                  {sessionConfig && (
                    <div className="session-config-badge">
                      {sessionConfig.company && <span>🏢 {sessionConfig.company}</span>}
                      <span>⚡ {sessionConfig.difficulty === 'ANY' ? 'Any Difficulty' : sessionConfig.difficulty}</span>
                      {sessionConfig.language && type === 'dsa' && <span>💻 {sessionConfig.language}</span>}
                    </div>
                  )}

                  {messages.length === 0 && !isLoading && !error && (
                    <div className="empty-state">
                      <span className="empty-emoji">{config.emoji}</span>
                      <p>Connecting to your AI interviewer...</p>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <MessageBubble key={i} message={msg} typeColor={config.color} />
                  ))}

                  {modelNotice && (
                    <div className="model-notice">{modelNotice}</div>
                  )}

                  {isLoading && <TypingIndicator />}

                  {error && (
                    <div className="error-banner" role="alert">
                      <span>⚠️ {error}</span>
                      <button className="btn btn-ghost retry-btn" onClick={handleSend}>Retry</button>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </main>

              <footer className="input-area">
                <div className="input-wrapper">
                  <textarea
                    ref={inputRef}
                    className="chat-input"
                    placeholder="Type your answer… (Shift+Enter for new line, Enter to send)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={isLoading || isGeneratingScorecard}
                    style={{ '--focus-color': config.color }}
                  />
                  {voiceSupported && (
                    <button
                      className={`mic-btn ${isListening ? 'mic-btn--active' : ''}`}
                      onClick={isListening ? stopListening : startListening}
                      disabled={isLoading || isGeneratingScorecard}
                      aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                      title={isListening ? 'Stop recording' : 'Speak your answer'}
                    >
                      {isListening ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      )}
                    </button>
                  )}
                  <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading || isGeneratingScorecard}
                    style={{ background: config.color }}
                    aria-label="Send message"
                  >
                    {isLoading ? (
                      <span className="send-spinner" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    )}
                  </button>
                </div>
                {voiceError && <p className="voice-error">🎤 {voiceError}</p>}
                {isListening && <p className="voice-listening">🎤 Listening… speak your answer, then click the stop button</p>}
                <p className="input-hint">
                  {isTutor ? 'Tutor' : 'Interviewer'}: <strong style={{ color: config.color }}>{config.label} Mode</strong> ·
                  {isTutor ? 'Tip: Ask questions and learn at your own pace' : 'Tip: Think out loud and communicate your reasoning'}
                </p>
              </footer>
            </div>
          </Panel>
          
          {isEditorOpen && (
            <>
              <PanelResizeHandle className="resize-handle" />
              <Panel defaultSize={50} minSize={30}>
                <div className="editor-area">
                  <div className="editor-header-bar">
                    <span>Code Editor</span>
                    <button className="close-editor-btn" onClick={() => setIsEditorOpen(false)}>×</button>
                  </div>
                  <CodeEditor 
                    sessionId={sessionId} 
                    language={sessionConfig?.language || 'javascript'} 
                    onSubmitCode={handleCodeSubmit}
                    problemTitle={questionMeta?.title}
                    model={sessionConfig?.model}
                  />
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}
