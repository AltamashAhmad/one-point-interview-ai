import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { submitAccessRequest, getAccessRequestStatus } from '../services/api';
import './AccessWall.css';

const PURPOSE_OPTIONS = [
  { value: 'job_prep', label: '💼 Preparing for job interviews', desc: 'FAANG, startup, or general SWE interviews' },
  { value: 'learning', label: '📚 Learning CS concepts', desc: 'DSA, system design, or OOP concepts' },
  { value: 'academic', label: '🎓 Academic / university use', desc: 'Coursework, research, or assignments' },
  { value: 'other',    label: '💡 Other', desc: 'Tell us more in the message below' },
];

export default function AccessWall() {
  const { user, trialUsed, trialLimit, refreshUserProfile } = useAuth();

  const [view, setView]           = useState('wall');   // 'wall' | 'form' | 'pending' | 'denied'
  const [purpose, setPurpose]     = useState('');
  const [reason, setReason]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState(null);
  const [requestInfo, setRequestInfo] = useState(null);

  // ── Check existing request status on mount ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function checkStatus() {
      try {
        const data = await getAccessRequestStatus();
        if (cancelled) return;
        if (data.status === 'pending') {
          setRequestInfo(data.request);
          setView('pending');
        } else if (data.status === 'denied') {
          setRequestInfo(data.request);
          setView('denied');
        } else if (data.status === 'approved' || data.userStatus === 'APPROVED') {
          // Refresh parent profile so the wall disappears automatically
          refreshUserProfile();
        }
      } catch { /* non-fatal */ }
    }
    checkStatus();
    return () => { cancelled = true; };
  }, [refreshUserProfile]);

  // ── Poll for approval every 30 seconds while pending ─────────────────────
  useEffect(() => {
    if (view !== 'pending') return;
    const interval = setInterval(async () => {
      try {
        const data = await getAccessRequestStatus();
        if (data.status === 'approved' || data.userStatus === 'APPROVED') {
          refreshUserProfile();
        } else if (data.status === 'denied') {
          setRequestInfo(data.request);
          setView('denied');
        }
      } catch { /* non-fatal */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, [view, refreshUserProfile]);

  // ── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!purpose) { setError('Please select a purpose.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await submitAccessRequest({ purpose, reason });
      setView('pending');
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to submit. Please try again.';
      if (msg.includes('already have a pending')) {
        setView('pending');
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }, [purpose, reason]);

  const trialExhausted = (trialUsed ?? 0) >= (trialLimit ?? 3);
  const displayName = user?.displayName?.split(' ')[0] || 'there';

  // ─── VIEW: WALL (trials not yet exhausted — show counter) ────────────────
  if (!trialExhausted) {
    return (
      <div className="aw-overlay">
        <div className="aw-card aw-trial-card">
          <div className="aw-trial-icon">🎯</div>
          <h2 className="aw-title">Free Trial Active</h2>
          <p className="aw-subtitle">Hey {displayName}, you're on a free trial.</p>
          <div className="aw-trial-meter">
            <div className="aw-trial-meter-track">
              <div
                className="aw-trial-meter-fill"
                style={{ width: `${((trialUsed ?? 0) / (trialLimit ?? 3)) * 100}%` }}
              />
            </div>
            <div className="aw-trial-counts">
              <span className="aw-trial-used">{trialUsed ?? 0} used</span>
              <span className="aw-trial-left">{(trialLimit ?? 3) - (trialUsed ?? 0)} remaining</span>
            </div>
          </div>
          <p className="aw-trial-note">
            After your {trialLimit ?? 3} free sessions you'll need to request full access.
            We review all requests personally.
          </p>
        </div>
      </div>
    );
  }

  // ─── VIEW: PENDING ────────────────────────────────────────────────────────
  if (view === 'pending') {
    return (
      <div className="aw-overlay">
        <div className="aw-card">
          <div className="aw-status-icon aw-status-pending">⏳</div>
          <h2 className="aw-title">Request Under Review</h2>
          <p className="aw-subtitle">
            Your access request is being reviewed. We'll email you at{' '}
            <strong className="aw-email">{user?.email}</strong> once a decision is made.
          </p>
          <div className="aw-pending-steps">
            <div className="aw-step aw-step-done">
              <div className="aw-step-dot" />
              <span>Request submitted</span>
            </div>
            <div className="aw-step-line" />
            <div className="aw-step aw-step-active">
              <div className="aw-step-dot aw-step-dot-pulse" />
              <span>Under review</span>
            </div>
            <div className="aw-step-line aw-step-line-dim" />
            <div className="aw-step aw-step-dim">
              <div className="aw-step-dot aw-step-dot-dim" />
              <span>Decision</span>
            </div>
          </div>
          <p className="aw-poll-note">Checking for updates automatically every 30 seconds…</p>
        </div>
      </div>
    );
  }

  // ─── VIEW: DENIED ─────────────────────────────────────────────────────────
  if (view === 'denied') {
    return (
      <div className="aw-overlay">
        <div className="aw-card">
          <div className="aw-status-icon aw-status-denied">❌</div>
          <h2 className="aw-title">Request Not Approved</h2>
          <p className="aw-subtitle">
            Your previous request wasn't approved. You can submit a new one with more details.
          </p>
          {requestInfo?.reviewNote && (
            <div className="aw-denial-reason">
              <span className="aw-denial-label">Reason given:</span>
              <span className="aw-denial-text">{requestInfo.reviewNote}</span>
            </div>
          )}
          <button className="aw-btn aw-btn-primary" onClick={() => { setView('form'); setError(null); }}>
            Submit New Request
          </button>
        </div>
      </div>
    );
  }

  // ─── VIEW: FORM ───────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="aw-overlay">
        <div className="aw-card aw-form-card">
          <button className="aw-back" onClick={() => setView('wall')}>← Back</button>
          <div className="aw-form-header">
            <div className="aw-form-icon">📝</div>
            <h2 className="aw-title">Request Full Access</h2>
            <p className="aw-subtitle">Tell us a bit about how you'll use OnePoint AI.</p>
          </div>

          <form className="aw-form" onSubmit={handleSubmit}>
            {/* Purpose selection */}
            <div className="aw-field">
              <label className="aw-label">Why do you want access? <span className="aw-required">*</span></label>
              <div className="aw-purpose-grid">
                {PURPOSE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`aw-purpose-btn ${purpose === opt.value ? 'aw-purpose-btn--selected' : ''}`}
                    onClick={() => setPurpose(opt.value)}
                  >
                    <span className="aw-purpose-label">{opt.label}</span>
                    <span className="aw-purpose-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reason textarea */}
            <div className="aw-field">
              <label className="aw-label">
                Tell us more <span className="aw-optional">(optional)</span>
              </label>
              <textarea
                className="aw-textarea"
                placeholder="e.g. I'm preparing for my Google onsite interviews next month and want to practice daily…"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                rows={4}
              />
              <span className="aw-char-count">{reason.length}/500</span>
            </div>

            {error && <div className="aw-error">{error}</div>}

            <button
              type="submit"
              className="aw-btn aw-btn-primary aw-btn-submit"
              disabled={submitting || !purpose}
            >
              {submitting ? (
                <><span className="aw-spinner" /> Submitting…</>
              ) : (
                '🚀 Submit Request'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── VIEW: WALL (trials exhausted — main CTA) ─────────────────────────────
  return (
    <div className="aw-overlay">
      <div className="aw-card">
        {/* Badge */}
        <div className="aw-exhausted-badge">Trial Complete</div>

        {/* Icon */}
        <div className="aw-wall-icon">
          <span>🎯</span>
        </div>

        <h2 className="aw-title">
          You've Used Your {trialLimit ?? 3} Free Sessions
        </h2>
        <p className="aw-subtitle">
          Hey {displayName}! You've completed your free trial. To continue practicing with
          OnePoint AI, request full access — it's free, we just review to prevent abuse.
        </p>

        {/* What you get */}
        <div className="aw-perks">
          <div className="aw-perk">
            <span className="aw-perk-icon">✅</span>
            <div>
              <strong>20 sessions/day</strong>
              <span>More than enough for serious prep</span>
            </div>
          </div>
          <div className="aw-perk">
            <span className="aw-perk-icon">✅</span>
            <div>
              <strong>All interview types</strong>
              <span>DSA, System Design, LLD, Managerial</span>
            </div>
          </div>
          <div className="aw-perk">
            <span className="aw-perk-icon">✅</span>
            <div>
              <strong>464 company question banks</strong>
              <span>Google, Meta, Amazon, and more</span>
            </div>
          </div>
          <div className="aw-perk">
            <span className="aw-perk-icon">✅</span>
            <div>
              <strong>AI Scorecards</strong>
              <span>Detailed feedback after every session</span>
            </div>
          </div>
        </div>

        <button
          className="aw-btn aw-btn-primary aw-btn-cta"
          onClick={() => setView('form')}
        >
          Request Full Access — It's Free
        </button>

        <p className="aw-review-note">
          🔍 Requests are reviewed by a human. Usually approved within 24 hours.
        </p>
      </div>
    </div>
  );
}
