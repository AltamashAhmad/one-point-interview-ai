import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { sendMessage } from '../services/api';
import MessageBubble from '../components/MessageBubble';
import TypingIndicator from '../components/TypingIndicator';
import './Interview.css';

const TYPE_CONFIG = {
  dsa: { label: 'DSA', fullName: 'Data Structures & Algorithms', color: '#3b82f6', emoji: '🧩' },
  systemDesign: { label: 'System Design', fullName: 'Scalable System Architecture', color: '#8b5cf6', emoji: '🏗️' },
  lld: { label: 'LLD', fullName: 'Low-Level / OOP Design', color: '#10b981', emoji: '🔧' },
};

const INITIAL_MESSAGE = {
  role: 'user',
  content: 'Hello, I am ready to start the interview. Please begin.',
};

export default function Interview() {
  const { type } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Extract first name for the personalised greeting
  const userName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  const config = TYPE_CONFIG[type];

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const hasFetched = useRef(false);

  // Redirect if invalid interview type
  useEffect(() => {
    if (!config) navigate('/');
  }, [config, navigate]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Start interview automatically on mount
  useEffect(() => {
    if (!config || hasFetched.current) return;
    hasFetched.current = true;
    startInterview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startInterview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSessionStarted(true);

    const initialMessages = [INITIAL_MESSAGE];
    setMessages([]);

    try {
      const response = await sendMessage(initialMessages, type, userName);
      setMessages([{ role: 'assistant', content: response.content }]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect to the AI interviewer. Please check your connection.');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [type]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage = { role: 'user', content: trimmed };

    // Optimistically add user message
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setError(null);

    // Build the full message history for the API
    const apiMessages = [INITIAL_MESSAGE, ...newMessages];

    try {
      const response = await sendMessage(apiMessages, type, userName);
      setMessages((prev) => [...prev, { role: 'assistant', content: response.content }]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to get a response. Please try again.');
      // Remove the optimistic user message on error
      setMessages(messages);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, isLoading, messages, type]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewSession = () => {
    hasFetched.current = false;
    setMessages([]);
    setInput('');
    setError(null);
    startInterview();
  };

  if (!config) return null;

  return (
    <div className="interview-page">
      {/* Header */}
      <header className="interview-header" style={{ '--type-color': config.color }}>
        <button className="back-btn" onClick={() => navigate('/')} aria-label="Back to home">
          ← Back
        </button>
        <div className="interview-type-info">
          <span className="type-emoji">{config.emoji}</span>
          <div>
            <div className="type-label" style={{ color: config.color }}>{config.label} Interview</div>
            <div className="type-fullname">{config.fullName}</div>
          </div>
        </div>
        <div className="header-right">
          <div className="session-badge">
            <span className="session-dot" />
            Session Active
          </div>
          <button className="btn btn-outline new-session-btn" onClick={handleNewSession} disabled={isLoading}>
            New Session
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="chat-area">
        <div className="messages-container">
          {messages.length === 0 && !isLoading && !error && (
            <div className="empty-state">
              <span className="empty-emoji">{config.emoji}</span>
              <p>Connecting to your AI interviewer...</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} typeColor={config.color} />
          ))}

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

      {/* Input Area */}
      <footer className="input-area">
        <div className="input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Type your answer... (Shift+Enter for new line, Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading || !sessionStarted}
            style={{ '--focus-color': config.color }}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
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
        <p className="input-hint">
          Interviewer: <strong style={{ color: config.color }}>{config.label} Mode</strong> · 
          Tip: Think out loud and communicate your reasoning
        </p>
      </footer>
    </div>
  );
}
