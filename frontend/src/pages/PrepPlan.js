import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PREP_PLAN, TOTAL_WEEKS, DURATION_VERDICT, DAILY_LOG_TEMPLATE, DAY_ORDER, taskKey,
} from '../services/prepPlan';
import { leetcodeUrl } from '../services/dsaMasterSheet';
import useTracker from '../hooks/useTracker';
import NoteEditor from '../components/NoteEditor';
import ThemeToggle from '../components/ThemeToggle';
import './SheetLayout.css';
import './DsaSheet.css';
import './PrepPlan.css';

const SHEET_ID = 'prep-plan';
const SETTINGS_KEY = 'meta:settings';
const DAY_MS = 24 * 60 * 60 * 1000;
const LOG_STATUS_LABEL = { done: '✅ Done', partial: '🟡 Partial', 'not-done': '❌ Not done' };

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

  const flash = (msg) => {
    setToast(msg);
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
    flash((await copyText(lines.join('\n'))) ? 'Replan summary copied' : 'Copy failed — select and copy manually');
  };

  const phase = PREP_PLAN.find((p) => p.id === activePhase);

  return (
    <div className="roadmap-page striver-page prep-page">
      <header className="roadmap-header">
        <button className="back-btn" onClick={() => (window.history.length > 2 ? navigate(-1) : navigate('/'))}>← Back</button>
        <h1>SDE-2 Prep Plan</h1>
        <ThemeToggle />
      </header>

      {error && <div className="striver-error" onClick={clearError}>⚠️ {error} (click to dismiss)</div>}
      {toast && <div className="prep-toast">{toast}</div>}

      {loading ? (
        <div className="striver-loading">Loading your plan…</div>
      ) : (
        <>
          <section className="striver-summary prep-status">
            <div className="prep-status-grid">
              <div>
                <label className="prep-label" htmlFor="prep-start">Start date (Monday)</label>
                <input
                  id="prep-start"
                  className="striver-select"
                  type="date"
                  value={startDate || ''}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="prep-stat">
                <span className="prep-stat-value">
                  {!schedule ? '—' : schedule.weekNumber === 0 ? 'Not started' : schedule.weekNumber > TOTAL_WEEKS ? 'Finished' : `Week ${schedule.weekNumber} · ${schedule.dayName}`}
                </span>
                <span className="prep-stat-label">Today · {TOTAL_WEEKS} weeks total</span>
              </div>
              <div className="prep-stat">
                <span className={`prep-stat-value ${schedule?.tasksBehind ? 'behind' : ''}`}>{schedule ? schedule.tasksBehind : '—'}</span>
                <span className="prep-stat-label">Phase 1 tasks behind</span>
              </div>
              <div className="prep-stat">
                <span className={`prep-stat-value ${schedule?.weeksBehind ? 'behind' : ''}`}>{schedule ? schedule.weeksBehind : '—'}</span>
                <span className="prep-stat-label">Overview weeks behind</span>
              </div>
            </div>
            {!startDate && <p className="striver-hint">Pick the Monday you start. Other days snap to the next Monday.</p>}
            {schedule && (schedule.tasksBehind > 5 || schedule.weeksBehind > 1) && (
              <p className="prep-warning">
                You are slipping. Log honestly, then use “Copy replan summary” and ask for a replan instead of skipping tasks.
              </p>
            )}
          </section>

          {schedule && schedule.weekNumber > 0 && currentPhase && (
            <section className="striver-summary prep-today">
              <h2 className="prep-h2">📅 Today — {formatShort(today)} · {currentPhase.title}</h2>
              {todayPlan ? (
                <TaskList weekId={currentDetailedWeek.id} dayPlan={todayPlan} items={items} onToggle={toggleDone} />
              ) : currentOverviewWeek ? (
                <>
                  <p className="prep-focus">Week {currentOverviewWeek.number}: {currentOverviewWeek.focus}</p>
                  <ul className="prep-template">
                    {(currentPhase.template || []).map((line) => <li key={line}>{line}</li>)}
                  </ul>
                  {currentOverviewWeek.striverSteps.length > 0 && (
                    <button className="note-btn note-btn--primary" onClick={() => navigate(`/dsa-sheet?step=${currentOverviewWeek.striverSteps[0]}`)}>
                      Open this week in DSA Master Sheet →
                    </button>
                  )}
                </>
              ) : null}
            </section>
          )}

          <section className="striver-summary">
            <h2 className="prep-h2">⏱️ Is 10–12 hrs/week enough?</h2>
            <ul className="prep-template">
              {DURATION_VERDICT.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </section>

          <div className="striver-filters prep-tabs">
            {PREP_PLAN.map((p) => (
              <button key={p.id} className={`striver-chip ${activePhase === p.id ? 'active' : ''}`} onClick={() => setActivePhase(p.id)}>
                {p.title.split(' — ')[0]} · {p.range}
              </button>
            ))}
          </div>

          <section className="topic-section">
            <h2 className="prep-phase-title">{phase.title} <span className="topic-progress">{phase.range}</span></h2>
            <ul className="prep-resources">
              {phase.resources.map((r) => (
                <li key={r.label}>
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer">{r.label}</a>
                  ) : r.route ? (
                    <button className="striver-link-btn" onClick={() => navigate(r.route)}>{r.label} →</button>
                  ) : (
                    <span>{r.label}</span>
                  )}
                  {r.note && <span className="prep-muted"> — {r.note}</span>}
                </li>
              ))}
            </ul>

            {phase.template && (
              <>
                <h3 className="prep-h3">Weekly routine</h3>
                <ul className="prep-template">
                  {phase.template.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </>
            )}

            {phase.weeks && phase.weeks.map((w) => {
              const keys = w.days.flatMap((d) => d.tasks.map((_, i) => taskKey(w.id, d.day, i)));
              const done = keys.filter((k) => items[k]?.done).length;
              const open = expandedWeeks.has(w.id);
              const noteKey = `note:${w.id}`;
              return (
                <div key={w.id} className={`prep-week ${schedule?.weekNumber === w.number ? 'current' : ''}`}>
                  <div className="striver-section-header" onClick={() => toggleWeek(w.id)}>
                    <span className="striver-section-title">
                      <span className={`striver-caret small ${open ? 'open' : ''}`}>▶</span>
                      Week {w.number}: {w.title}
                      {schedule?.start && <span className="prep-muted prep-dates"> · {formatShort(addDays(schedule.start, (w.number - 1) * 7))}</span>}
                    </span>
                    <span className="striver-section-right">
                      <NoteButton hasNote={!!items[noteKey]?.note?.trim()} onClick={() => setOpenNote(openNote === noteKey ? null : noteKey)} />
                      <span className="topic-progress">{done} / {keys.length}</span>
                    </span>
                  </div>
                  {openNote === noteKey && (
                    <NoteEditor
                      title={`Week ${w.number} notes`}
                      initialValue={items[noteKey]?.note || ''}
                      placeholder="What went well, what slipped, what to revisit…"
                      onSave={(note) => update(noteKey, { note })}
                      onClose={() => setOpenNote(null)}
                    />
                  )}
                  {open && (
                    <div className="prep-week-body">
                      <p className="prep-goal">🎯 {w.goal}</p>
                      {w.days.map((d) => (
                        <div key={d.day} className="prep-day">
                          <div className="prep-day-head">
                            <strong>{d.day}</strong>
                            <span className="prep-muted">
                              {d.minutes ? `${d.minutes} min` : 'rest / catch-up'}
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

            {phase.overview && (
              <div className="prep-overview">
                {phase.overview.map((w) => {
                  const key = `week:${w.id}`;
                  const noteKey = `note:${w.id}`;
                  const isDone = !!items[key]?.done;
                  return (
                    <React.Fragment key={w.id}>
                      <div className={`question-item prep-overview-row ${isDone ? 'completed' : ''} ${schedule?.weekNumber === w.number ? 'current' : ''}`}>
                        <div className="question-left">
                          <button className="striver-check" onClick={() => toggleDone(key)} title={isDone ? 'Mark week not done' : 'Mark week done'}>
                            {isDone ? '✅' : '⬜'}
                          </button>
                          <span className="prep-week-num">W{w.number}</span>
                          <span className="question-title">{w.focus}</span>
                        </div>
                        <div className="striver-actions">
                          {w.striverSteps.length > 0 && (
                            <button className="roadmap-action-btn striver-icon-btn" title="Open in DSA Master Sheet" onClick={() => navigate(`/dsa-sheet?step=${w.striverSteps[0]}`)}>📚</button>
                          )}
                          <NoteButton hasNote={!!items[noteKey]?.note?.trim()} onClick={() => setOpenNote(openNote === noteKey ? null : noteKey)} />
                        </div>
                      </div>
                      {openNote === noteKey && (
                        <NoteEditor
                          title={`Week ${w.number} notes`}
                          initialValue={items[noteKey]?.note || ''}
                          placeholder="Notes for this week…"
                          onSave={(note) => update(noteKey, { note })}
                          onClose={() => setOpenNote(null)}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
                <p className="prep-muted prep-overview-hint">Full daily detail for this phase is expanded once you finish the previous phase.</p>
              </div>
            )}

            <h3 className="prep-h3">🚪 Exit test — pass all before moving on</h3>
            <div className="prep-tasks">
              {phase.exitTest.map((text, i) => {
                const key = `exit:${phase.id}-${i}`;
                return (
                  <label key={key} className={`prep-task ${items[key]?.done ? 'done' : ''}`}>
                    <input type="checkbox" checked={!!items[key]?.done} onChange={() => toggleDone(key)} />
                    <span>{text}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <DailyLog logs={logs} update={update} remove={remove} todayStr={todayStr} onCopyTemplate={async () => flash((await copyText(DAILY_LOG_TEMPLATE)) ? 'Template copied' : 'Copy failed')} onCopyReplan={copyReplanSummary} />
        </>
      )}
    </div>
  );
}

function NoteButton({ hasNote, onClick }) {
  return (
    <button
      className={`roadmap-action-btn striver-icon-btn ${hasNote ? 'has-note' : ''}`}
      title={hasNote ? 'Edit notes' : 'Add notes'}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      📝
    </button>
  );
}

function TaskList({ weekId, dayPlan, items, onToggle }) {
  return (
    <div className="prep-tasks">
      {dayPlan.tasks.map((task, i) => {
        const key = taskKey(weekId, dayPlan.day, i);
        const done = !!items[key]?.done;
        return (
          <label key={key} className={`prep-task ${done ? 'done' : ''}`}>
            <input type="checkbox" checked={done} onChange={() => onToggle(key)} />
            <span>
              {task.text}
              {task.lc.length > 0 && (
                <span className="prep-lc-links">
                  {task.lc.map((slug) => (
                    <a key={slug} href={leetcodeUrl(slug)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      {slug}
                    </a>
                  ))}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function DailyLog({ logs, update, remove, todayStr, onCopyTemplate, onCopyReplan }) {
  const [date, setDate] = useState(todayStr);
  const [topic, setTopic] = useState('');
  const [minutes, setMinutes] = useState(90);
  const [logStatus, setLogStatus] = useState('done');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

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
  const minutes7 = last7.reduce((s, l) => s + (l.minutes || 0), 0);

  return (
    <section className="topic-section prep-log">
      <div className="prep-log-head">
        <h2 className="prep-phase-title">🗒️ Daily log</h2>
        <div className="striver-expand-btns">
          <button className="note-btn" onClick={onCopyTemplate}>Copy log template</button>
          <button className="note-btn note-btn--primary" onClick={onCopyReplan}>Copy replan summary</button>
        </div>
      </div>
      <p className="prep-muted">
        Last 7 days: {(minutes7 / 60).toFixed(1)} h logged across {last7.length} day(s) · budget 10.5 h/week.
      </p>

      <form className="prep-log-form" onSubmit={submit}>
        <input className="striver-select" type="date" value={date} onChange={(e) => loadExisting(e.target.value)} required />
        <input className="striver-search" type="text" placeholder="Topic (e.g. W2 Mon — Loops + LC 1342)" value={topic} maxLength={300} onChange={(e) => setTopic(e.target.value)} required />
        <input className="striver-select prep-minutes" type="number" min="0" max="1440" value={minutes} onChange={(e) => setMinutes(e.target.value)} title="Minutes spent" />
        <select className="striver-select" value={logStatus} onChange={(e) => setLogStatus(e.target.value)}>
          {Object.entries(LOG_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <textarea
          className="note-editor-textarea prep-log-note"
          placeholder={'Problems (title – accepted? – minutes – hint?), blockers, first task tomorrow…'}
          value={note}
          maxLength={20000}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="note-btn note-btn--primary" type="submit" disabled={saving || !topic.trim()}>
          {saving ? 'Saving…' : existing ? 'Update entry' : 'Add entry'}
        </button>
      </form>

      <div className="prep-log-list">
        {logs.length === 0 && <p className="prep-muted">No entries yet. Log every day — even “0 min, not done” — so slippage is visible.</p>}
        {logs.map((l) => (
          <div key={l.date} className={`prep-log-row status-${l.status}`}>
            <div className="prep-log-row-head">
              <strong>{l.date}</strong>
              <span>{l.topic}</span>
              <span className="prep-muted">{l.minutes} min</span>
              <span>{LOG_STATUS_LABEL[l.status]}</span>
              <span className="striver-actions">
                <button className="roadmap-action-btn striver-icon-btn" title="Edit" onClick={() => loadExisting(l.date)}>✏️</button>
                <button className="roadmap-action-btn striver-icon-btn" title="Delete" onClick={() => { if (window.confirm(`Delete log for ${l.date}?`)) remove(`log:${l.date}`); }}>🗑️</button>
              </span>
            </div>
            {l.note && <div className="striver-note-preview prep-log-preview">{l.note}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}
