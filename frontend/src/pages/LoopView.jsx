import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLoopPersist } from '../hooks/useLoopPersist';
import { TYPE_CONFIG } from '../utils/constants';
import { Badge, Button, Card, EmptyState, Icon, ProgressBar, Skeleton } from '../components/ui';
import PageHeader from '../components/PageHeader';
import './LoopView.css';

const STATE_LABEL = { passed: 'Passed', failed: 'Not passed', active: 'In progress', current: 'Up next', pending: 'Pending', locked: 'Locked' };
const STATE_TONE = { passed: 'success', failed: 'danger', active: 'accent', current: 'accent', pending: 'neutral', locked: 'neutral' };

export default function LoopView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getLoop } = useLoopPersist();
  const [loop, setLoop] = useState(null);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getLoop(id)
      .then((data) => {
        if (!active) return;
        if (data) {
          setLoop(data);
          setStatus('ready');
        } else {
          setStatus('missing');
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => { active = false; };
  }, [id, getLoop, attempt]);

  const retryLoad = () => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  };

  if (status !== 'ready') {
    return (
      <div className="loop-page">
        <PageHeader title="Interview loop" backTo="/" backLabel="Home" />
        <div className="loop-page__content">
          {status === 'loading' ? (
            <Card className="loop-summary">
              <Skeleton width="40%" height={22} />
              <Skeleton width="60%" height={14} />
              <Skeleton width="100%" height={8} />
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon="alert"
                title={status === 'missing' ? 'Loop not found' : 'Could not load this loop'}
                description="It may have been deleted, or the connection failed."
                action={(
                  <>
                    {status === 'error' && <Button onClick={retryLoad}>Try again</Button>}
                    <Button variant="secondary" onClick={() => navigate('/')}>Back to home</Button>
                  </>
                )}
              />
            </Card>
          )}
        </div>
      </div>
    );
  }

  const rounds = loop.rounds || [];
  const doneCount = rounds.filter((r) => r.status === 'passed' || r.status === 'failed').length;
  const loopStatus = (loop.status || 'in-progress').replace('-', ' ');
  const loopLabel = loopStatus.charAt(0).toUpperCase() + loopStatus.slice(1);
  const loopTone = loop.status === 'completed' ? 'success' : loop.status === 'failed' ? 'danger' : 'accent';

  return (
    <div className="loop-page">
      <PageHeader
        icon={<Icon name="building" size={16} />}
        title={`${loop.company} interview loop`}
        subtitle={`${loop.level} · ${rounds.length} rounds`}
        backTo="/"
        backLabel="Home"
      />

      <div className="loop-page__content">
        <Card className="loop-summary">
          <div>
            <h2 className="loop-summary__title">{loop.company}</h2>
            <div className="loop-summary__meta">
              <Badge>{loop.level}</Badge>
              <Badge tone={loopTone}>{loopLabel}</Badge>
            </div>
          </div>
          <ProgressBar value={doneCount} max={rounds.length} label={`${doneCount} of ${rounds.length} rounds done`} ariaLabel="Loop progress" />
        </Card>

        <ol className="loop-steps">
          {rounds.map((round, index) => {
            const config = TYPE_CONFIG[round.type] || { label: round.type };
            const isCurrent = index === loop.currentRoundIndex && loop.status === 'in-progress';
            const inProgress = round.status === 'in-progress' && Boolean(round.sessionId);
            const finished = round.status === 'passed' || round.status === 'failed';
            const hasScore = round.score !== null && round.score !== undefined;
            let state = 'pending';
            if (index > loop.currentRoundIndex) state = 'locked';
            else if (finished) state = round.status;
            else if (isCurrent) state = inProgress ? 'active' : 'current';

            return (
              <li key={index} className={`loop-step loop-step--${state}`} aria-current={isCurrent ? 'step' : undefined}>
                <span className="loop-step__marker" aria-hidden="true">
                  {state === 'passed' && <Icon name="check" size={16} />}
                  {state === 'failed' && <Icon name="x" size={16} />}
                  {state === 'locked' && <Icon name="lock" size={14} />}
                  {!finished && state !== 'locked' && index + 1}
                </span>
                <Card className="loop-step__card">
                  <div className="loop-step__head">
                    <div>
                      <span className="loop-step__eyebrow">Round {index + 1} · {config.label}</span>
                      <h3 className="loop-step__title">{round.name}</h3>
                    </div>
                    <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>
                  </div>
                  {(isCurrent || (finished && round.sessionId) || hasScore) && (
                    <div className="loop-step__actions">
                      {isCurrent && (
                        <Button
                          size="sm"
                          iconRight="arrowRight"
                          onClick={() => navigate(`/interview/${round.type}?loopId=${loop.id}&roundIndex=${index}${inProgress ? `&session=${round.sessionId}` : ''}`)}
                        >
                          {inProgress ? 'Resume round' : 'Start round'}
                        </Button>
                      )}
                      {finished && round.sessionId && (
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/scorecard/${round.sessionId}`)}>View scorecard</Button>
                      )}
                      {hasScore && <span className="loop-step__score">Score {round.score}/100</span>}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
