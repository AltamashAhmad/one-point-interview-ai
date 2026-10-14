import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useLoopPersist } from '../hooks/useLoopPersist';
import useTracker from '../hooks/useTracker';
import { generateAdminPrompt, listSessions } from '../services/api';
import { DSA_MASTER_TOTAL } from '../services/dsaMasterSheet';
import { TYPE_CONFIG, formatDate } from '../utils/constants';
import { describeError } from '../utils/errors';
import {
  Badge, Button, Card, Dialog, EmptyState, Field, Icon, IconButton, Input, ProgressBar, SegmentedControl, Select, Skeleton,
} from '../components/ui';
import AdminPromptModal from '../components/AdminPromptModal';
import ActiveInterviewBanner from '../components/ActiveInterviewBanner';
import GettingStarted from '../components/GettingStarted';
import './Landing.css';

const MOCK_TYPES = [
  { id: 'dsa', icon: 'code', description: 'Solve a coding problem live. Arrays, trees, graphs, dynamic programming and more.' },
  { id: 'systemDesign', icon: 'layers', description: 'Design a real system at scale: APIs, storage, caching, availability and trade-offs.' },
  { id: 'lld', icon: 'box', description: 'Model classes and interfaces with SOLID principles and design patterns.' },
  { id: 'managerial', icon: 'message', description: 'A hiring-manager round on past experience: conflict, ownership, ambiguity.' },
];

const TUTOR_TYPES = [
  { id: 'tutorDsa', icon: 'code', description: 'Learn step by step, from brute force to optimal. No timer, no pressure.' },
  { id: 'tutorLld', icon: 'box', description: 'Build design-pattern and class-modelling skills with guided feedback.' },
  { id: 'tutorSystemDesign', icon: 'layers', description: 'Walk through large-scale systems from scratch with an AI mentor.' },
];

const LEARN_LINKS = [
  { to: '/notes', icon: 'book', title: 'Notes', description: 'Data structures and algorithms from first principles.' },
  { to: '/dsa-sheet', icon: 'checklist', title: 'DSA Sheet', description: `${DSA_MASTER_TOTAL} must-solve problems grouped by pattern.` },
  { to: '/prep-plan', icon: 'calendar', title: 'Prep Plan', description: 'A day-by-day SDE-2 plan with slippage tracking.' },
];

const LOOP_ROUNDS = [
  { type: 'dsa', name: 'Coding - Data Structures' },
  { type: 'dsa', name: 'Coding - Algorithms' },
  { type: 'systemDesign', name: 'System Design' },
  { type: 'managerial', name: 'Behavioral & Leadership' },
];

function greeting(name) {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

export default function Landing({ adminPromptMode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { createLoop, getLoops, deleteLoop, migrateLocalLoops } = useLoopPersist();
  const tracker = useTracker('dsa-master');

  const [mode, setMode] = useState('mock');

  const [sessions, setSessions] = useState(null);
  const [sessionsFailed, setSessionsFailed] = useState(false);
  const [myLoops, setMyLoops] = useState([]);
  const [loadingLoops, setLoadingLoops] = useState(true);

  const [showLoopModal, setShowLoopModal] = useState(false);
  const [loopCompany, setLoopCompany] = useState('');
  const [loopLevel, setLoopLevel] = useState('L4');
  const [creatingLoop, setCreatingLoop] = useState(false);
  const [loopError, setLoopError] = useState(null);
  const [deleteLoopTarget, setDeleteLoopTarget] = useState(null);
  const [deletingLoop, setDeletingLoop] = useState(false);

  const [promptData, setPromptData] = useState(null);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  const refreshLoops = useCallback(async () => {
    try {
      setMyLoops((await getLoops()) || []);
    } catch (err) {
      console.error('Failed to load loops:', err);
    } finally {
      setLoadingLoops(false);
    }
  }, [getLoops]);

  useEffect(() => {
    let active = true;
    (async () => {
      await migrateLocalLoops();
      if (active) await refreshLoops();
    })();
    return () => { active = false; };
  }, [migrateLocalLoops, refreshLoops]);

  useEffect(() => {
    if (adminPromptMode) return undefined;
    let active = true;
    listSessions()
      .then((list) => { if (active) setSessions(list); })
      .catch((err) => {
        console.warn('Could not load sessions:', err);
        if (!active) return;
        setSessionsFailed(true);
        setSessions([]);
      });
    return () => { active = false; };
  }, [adminPromptMode]);

  const stats = useMemo(() => {
    const list = sessions || [];
    const scores = list.map((s) => s.scorecard?.score).filter((n) => typeof n === 'number');
    const solved = Object.values(tracker.items).filter((item) => item?.done).length;
    return {
      total: list.length,
      completed: list.filter((s) => s.status === 'completed').length,
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      solved,
    };
  }, [sessions, tracker.items]);

  const recent = useMemo(() => (sessions || []).filter((s) => !s.archived).slice(0, 5), [sessions]);

  const openLoopDialog = () => {
    setLoopError(null);
    setShowLoopModal(true);
  };

  const handleCreateLoop = async (e) => {
    e.preventDefault();
    if (!loopCompany.trim() || creatingLoop) return;
    setCreatingLoop(true);
    setLoopError(null);
    try {
      const newLoop = await createLoop(loopCompany, loopLevel, LOOP_ROUNDS);
      navigate('/loop/' + newLoop.id);
    } catch (err) {
      console.error('Failed to create loop:', err);
      setLoopError('Could not create the loop. Please try again.');
      setCreatingLoop(false);
    }
  };

  const confirmDeleteLoop = async () => {
    if (!deleteLoopTarget) return;
    setDeletingLoop(true);
    try {
      await deleteLoop(deleteLoopTarget);
      setMyLoops((prev) => prev.filter((l) => l.id !== deleteLoopTarget));
      setDeleteLoopTarget(null);
    } catch (err) {
      console.error('Failed to delete loop:', err);
      setLoopError('Could not delete the loop. Please try again.');
    } finally {
      setDeletingLoop(false);
    }
  };

  const handleStartInterview = async (typeId) => {
    if (adminPromptMode) {
      try {
        setGeneratingPrompt(true);
        setPromptData(await generateAdminPrompt({ interviewType: typeId, userName: user?.displayName }));
      } catch (err) {
        setPromptData({ error: describeError(err, 'Failed to generate prompt') });
      } finally {
        setGeneratingPrompt(false);
      }
      return;
    }
    navigate(`/interview/${typeId}`);
  };

  const firstName = (user?.displayName || '').trim().split(/\s+/)[0];
  const practiceTypes = mode === 'mock' ? MOCK_TYPES : TUTOR_TYPES;

  return (
    <div className="home">
      {adminPromptMode && (
        <div className="home-admin-banner" role="status">
          <span>
            <strong>Prompt generator.</strong> Choosing a card generates the AI prompt instead of starting an interview.
          </span>
          <Button variant="secondary" size="sm" onClick={() => navigate('/')}>Exit mode</Button>
        </div>
      )}

      <header className="home-head">
        <div>
          <h1 className="home-title">{adminPromptMode ? 'Prompt generator' : greeting(firstName)}</h1>
          <p className="home-subtitle">
            {adminPromptMode ? 'Preview the exact prompt an interview type sends to the AI.' : 'Pick up where you left off, or start something new.'}
          </p>
        </div>
        {!adminPromptMode && (
          <Button size="lg" icon="building" onClick={openLoopDialog}>Start a company loop</Button>
        )}
      </header>

      {!adminPromptMode && <ActiveInterviewBanner />}

      {!adminPromptMode && user?.uid && sessions !== null && !sessionsFailed && sessions.length === 0 && myLoops.length === 0 && !loadingLoops && (
        <GettingStarted userId={user.uid} onGo={navigate} />
      )}

      {!adminPromptMode && (
        <section className="home-stats" aria-label="Your progress">
          <StatCard label="Sessions" value={stats.total} loading={sessions === null} />
          <StatCard label="Completed" value={stats.completed} loading={sessions === null} />
          <StatCard label="Average score" value={stats.average === null ? '—' : stats.average} suffix={stats.average === null ? '' : '/100'} loading={sessions === null} />
          <Card className="home-stat home-stat--wide">
            <span className="home-stat__label">DSA sheet</span>
            <span className="home-stat__value">
              {tracker.loading ? <Skeleton width={72} height={28} /> : <>{stats.solved}<small> / {DSA_MASTER_TOTAL}</small></>}
            </span>
            <ProgressBar value={stats.solved} max={DSA_MASTER_TOTAL} size="sm" ariaLabel="DSA sheet progress" />
          </Card>
        </section>
      )}

      <section className="home-section" aria-labelledby="home-practice">
        <div className="home-section__head">
          <h2 id="home-practice" className="home-section__title">{adminPromptMode ? 'Interview types' : 'Practice'}</h2>
          <SegmentedControl
            ariaLabel="Practice mode"
            value={mode}
            onChange={setMode}
            options={[{ value: 'mock', label: 'Mock interview' }, { value: 'tutor', label: 'Tutor' }]}
          />
        </div>
        <p className="home-section__hint">
          {mode === 'mock'
            ? 'A timed round with a strict AI interviewer and a scorecard at the end.'
            : 'Learn at your own pace. The AI teaches, you answer, nothing is scored.'}
        </p>
        <div className="home-grid">
          {practiceTypes.map((item) => {
            const type = TYPE_CONFIG[item.id];
            return (
              <Card
                key={item.id}
                as="button"
                interactive
                className="home-practice"
                onClick={() => handleStartInterview(item.id)}
                aria-label={`${adminPromptMode ? 'Generate prompt for' : 'Start'} ${type.label}`}
              >
                <span className="home-practice__icon"><Icon name={item.icon} size={20} /></span>
                <span className="home-practice__label">{type.label}</span>
                <span className="home-practice__desc">{item.description}</span>
                <span className="home-practice__cta">
                  {adminPromptMode ? 'Generate prompt' : mode === 'mock' ? 'Start interview' : 'Start learning'}
                  <Icon name="arrowRight" size={16} />
                </span>
              </Card>
            );
          })}
        </div>
      </section>

      {!adminPromptMode && (
        <section className="home-section" aria-labelledby="home-learn">
          <div className="home-section__head">
            <h2 id="home-learn" className="home-section__title">Learn</h2>
          </div>
          <div className="home-grid home-grid--three">
            {LEARN_LINKS.map((link) => (
              <Card key={link.to} as="button" interactive className="home-learn" onClick={() => navigate(link.to)}>
                <span className="home-learn__icon"><Icon name={link.icon} size={18} /></span>
                <span className="home-learn__text">
                  <strong>{link.title}</strong>
                  <span>{link.description}</span>
                </span>
                <Icon name="chevronRight" size={16} className="home-learn__chevron" />
              </Card>
            ))}
          </div>
        </section>
      )}

      {!adminPromptMode && loadingLoops && (
        <section className="home-section" aria-busy="true">
          <div className="home-section__head">
            <h2 className="home-section__title">Your interview loops</h2>
          </div>
          <div className="home-grid home-grid--three">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="home-loop">
                <Skeleton width="60%" height={16} />
                <Skeleton width="100%" height={8} />
                <Skeleton width={96} height={28} />
              </Card>
            ))}
          </div>
        </section>
      )}

      {!adminPromptMode && !loadingLoops && myLoops.length > 0 && (
        <section className="home-section" aria-labelledby="home-loops">
          <div className="home-section__head">
            <h2 id="home-loops" className="home-section__title">Your interview loops</h2>
          </div>
          <div className="home-grid home-grid--three">
            {myLoops.map((loop) => {
              const total = loop.rounds?.length || 0;
              const done = (loop.rounds || []).filter((r) => r.status === 'passed' || r.status === 'failed').length;
              return (
                <Card key={loop.id} className="home-loop">
                  <div className="home-loop__top">
                    <div>
                      <strong className="home-loop__company">{loop.company}</strong>
                      <Badge tone="neutral">{loop.level}</Badge>
                    </div>
                    <IconButton icon="x" label={`Delete ${loop.company} loop`} size="sm" onClick={() => setDeleteLoopTarget(loop.id)} />
                  </div>
                  <ProgressBar value={done} max={total} size="sm" ariaLabel={`${loop.company} loop progress`} label={`${done} of ${total} rounds done`} />
                  <Button variant="secondary" size="sm" iconRight="arrowRight" onClick={() => navigate('/loop/' + loop.id)}>
                    {done === total && total > 0 ? 'View results' : 'Resume'}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {!adminPromptMode && (
        <section className="home-section" aria-labelledby="home-recent">
          <div className="home-section__head">
            <h2 id="home-recent" className="home-section__title">Recent sessions</h2>
            {recent.length > 0 && <Button variant="ghost" size="sm" iconRight="arrowRight" onClick={() => navigate('/history')}>View all</Button>}
          </div>
          {sessions === null ? (
            <Card padded={false}>
              {[0, 1, 2].map((i) => <div key={i} className="home-recent__row"><Skeleton width="60%" height={16} /></div>)}
            </Card>
          ) : recent.length === 0 ? (
            <Card>
              <EmptyState
                icon="play"
                title="No sessions yet"
                description="Start with a mock interview or a tutor session. Think out loud, clarify first, and give a simple solution before optimising."
                action={<Button onClick={() => handleStartInterview('dsa')}>Start a DSA interview</Button>}
              />
            </Card>
          ) : (
            <Card padded={false}>
              <ul className="home-recent">
                {recent.map((s) => {
                  const type = TYPE_CONFIG[s.interviewType];
                  const score = s.scorecard?.score;
                  return (
                    <li key={s.id}>
                      <button type="button" className="home-recent__row" onClick={() => navigate(`/history/${s.id}`)}>
                        <span className="home-recent__main">
                          <span className="home-recent__title">{s.question?.title || type?.fullName || s.interviewType}</span>
                          <span className="home-recent__meta">{type?.label || s.interviewType} · {formatDate(s.startedAt || s.updatedAt)}</span>
                        </span>
                        {typeof score === 'number'
                          ? <Badge tone={score >= 70 ? 'success' : score >= 50 ? 'warning' : 'danger'}>{score}/100</Badge>
                          : <Badge tone={s.status === 'active' ? 'accent' : 'neutral'}>{s.status === 'active' ? 'In progress' : 'No score'}</Badge>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>
      )}

      {generatingPrompt && (
        <div className="home-busy" role="status" aria-label="Generating prompt"><div className="spinner" /></div>
      )}

      <AdminPromptModal promptData={promptData} onClose={() => setPromptData(null)} />

      <Dialog
        open={showLoopModal}
        onClose={() => setShowLoopModal(false)}
        title="Start a company loop"
        description="Four back-to-back rounds, scored end to end like a real onsite."
      >
        <form onSubmit={handleCreateLoop} className="home-loop-form">
          {loopError && <p className="home-form-error" role="alert">{loopError}</p>}
          <Field label="Company">
            {(props) => (
              <Input {...props} value={loopCompany} onChange={(e) => setLoopCompany(e.target.value)} placeholder="e.g. Google, Meta, Amazon" required autoComplete="off" />
            )}
          </Field>
          <Field label="Target level">
            {(props) => (
              <Select {...props} value={loopLevel} onChange={(e) => setLoopLevel(e.target.value)}>
                <option value="L3">L3 / SDE I (Junior)</option>
                <option value="L4">L4 / SDE II (Mid)</option>
                <option value="L5">L5 / Senior</option>
                <option value="L6">L6 / Staff</option>
              </Select>
            )}
          </Field>
          <ol className="home-loop-rounds">
            {LOOP_ROUNDS.map((round) => <li key={round.name}>{round.name}</li>)}
          </ol>
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setShowLoopModal(false)}>Cancel</Button>
            <Button type="submit" loading={creatingLoop} disabled={!loopCompany.trim()}>Create loop</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(deleteLoopTarget)}
        onClose={() => setDeleteLoopTarget(null)}
        title="Delete this loop?"
        description="This interview loop and its round progress will be permanently deleted."
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDeleteLoopTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deletingLoop} onClick={confirmDeleteLoop}>Delete</Button>
          </>
        )}
      />
    </div>
  );
}

function StatCard({ label, value, suffix = '', loading }) {
  return (
    <Card className="home-stat">
      <span className="home-stat__label">{label}</span>
      <span className="home-stat__value">
        {loading ? <Skeleton width={56} height={28} /> : <>{value}{suffix && <small>{suffix}</small>}</>}
      </span>
    </Card>
  );
}
