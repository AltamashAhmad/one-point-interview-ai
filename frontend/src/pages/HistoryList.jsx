import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listSessions, deleteSession, updateSession } from '../services/api';
import { describeError } from '../utils/errors';
import { TYPE_CONFIG, formatDate, friendlyModelName } from '../utils/constants';
import { Badge, Button, Card, Dialog, EmptyState, Icon, IconButton, Input, Skeleton } from '../components/ui';
import PageHeader from '../components/PageHeader';
import './HistoryList.css';

const TYPE_FILTERS = [
  { value: 'all', label: 'All types' },
  { value: 'dsa', label: 'DSA', types: ['dsa'] },
  { value: 'systemDesign', label: 'System design', types: ['systemDesign'] },
  { value: 'lld', label: 'LLD', types: ['lld'] },
  { value: 'managerial', label: 'Behavioral', types: ['managerial'] },
  { value: 'tutor', label: 'Tutor', types: ['tutorDsa', 'tutorLld', 'tutorSystemDesign'] },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'In progress' },
  { value: 'scored', label: 'Scored' },
  { value: 'closed', label: 'Closed' },
];

const TYPE_ICON = {
  dsa: 'code',
  systemDesign: 'layers',
  lld: 'box',
  managerial: 'message',
  tutorDsa: 'graduation',
  tutorLld: 'graduation',
  tutorSystemDesign: 'graduation',
};

function matchesStatus(s, status) {
  if (status === 'active') return s.status === 'active';
  if (status === 'scored') return Boolean(s.scorecard);
  if (status === 'closed') return s.status !== 'active' && !s.scorecard;
  return true;
}

function resultBadge(s, timedOut) {
  if (s.scorecard) {
    const { score } = s.scorecard;
    return <Badge tone={score >= 70 ? 'success' : score >= 50 ? 'warning' : 'danger'}>{score}/100</Badge>;
  }
  if (s.status === 'active') {
    if (!timedOut) return <Badge tone="accent">In progress</Badge>;
    return <Badge tone="warning">{s.userMessageCount ? "Time's up" : 'Timed out'}</Badge>;
  }
  if (s.endReason === 'timeout') return <Badge>Timed out</Badge>;
  if (s.status === 'archived') return <Badge>Archived</Badge>;
  return <Badge>Completed</Badge>;
}

function SessionRow({ interview, pinning, onOpen, onPin, onDelete }) {
  const type = TYPE_CONFIG[interview.interviewType];
  const cfg = interview.config || {};
  const timedOut = interview.status === 'active' && Boolean(interview.timerEndsAt) && Date.parse(interview.timerEndsAt) <= Date.now();
  const facts = [
    type?.label || interview.interviewType,
    cfg.company,
    cfg.difficulty && cfg.difficulty !== 'ANY' ? cfg.difficulty : null,
    cfg.language,
    friendlyModelName(cfg.model),
    formatDate(interview.startedAt || interview.updatedAt),
  ].filter(Boolean);

  return (
    <li className={`history-row${interview.isPinned ? ' is-pinned' : ''}`}>
      <button type="button" className="history-row__open" onClick={onOpen}>
        <span className="history-row__icon" aria-hidden="true">
          <Icon name={TYPE_ICON[interview.interviewType] || 'book'} size={18} />
        </span>
        <span className="history-row__body">
          <span className="history-row__title">{interview.question?.title || type?.fullName || interview.interviewType}</span>
          <span className="history-row__meta">
            {facts.map((fact, i) => <span key={i}>{fact}</span>)}
          </span>
        </span>
        <span className="history-row__result">{resultBadge(interview, timedOut)}</span>
      </button>
      <div className="history-row__actions">
        <IconButton
          icon="pin"
          label={interview.isPinned ? 'Unpin session' : 'Pin session'}
          size="sm"
          className={interview.isPinned ? 'history-row__pin is-active' : 'history-row__pin'}
          disabled={pinning}
          onClick={onPin}
        />
        <IconButton icon="trash" label="Delete session" size="sm" onClick={onDelete} />
      </div>
    </li>
  );
}

export default function HistoryList() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [pinningId, setPinningId] = useState(null);
  const [pinError, setPinError] = useState(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const questionFilter = searchParams.get('question');

  const fetchHistory = useCallback(async () => {
    try {
      setInterviews(await listSessions());
      setError(null);
    } catch {
      setError('Failed to load interview history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const retry = () => {
    setLoading(true);
    fetchHistory();
  };

  const confirmDelete = (interview) => {
    setDeleteError(null);
    setDeleteTarget(interview);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSession(deleteTarget.id);
      setInterviews((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setDeleteError('Failed to delete session. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handlePin = async (interview) => {
    setPinError(null);
    setPinningId(interview.id);
    try {
      const result = await updateSession(interview.id, { isPinned: !interview.isPinned });
      setInterviews((prev) => prev.map((i) => (i.id === interview.id ? { ...i, isPinned: result.isPinned } : i)));
    } catch (err) {
      setPinError(describeError(err, 'Failed to update pin.'));
      setTimeout(() => setPinError(null), 4000);
    } finally {
      setPinningId(null);
    }
  };

  const typeTypes = TYPE_FILTERS.find((f) => f.value === typeFilter)?.types || null;
  const needle = query.trim().toLowerCase();

  const filtered = useMemo(() => interviews.filter((s) => {
    if (questionFilter && s.question?.title !== questionFilter) return false;
    if (typeTypes && !typeTypes.includes(s.interviewType)) return false;
    if (!matchesStatus(s, statusFilter)) return false;
    if (!needle) return true;
    const haystack = [s.question?.title, s.config?.company, TYPE_CONFIG[s.interviewType]?.label].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(needle);
  }), [interviews, questionFilter, typeTypes, statusFilter, needle]);

  const pinned = filtered.filter((s) => s.isPinned);
  const rest = filtered.filter((s) => !s.isPinned);
  const filtersActive = Boolean(needle) || typeFilter !== 'all' || statusFilter !== 'all';
  const count = interviews.length;
  const subtitle = questionFilter
    ? `Showing sessions for “${questionFilter}”`
    : filtersActive
      ? `${filtered.length} of ${count} sessions`
      : `${count} session${count === 1 ? '' : 's'}`;

  const clearFilters = () => {
    setQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
  };

  const renderRow = (s) => (
    <SessionRow
      key={s.id}
      interview={s}
      pinning={pinningId === s.id}
      onOpen={() => navigate(s.status === 'active' ? `/interview/${s.interviewType}?session=${s.id}` : `/history/${s.id}`)}
      onPin={() => handlePin(s)}
      onDelete={() => confirmDelete(s)}
    />
  );

  return (
    <div className="history-page">
      <PageHeader
        icon={<Icon name="history" size={16} />}
        title="Interview History"
        subtitle={subtitle}
        actions={questionFilter ? <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>Clear filter</Button> : null}
      />

      <div className="history-content">
        <div className="history-toolbar">
          <Input
            type="search"
            className="history-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by question, company or type"
            aria-label="Search sessions"
          />
          <div className="history-chips" role="group" aria-label="Filter by type">
            {TYPE_FILTERS.map((f) => (
              <button key={f.value} type="button" className="history-chip" aria-pressed={typeFilter === f.value} onClick={() => setTypeFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="history-chips" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((f) => (
              <button key={f.value} type="button" className="history-chip" aria-pressed={statusFilter === f.value} onClick={() => setStatusFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {pinError && <p className="history-notice" role="alert"><Icon name="alert" size={16} />{pinError}</p>}

        {loading ? (
          <Card padded={false} aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="history-row__skeleton">
                <Skeleton width={36} height={36} radius={8} />
                <div className="history-row__lines">
                  <Skeleton width={`${55 + i * 6}%`} height={14} />
                  <Skeleton width="30%" height={11} />
                </div>
              </div>
            ))}
          </Card>
        ) : error ? (
          <Card padded={false}>
            <EmptyState icon="alert" title="Couldn't load your history" description={error} action={<Button variant="secondary" onClick={retry}>Try again</Button>} />
          </Card>
        ) : interviews.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon="history"
              title="No interviews yet"
              description="Start an interview or tutor session and it will appear here."
              action={<Button onClick={() => navigate('/')}>Go to home</Button>}
            />
          </Card>
        ) : filtered.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon="search"
              title={questionFilter ? `No sessions for “${questionFilter}”` : 'No sessions match these filters'}
              description={questionFilter ? "You haven't practiced this question yet." : 'Try another search, or clear the filters.'}
              action={questionFilter
                ? <Button variant="secondary" onClick={() => navigate('/dsa-sheet')}>Back to DSA sheet</Button>
                : <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
            />
          </Card>
        ) : (
          <>
            {pinned.length > 0 && (
              <section className="history-section" aria-labelledby="history-pinned">
                <h2 id="history-pinned" className="history-section__title">Pinned</h2>
                <Card padded={false}><ul className="history-list">{pinned.map(renderRow)}</ul></Card>
              </section>
            )}
            {rest.length > 0 && (
              <section className="history-section" aria-labelledby="history-all">
                <h2 id="history-all" className="history-section__title">{pinned.length > 0 ? 'All sessions' : 'Sessions'}</h2>
                <Card padded={false}><ul className="history-list">{rest.map(renderRow)}</ul></Card>
              </section>
            )}
          </>
        )}
      </div>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this session?"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
          </>
        )}
      >
        <p className="modal-body">
          {deleteTarget?.question?.title
            ? <><strong>{deleteTarget.question.title}</strong> will be removed. This can't be undone.</>
            : "This interview session will be permanently deleted. This can't be undone."}
        </p>
        {deleteError && <p className="history-notice" role="alert"><Icon name="alert" size={16} />{deleteError}</p>}
      </Dialog>
    </div>
  );
}
