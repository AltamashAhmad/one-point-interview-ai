import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PREP_PLAN, TOTAL_WEEKS, DURATION_VERDICT, DAILY_LOG_TEMPLATE, DAY_ORDER, taskKey,
} from '../services/prepPlan';
import { leetcodeUrl } from '../services/dsaMasterSheet';
import useTracker from '../hooks/useTracker';
import NoteEditor from '../components/NoteEditor';
import PageHeader from '../components/PageHeader';
import {
  Badge, Button, Dialog, EmptyState, Field, Icon, IconButton, Input, ProgressBar, Select, Skeleton, Tabs, Textarea, Toast,
} from '../components/ui';
import './PrepPlan.css';

const SHEET_ID = 'prep-plan';
const SETTINGS_KEY = 'meta:settings';
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKLY_BUDGET_HOURS = 10.5;
const LOG_STATUS_LABEL = { done: 'Done', partial: 'Partial', 'not-done': 'Not done' };
const LOG_STATUS_TONE = { done: 'success', partial: 'warning', 'not-done': 'danger' };

const VERDICT_LINE = DURATION_VERDICT.find((line) => line.startsWith('Verdict:')) ?? '';
const VERDICT_ANSWER = VERDICT_LINE.replace(/^Verdict:\s*/, '');
const VERDICT_FACTS = DURATION_VERDICT.filter((line) => line !== VERDICT_LINE).map((line) => {
  const cut = line.indexOf(': ');
  return cut > 0 ? { label: line.slice(0, cut), text: line.slice(cut + 2) } : { label: 'Note', text: line };
});

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISODate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function nextMonday(dateStr) {
  const d = parseISODate(dateStr);
  const offset = (8 - d.getDay()) % 7; // 0 when already Monday
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset));
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function formatShort(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function splitPhaseTitle(title) {
  const [label, ...name] = title.split(' — ');
  return { label, name: name.join(' — ') };
}

function weekTaskKeys(week) {
  return week.days.flatMap((d) => d.tasks.map((_, i) => taskKey(week.id, d.day, i)));
}

function phaseProgress(phase, items) {
  if (phase.weeks) {
    const keys = phase.weeks.flatMap(weekTaskKeys);
    return { done: keys.filter((k) => items[k]?.done).length, total: keys.length, unit: 'tasks' };
  }
  return {
    done: phase.overview.filter((w) => items[`week:${w.id}`]?.done).length,
    total: phase.overview.length,
    unit: 'weeks',
  };
}

/** Plan text from the data file; backtick spans render as inline code. */
function Rich({ text }) {
  return text.split('`').map((part, i) => (i % 2 === 1
    ? <code key={i} className="prep-code">{part}</code>
    : <React.Fragment key={i}>{part}</React.Fragment>));
}

function Stat({ label, value, alert = false }) {
  const unset = value === null;
  const hot = alert && !unset && value > 0;
  return (
    <div className={`prep-stat${hot ? ' is-alert' : ''}`}>
      <span className="prep-stat-label">{label}</span>
      <span className={`prep-stat-value${unset ? ' is-empty' : ''}`}>{unset ? 'Not set' : value}</span>
    </div>
  );
}

function PlanSkeleton() {
  return (
    <div className="prep-skeleton" role="status" aria-label="Loading your plan">
      <Skeleton height={150} radius="var(--radius-lg)" />
      <Skeleton height={220} radius="var(--radius-lg)" />
      <Skeleton height={320} radius="var(--radius-lg)" />
    </div>
  );
}

function TaskList({ weekId, dayPlan, items, onToggle }) {
  return (
    <ul className="prep-tasks">
      {dayPlan.tasks.map((task, i) => {
        const key = taskKey(weekId, dayPlan.day, i);
        const done = Boolean(items[key]?.done);
        return (
          <li key={key}>
            <label className={`prep-task${done ? ' is-done' : ''}`}>
              <input type="checkbox" checked={done} onChange={() => onToggle(key)} />
              <span className="prep-task-text">
                <Rich text={task.text} />
                {task.lc.length > 0 && (
                  <span className="prep-lc">
                    {task.lc.map((slug) => (
                      <a
                        key={slug}
                        className="prep-lc-link"
                        href={leetcodeUrl(slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open on LeetCode"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {slug.replace(/-/g, ' ')}
                        <Icon name="external" size={11} />
                      </a>
                    ))}
                  </span>
                )}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function DailyLog({ logs, update, remove, todayStr, onCopyTemplate }) {
  const [date, setDate] = useState(todayStr);
  const [topic, setTopic] = useState('');
  const [minutes, setMinutes] = useState(90);
  const [logStatus, setLogStatus] = useState('done');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteDate, setDeleteDate] = useState(null);

  const existing = logs.find((l) => l.date === date);

  const loadExisting = (d) => {
    setDate(d);
    const found = logs.find((l) => l.date === d);
    if (found) {
      setTopic(found.topic);
      setMinutes(found.minutes);
      setLogStatus(found.status);
      setNote(found.note);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!date || !topic.trim()) return;
    setSaving(true);
    try {
      const mins = Math.max(0, Math.min(1440, parseInt(minutes, 10) || 0));
      await update(`log:${date}`, { log: { topic: topic.trim(), minutes: mins, status: logStatus }, note });
      setTopic('');
      setNote('');
    } catch {
      // error surfaced by useTracker
    } finally {
      setSaving(false);
    }
  };

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoStr = toISODate(weekAgo);
  const last7 = logs.filter((l) => l.date >= weekAgoStr && l.date <= todayStr);
  const hours7 = last7.reduce((s, l) => s + (l.minutes || 0), 0) / 60;

  return (
    <section className="ui-card prep-card prep-log" aria-labelledby="prep-log-title">
      <div className="prep-card-head prep-card-head--split">
        <div className="prep-card-head-main">
          <span className="prep-icon-tile"><Icon name="checklist" size={18} /></span>
          <div className="prep-card-head-text">
            <h2 id="prep-log-title" className="prep-card-title">Daily log</h2>
            <p className="prep-muted">Log every day, even a 0-minute day, so slippage stays visible.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" icon="copy" onClick={onCopyTemplate}>Copy log template</Button>
      </div>

      <div className="prep-budget">
        <div className="prep-budget-text">
          <span className="prep-budget-value">{hours7.toFixed(1)} h</span>
          <span className="prep-muted">
            logged in the last 7 days · {last7.length} day(s) · budget {WEEKLY_BUDGET_HOURS} h
          </span>
        </div>
        <ProgressBar value={hours7} max={WEEKLY_BUDGET_HOURS} size="sm" ariaLabel="Study time this week against the budget" />
      </div>

      <form className="prep-log-form" onSubmit={submit}>
        <Field label="Date">
          {(p) => (
            <Input {...p} type="date" value={date} onChange={(e) => loadExisting(e.target.value)} required />
          )}
        </Field>
        <Field label="Topic" className="prep-log-topic">
          {(p) => (
            <Input
              {...p}
              type="text"
              placeholder="e.g. W2 Mon — Loops + LC 1342"
              value={topic}
              maxLength={300}
              onChange={(e) => setTopic(e.target.value)}
              required
            />
          )}
        </Field>
        <Field label="Minutes">
          {(p) => (
            <Input {...p} type="number" min="0" max="1440" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          )}
        </Field>
        <Field label="Status">
          {(p) => (
            <Select {...p} value={logStatus} onChange={(e) => setLogStatus(e.target.value)}>
              {Object.entries(LOG_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Notes" className="prep-log-notes">
          {(p) => (
            <Textarea
              {...p}
              placeholder="Problems (title – accepted? – minutes – hint?), blockers, first task tomorrow…"
              value={note}
              maxLength={20000}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
        <div className="prep-log-actions">
          <Button type="submit" variant="primary" disabled={saving || !topic.trim()}>
            {saving ? 'Saving…' : existing ? 'Update entry' : 'Add entry'}
          </Button>
        </div>
      </form>

      {logs.length === 0 ? (
        <EmptyState
          icon="checklist"
          title="No entries yet"
          description="Add today's entry above. A 0-minute day counts too."
        />
      ) : (
        <ul className="prep-log-list">
          {logs.map((l) => (
            <li key={l.date} className={`prep-log-row status-${l.status}`}>
              <div className="prep-log-main">
                <span className="prep-log-date">{l.date}</span>
                <span className="prep-log-topic-text">{l.topic}</span>
                <span className="prep-log-minutes">{l.minutes} min</span>
                <Badge tone={LOG_STATUS_TONE[l.status] || 'neutral'}>{LOG_STATUS_LABEL[l.status] || l.status}</Badge>
                <span className="prep-log-row-actions">
                  <IconButton icon="edit" size="sm" label={`Edit the ${l.date} entry`} onClick={() => loadExisting(l.date)} />
                  <IconButton icon="trash" size="sm" label={`Delete the ${l.date} entry`} onClick={() => setDeleteDate(l.date)} />
                </span>
              </div>
              {l.note && <p className="prep-log-note-text">{l.note}</p>}
            </li>
          ))}
        </ul>
      )}

      {deleteDate && (
        <Dialog
          open
          onClose={() => setDeleteDate(null)}
          title="Delete this entry?"
          description={<>The log for <strong>{deleteDate}</strong> will be permanently deleted.</>}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setDeleteDate(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { remove(`log:${deleteDate}`); setDeleteDate(null); }}>Delete</Button>
            </>
          )}
        />
      )}
    </section>
  );
}

export default function PrepPlan() {
  const navigate = useNavigate();
  const { items, loading, error, update, remove, clearError } = useTracker(SHEET_ID);
  const [activePhase, setActivePhase] = useState('p1');
  const [expandedWeeks, setExpandedWeeks] = useState(() => new Set(['p1-w1']));
  const [openNote, setOpenNote] = useState(null);
  const [toast, setToast] = useState(null);

  const startDate = items[SETTINGS_KEY]?.startDate || null;
  const todayStr = toISODate(new Date());
  const today = useMemo(() => parseISODate(todayStr), [todayStr]);

  const schedule = useMemo(() => {
    if (!startDate) return null;
    const start = parseISODate(startDate);
    const dayIndex = Math.floor((today - start) / DAY_MS);
    const weekNumber = dayIndex >= 0 ? Math.floor(dayIndex / 7) + 1 : 0;
    const dayName = dayIndex >= 0 ? DAY_ORDER[dayIndex % 7] : null;

    let tasksBehind = 0;
    let weeksBehind = 0;
    PREP_PLAN.forEach((phase) => {
      (phase.weeks || []).forEach((w) => {
        w.days.forEach((d) => {
          if (d.day === 'Sun') return;
          const date = addDays(start, (w.number - 1) * 7 + DAY_ORDER.indexOf(d.day));
          if (date < today) {
            d.tasks.forEach((_, i) => { if (!items[taskKey(w.id, d.day, i)]?.done) tasksBehind++; });
          }
        });
      });
      (phase.overview || []).forEach((w) => {
        const end = addDays(start, (w.number - 1) * 7 + 6);
        if (end < today && !items[`week:${w.id}`]?.done) weeksBehind++;
      });
    });
    return { start, dayIndex, weekNumber, dayName, tasksBehind, weeksBehind };
  }, [startDate, items, today]);

  const currentPhase = schedule && schedule.weekNumber > 0
    ? PREP_PLAN.find((p) => (p.weeks || p.overview).some((w) => w.number === schedule.weekNumber))
    : null;
  const currentDetailedWeek = currentPhase?.weeks?.find((w) => w.number === schedule.weekNumber);
  const currentOverviewWeek = currentPhase?.overview?.find((w) => w.number === schedule.weekNumber);
  const todayPlan = currentDetailedWeek?.days.find((d) => d.day === schedule.dayName);

  const phase = PREP_PLAN.find((p) => p.id === activePhase) ?? PREP_PLAN[0];
  const progress = phaseProgress(phase, items);
  const { label: phaseLabel, name: phaseName } = splitPhaseTitle(phase.title);
  const weeksLeft = schedule ? Math.max(0, TOTAL_WEEKS - Math.max(schedule.weekNumber - 1, 0)) : null;
  const slipping = Boolean(schedule && (schedule.tasksBehind > 5 || schedule.weeksBehind > 1));

  const hero = !schedule
    ? { tone: 'neutral', label: 'Not started', title: 'Set your start date', sub: 'Pick the Monday you begin to see this week, today’s tasks and any slippage.' }
    : schedule.weekNumber === 0
      ? { tone: 'info', label: 'Scheduled', title: `Starts ${formatShort(schedule.start)}`, sub: 'The plan begins on that Monday.' }
      : schedule.weekNumber > TOTAL_WEEKS
        ? { tone: 'success', label: 'Finished', title: 'Plan complete', sub: `All ${TOTAL_WEEKS} weeks are behind you.` }
        : { tone: 'accent', label: 'In progress', title: `Week ${schedule.weekNumber} · ${schedule.dayName}`, sub: currentPhase?.title || '' };

  const flash = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const toggleDone = (key) => update(key, { done: !items[key]?.done }).catch(() => {});

  const toggleWeek = (id) => setExpandedWeeks((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const setStart = (value) => {
    if (!value) return;
    const monday = nextMonday(value);
    update(SETTINGS_KEY, { startDate: monday })
      .then(() => { if (monday !== value) flash(`Start date moved to Monday ${monday}`); })
      .catch(() => {});
  };

  const logs = useMemo(() => Object.entries(items)
    .filter(([k, v]) => k.startsWith('log:') && v.log)
    .map(([k, v]) => ({ date: k.slice(4), ...v.log, note: v.note || '' }))
    .sort((a, b) => b.date.localeCompare(a.date)), [items]);

  const copyReplanSummary = async () => {
    const lines = [
      `SDE-2 prep status — generated ${todayStr}`,
      `Start date: ${startDate || 'not set'}`,
      schedule ? `Today: Week ${schedule.weekNumber}${schedule.dayName ? ` ${schedule.dayName}` : ''} of ${TOTAL_WEEKS}` : '',
      schedule ? `Behind: ${schedule.tasksBehind} Phase 1 tasks, ${schedule.weeksBehind} overview weeks` : '',
      '',
      'Last 14 log entries (date | topic | minutes | status | notes):',
      ...logs.slice(0, 14).map((l) => `${l.date} | ${l.topic} | ${l.minutes} | ${l.status} | ${l.note.replace(/\n/g, ' ')}`),
      '',
      'Please replan my remaining weeks with the same phase order and time budget.',
    ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '');
    const copied = await copyText(lines.join('\n'));
    flash(copied ? 'Replan summary copied' : 'Copy failed — select and copy manually', copied);
  };

  const copyLogTemplate = async () => {
    const copied = await copyText(DAILY_LOG_TEMPLATE);
    flash(copied ? 'Template copied' : 'Copy failed', copied);
  };

  return (
    <div className="page-shell">
      <PageHeader
        icon={<Icon name="target" size={20} />}
        title="SDE-2 Prep Plan"
        subtitle="Day-by-day plan with slippage tracking"
        actions={<Button variant="secondary" size="sm" icon="copy" onClick={copyReplanSummary}>Copy replan summary</Button>}
      />
      <div className="prep-page">
        {error && (
          <div className="prep-error" role="alert">
            <Icon name="alert" size={16} />
            <span>{error}</span>
            <button type="button" className="prep-error-dismiss" onClick={clearError}>Dismiss</button>
          </div>
        )}
        {toast && <Toast msg={toast.msg} ok={toast.ok} />}

        {loading ? <PlanSkeleton /> : (
          <>
            <section className="ui-card prep-card prep-hero" aria-labelledby="prep-hero-title">
              <div className="prep-hero-top">
                <div className="prep-hero-copy">
                  <Badge tone={hero.tone} dot>{hero.label}</Badge>
                  <h2 id="prep-hero-title" className="prep-hero-title">{hero.title}</h2>
                  <p className="prep-hero-sub">{hero.sub}</p>
                </div>
                <Field label="Start date (Monday)" hint="Other days snap to the next Monday.">
                  {(p) => (
                    <Input {...p} type="date" value={startDate || ''} onChange={(e) => setStart(e.target.value)} />
                  )}
                </Field>
              </div>
              <div className="prep-stats">
                <Stat label="Weeks left" value={weeksLeft} />
                <Stat label="Phase 1 tasks behind" value={schedule?.tasksBehind ?? null} alert />
                <Stat label="Overview weeks behind" value={schedule?.weeksBehind ?? null} alert />
              </div>
              {slipping && (
                <p className="prep-callout prep-callout--warning" role="status">
                  <Icon name="alert" size={16} />
                  <span>You are slipping. Log honestly, then use “Copy replan summary” and ask for a replan instead of skipping tasks.</span>
                </p>
              )}
            </section>

            {schedule && schedule.weekNumber > 0 && currentPhase && (
              <section className="ui-card prep-card prep-today" aria-labelledby="prep-today-title">
                <div className="prep-card-head">
                  <span className="prep-icon-tile"><Icon name="calendar" size={18} /></span>
                  <div className="prep-card-head-text">
                    <p className="prep-eyebrow">
                      Today · {formatShort(today)} · Week {schedule.weekNumber}
                    </p>
                    <h2 id="prep-today-title" className="prep-card-title">Today’s plan</h2>
                  </div>
                </div>
                {todayPlan ? (
                  <TaskList weekId={currentDetailedWeek.id} dayPlan={todayPlan} items={items} onToggle={toggleDone} />
                ) : currentOverviewWeek ? (
                  <>
                    <p className="prep-focus">{currentOverviewWeek.focus}</p>
                    <ul className="prep-routine">
                      {(currentPhase.template || []).map((line) => <li key={line}><Rich text={line} /></li>)}
                    </ul>
                    {currentOverviewWeek.striverSteps.length > 0 && (
                      <div>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon="book"
                          onClick={() => navigate(`/dsa-sheet?step=${currentOverviewWeek.striverSteps[0]}`)}
                        >
                          Open this week in DSA Master Sheet
                        </Button>
                      </div>
                    )}
                  </>
                ) : null}
              </section>
            )}

            <section className="ui-card prep-card prep-verdict" aria-labelledby="prep-verdict-title">
              <div className="prep-card-head">
                <span className="prep-icon-tile"><Icon name="clock" size={18} /></span>
                <h2 id="prep-verdict-title" className="prep-card-title">Is 10–12 hrs/week enough?</h2>
              </div>
              <p className="prep-verdict-answer">
                <Icon name="check" size={16} />
                <span>{VERDICT_ANSWER}</span>
              </p>
              <dl className="prep-facts">
                {VERDICT_FACTS.map((fact) => (
                  <div key={fact.label} className="prep-fact">
                    <dt>{fact.label}</dt>
                    <dd><Rich text={fact.text} /></dd>
                  </div>
                ))}
              </dl>
            </section>

            <Tabs
              ariaLabel="Plan phases"
              value={activePhase}
              onChange={setActivePhase}
              items={PREP_PLAN.map((p, i) => ({ value: p.id, label: `Phase ${i + 1}`, count: p.range }))}
              className="prep-tabs"
            />

            <section className="prep-phase" role="tabpanel" aria-label={phase.title}>
              <header className="prep-phase-head">
                <p className="prep-eyebrow">{phaseLabel} · {phase.range}</p>
                <h2 className="prep-phase-title">{phaseName}</h2>
                <div className="prep-phase-progress">
                  <span>{progress.done} of {progress.total} {progress.unit} done</span>
                  <ProgressBar value={progress.done} max={progress.total} size="sm" ariaLabel={`${phaseName} progress`} />
                </div>
              </header>

              <section className="ui-card prep-card" aria-labelledby="prep-resources-title">
                <h3 id="prep-resources-title" className="prep-h3">Resources</h3>
                <ul className="prep-resources">
                  {phase.resources.map((r) => (
                    <li key={r.label} className="prep-resource">
                      <span className="prep-resource-icon">
                        <Icon name={r.url ? 'external' : r.route ? 'arrowRight' : 'book'} size={15} />
                      </span>
                      <div className="prep-resource-body">
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noopener noreferrer">{r.label}</a>
                        ) : r.route ? (
                          <button type="button" className="prep-link-btn" onClick={() => navigate(r.route)}>{r.label}</button>
                        ) : (
                          <span>{r.label}</span>
                        )}
                        {r.note && <p className="prep-muted">{r.note}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {phase.template && (
                <section className="ui-card prep-card" aria-labelledby="prep-routine-title">
                  <h3 id="prep-routine-title" className="prep-h3">Weekly routine</h3>
                  <ul className="prep-routine">
                    {phase.template.map((line) => <li key={line}><Rich text={line} /></li>)}
                  </ul>
                </section>
              )}

              {phase.weeks && (
                <section className="ui-card ui-card--flush prep-weeks" aria-label="Weeks">
                  {phase.weeks.map((w) => {
                    const keys = weekTaskKeys(w);
                    const done = keys.filter((k) => items[k]?.done).length;
                    const open = expandedWeeks.has(w.id);
                    const noteKey = `note:${w.id}`;
                    const hasNote = Boolean(items[noteKey]?.note?.trim());
                    const isCurrent = schedule?.weekNumber === w.number;
                    return (
                      <div key={w.id} className={`prep-week${isCurrent ? ' is-current' : ''}`}>
                        <div className="prep-week-head">
                          <button
                            type="button"
                            className="prep-week-toggle"
                            aria-expanded={open}
                            aria-controls={open ? `${w.id}-body` : undefined}
                            onClick={() => toggleWeek(w.id)}
                          >
                            <Icon name="chevronRight" size={16} className={`prep-caret${open ? ' is-open' : ''}`} />
                            <span className="prep-week-badge">Week {w.number}</span>
                            <span className="prep-week-title">{w.title}</span>
                            {schedule?.start && (
                              <span className="prep-week-dates">{formatShort(addDays(schedule.start, (w.number - 1) * 7))}</span>
                            )}
                          </button>
                          <div className="prep-week-meta">
                            <ProgressBar
                              className="prep-week-bar"
                              value={done}
                              max={keys.length}
                              size="sm"
                              ariaLabel={`Week ${w.number} progress`}
                            />
                            <span className="prep-count">{done}/{keys.length}</span>
                            <IconButton
                              icon="edit"
                              size="sm"
                              label={hasNote ? `Edit week ${w.number} notes` : `Add week ${w.number} notes`}
                              className={hasNote ? 'has-note' : undefined}
                              onClick={() => setOpenNote(openNote === noteKey ? null : noteKey)}
                            />
                          </div>
                        </div>
                        {openNote === noteKey && (
                          <div className="prep-note-wrap">
                            <NoteEditor
                              title={`Week ${w.number} notes`}
                              initialValue={items[noteKey]?.note || ''}
                              placeholder="What went well, what slipped, what to revisit…"
                              onSave={(note) => update(noteKey, { note })}
                              onClose={() => setOpenNote(null)}
                            />
                          </div>
                        )}
                        {open && (
                          <div id={`${w.id}-body`} className="prep-week-body">
                            <p className="prep-goal">
                              <Icon name="target" size={15} />
                              <span><Rich text={w.goal} /></span>
                            </p>
                            {w.days.map((d) => (
                              <div key={d.day} className="prep-day">
                                <div className="prep-day-label">
                                  <span className="prep-day-name">{d.day}</span>
                                  <span className="prep-day-meta">
                                    {d.minutes ? `${d.minutes} min` : 'Rest'}
                                    {schedule?.start && ` · ${formatShort(addDays(schedule.start, (w.number - 1) * 7 + DAY_ORDER.indexOf(d.day)))}`}
                                  </span>
                                </div>
                                <TaskList weekId={w.id} dayPlan={d} items={items} onToggle={toggleDone} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}

              {phase.overview && (
                <>
                  <section className="ui-card ui-card--flush prep-weeks" aria-label="Weekly overview">
                    {phase.overview.map((w) => {
                      const key = `week:${w.id}`;
                      const noteKey = `note:${w.id}`;
                      const isDone = Boolean(items[key]?.done);
                      const hasNote = Boolean(items[noteKey]?.note?.trim());
                      const isCurrent = schedule?.weekNumber === w.number;
                      return (
                        <React.Fragment key={w.id}>
                          <div className={`prep-overview-row${isDone ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}`}>
                            <button
                              type="button"
                              className="prep-check"
                              aria-pressed={isDone}
                              aria-label={`Week ${w.number}: mark ${isDone ? 'not done' : 'done'}`}
                              onClick={() => toggleDone(key)}
                            >
                              <Icon name={isDone ? 'check' : 'circle'} size={14} />
                            </button>
                            <span className="prep-week-badge">Week {w.number}</span>
                            <span className="prep-overview-focus">{w.focus}</span>
                            {isCurrent ? <Badge tone="accent">This week</Badge> : <span />}
                            <div className="prep-row-actions">
                              {w.striverSteps.length > 0 && (
                                <IconButton
                                  icon="book"
                                  size="sm"
                                  label="Open in DSA Master Sheet"
                                  onClick={() => navigate(`/dsa-sheet?step=${w.striverSteps[0]}`)}
                                />
                              )}
                              <IconButton
                                icon="edit"
                                size="sm"
                                label={hasNote ? `Edit week ${w.number} notes` : `Add week ${w.number} notes`}
                                className={hasNote ? 'has-note' : undefined}
                                onClick={() => setOpenNote(openNote === noteKey ? null : noteKey)}
                              />
                            </div>
                          </div>
                          {openNote === noteKey && (
                            <div className="prep-note-wrap">
                              <NoteEditor
                                title={`Week ${w.number} notes`}
                                initialValue={items[noteKey]?.note || ''}
                                placeholder="Notes for this week…"
                                onSave={(note) => update(noteKey, { note })}
                                onClose={() => setOpenNote(null)}
                              />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </section>
                  <p className="prep-muted prep-note-line">
                    Full daily detail for this phase is expanded once you finish the previous phase.
                  </p>
                </>
              )}

              <section className="ui-card prep-card" aria-labelledby="prep-exit-title">
                <div className="prep-card-head">
                  <span className="prep-icon-tile"><Icon name="lock" size={18} /></span>
                  <div className="prep-card-head-text">
                    <h3 id="prep-exit-title" className="prep-card-title">Exit test</h3>
                    <p className="prep-muted">Pass every item before you start the next phase.</p>
                  </div>
                </div>
                <ul className="prep-tasks">
                  {phase.exitTest.map((text, i) => {
                    const key = `exit:${phase.id}-${i}`;
                    const done = Boolean(items[key]?.done);
                    return (
                      <li key={key}>
                        <label className={`prep-task${done ? ' is-done' : ''}`}>
                          <input type="checkbox" checked={done} onChange={() => toggleDone(key)} />
                          <span className="prep-task-text"><Rich text={text} /></span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </section>

            <DailyLog
              logs={logs}
              update={update}
              remove={remove}
              todayStr={todayStr}
              onCopyTemplate={copyLogTemplate}
            />
          </>
        )}
      </div>
    </div>
  );
}
