import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession } from '../services/api';
import { TYPE_CONFIG } from '../utils/constants';
import { Badge, Button, Card, EmptyState, Icon } from '../components/ui';
import PageHeader from '../components/PageHeader';
import './ScorecardView.css';

const RING_PATH = 'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831';

// Order matters: "lean hire" and "no hire" both contain "hire".
function verdictTone(verdict) {
  const v = (verdict || '').toLowerCase();
  if (v.includes('strong hire')) return 'success';
  if (v.includes('lean hire')) return 'warning';
  if (v.includes('no hire') || v.includes('lean no')) return 'danger';
  if (v.includes('hire')) return 'success';
  return 'accent';
}

export default function ScorecardView() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getSession(sessionId)
      .then((data) => {
        if (!active) return;
        if (!data) throw new Error('Session not found');
        setSession(data);
        if (!data.scorecard) {
          setError(data.status === 'active'
            ? "This interview hasn't been scored yet. Continue it and click End Interview to get your scorecard."
            : 'Scorecard is not available for this session.');
        }
      })
      .catch(() => {
        if (!active) return;
        setLoadFailed(true);
        setError('Failed to load scorecard.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId, attempt]);

  const retryLoad = () => {
    setLoadFailed(false);
    setError('');
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  const loopId = session?.source?.kind === 'loop' ? session.source.loopId : null;
  const goBack = () => navigate(loopId ? `/loop/${loopId}` : '/history');

  if (loading) {
    return (
      <div className="score-state">
        <div className="spinner" />
        <p>Loading your AI Scorecard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="score-state">
        <EmptyState
          icon="alert"
          title="Scorecard unavailable"
          description={error}
          action={(
            <div className="score-state__actions">
              {loadFailed && <Button onClick={retryLoad}>Try again</Button>}
              {session?.status === 'active' && (
                <Button onClick={() => navigate(`/interview/${session.interviewType}?session=${session.id}`)}>Continue interview</Button>
              )}
              <Button variant="secondary" onClick={goBack}>Back</Button>
            </div>
          )}
        />
      </div>
    );
  }

  const { scorecard, interviewType } = session;
  const questionTitle = session.question?.title;
  const { company, difficulty } = session.config || {};
  const typeLabel = TYPE_CONFIG[interviewType]?.fullName || interviewType;
  const tone = verdictTone(scorecard.verdict);
  const strengths = scorecard.strengths || [];
  const weaknesses = scorecard.weaknesses || [];

  return (
    <div className="score-page">
      <PageHeader
        icon={<Icon name={TYPE_CONFIG[interviewType]?.icon || 'checklist'} size={20} />}
        title="Interview scorecard"
        subtitle={[typeLabel, company, difficulty && difficulty !== 'ANY' ? difficulty : null].filter(Boolean).join(' • ')}
        backTo={loopId ? `/loop/${loopId}` : '/history'}
        backLabel={loopId ? 'Loop' : 'History'}
      />

      <div className="score-page__content">
        <Card className="score-hero">
          <div className={`score-ring score-ring--${tone}`}>
            <svg className="score-ring__svg" viewBox="0 0 36 36" role="img" aria-label={`Overall score ${scorecard.score} out of 100`}>
              <path className="score-ring__track" d={RING_PATH} />
              <path className="score-ring__value" d={RING_PATH} strokeDasharray={`${scorecard.score}, 100`} />
              <text x="18" y="20.5" className="score-ring__text">{scorecard.score}</text>
            </svg>
            <span className="score-ring__label">Overall score</span>
          </div>
          <div className="score-hero__verdict">
            <span className="score-hero__eyebrow">Final verdict</span>
            <Badge tone={tone} className="score-hero__badge">{scorecard.verdict}</Badge>
            {questionTitle && <p className="score-hero__question">Question: <strong>{questionTitle}</strong></p>}
          </div>
        </Card>

        <div className="score-grid">
          <Card title="Strengths">
            {strengths.length > 0
              ? <ul className="score-list score-list--success">{strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
              : <p className="score-empty">No strengths were recorded.</p>}
          </Card>
          <Card title="Areas for improvement">
            {weaknesses.length > 0
              ? <ul className="score-list score-list--danger">{weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
              : <p className="score-empty">No weaknesses were recorded.</p>}
          </Card>
        </div>

        <div className="score-rubric">
          <Card title="Problem solving & technical depth">
            <p className="score-rubric__text">{scorecard.problemSolving}</p>
          </Card>
          <Card title="Communication & clarity">
            <p className="score-rubric__text">{scorecard.communication}</p>
          </Card>
        </div>

        <div className="score-actions">
          <Button variant="secondary" onClick={() => navigate('/')}>Back to home</Button>
          <Button variant="ghost" onClick={() => navigate(`/history/${session.id}`)}>View transcript & notes</Button>
          {loopId
            ? <Button iconRight="arrowRight" onClick={goBack}>Continue loop</Button>
            : <Button onClick={() => navigate(`/interview/${interviewType}`)}>Practice again</Button>}
        </div>
      </div>
    </div>
  );
}
