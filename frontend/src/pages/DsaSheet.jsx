import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DSA_MASTER as SHEET, DSA_MASTER_TOTAL as SHEET_TOTAL, DIFFICULTY_LABEL, leetcodeUrl, videoSearchUrl,
} from '../services/dsaMasterSheet';
import { listSessions } from '../services/api';
import useTracker from '../hooks/useTracker';
import NoteEditor from '../components/NoteEditor';
import PageHeader from '../components/PageHeader';
import TrackerNotice from '../components/TrackerNotice';
import ModelSelector from '../components/ModelSelector';
import { Button, Dialog, Icon } from '../components/ui';
import { useModels } from '../services/modelCatalog';
import './StudySheet.css';

const SHEET_ID = 'dsa-master';
const qKey = (id) => `q:${id}`;
const secKey = (id) => `sec:${id}`;
const DIFF_CLASS = { E: 'Easy', M: 'Medium', H: 'Hard' };

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'anchor', label: 'Anchors only', icon: 'anchor' },
  { id: 'todo', label: 'Unsolved', icon: 'circle' },
  { id: 'done', label: 'Solved', icon: 'check' },
  { id: 'important', label: 'Important', icon: 'star' },
  { id: 'notes', label: 'With notes', icon: 'edit' },
];

export default function DsaSheet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tracker = useTracker(SHEET_ID);
  const { items, loading, error, update, clearError } = tracker;

  const initialStep = searchParams.get('step');
  const [expandedSteps, setExpandedSteps] = useState(() => new Set([initialStep || SHEET[0].id]));
  const [expandedSections, setExpandedSections] = useState(() => new Set());
  const [openNote, setOpenNote] = useState(null);
  const [filter, setFilter] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [search, setSearch] = useState('');
  const [practiced, setPracticed] = useState(new Set());
  const [practiceProblem, setPracticeProblem] = useState(null);
  const { defaultModelId } = useModels();
  const [chosenModelId, setChosenModelId] = useState(null);
  const selectedModelId = chosenModelId || defaultModelId;
  const [selectedLanguage, setSelectedLanguage] = useState('Java');

  useEffect(() => {
    listSessions()
      .then((sessions) => setPracticed(new Set(sessions.map((s) => s.question?.title).filter(Boolean))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!initialStep) return;
    const el = document.getElementById(`step-${initialStep}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [initialStep, loading]);

  const query = search.trim().toLowerCase();
  const filtering = filter !== 'all' || difficulty !== 'all' || query.length > 0;

  const matches = (p) => {
    const it = items[qKey(p.id)] || {};
    if (difficulty !== 'all' && p.difficulty !== difficulty) return false;
    if (query && !p.title.toLowerCase().includes(query) && !p.leetcode.includes(query)) return false;
    switch (filter) {
      case 'todo': return !it.done;
      case 'done': return !!it.done;
      case 'important': return !!it.important;
      case 'notes': return !!(it.note && it.note.trim());
      case 'anchor': return !!p.anchor;
      default: return true;
    }
  };

  // Reveal the patterns/steps a filter actually matches, without permanently locking them open —
  // once revealed, the caret still toggles normally (previously `stepOpen`/`sectionOpen` forced every
  // match open for as long as a filter was active, so clicking a caret to collapse it did nothing).
  useEffect(() => {
    if (!filtering || loading) return;
    const matchedStepIds = [];
    const matchedSectionIds = [];
    SHEET.forEach((step) => {
      let stepHasMatch = false;
      step.sections.forEach((sec) => {
        if (sec.problems.some(matches)) {
          matchedSectionIds.push(sec.id);
          stepHasMatch = true;
        }
      });
      if (stepHasMatch) matchedStepIds.push(step.id);
    });
    setExpandedSteps((prev) => new Set([...prev, ...matchedStepIds]));
    setExpandedSections((prev) => new Set([...prev, ...matchedSectionIds]));
    // Re-run only when the filter criteria change, not on every keystroke's `items` identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, difficulty, query, loading]);

  const stats = useMemo(() => {
    let done = 0, important = 0, notes = 0;
    SHEET.forEach((s) => s.sections.forEach((sec) => sec.problems.forEach((p) => {
      const it = items[qKey(p.id)];
      if (it?.done) done++;
      if (it?.important) important++;
      if (it?.note?.trim()) notes++;
    })));
    return { done, important, notes };
  }, [items]);

  const toggleSet = (setter) => (id) => setter((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleStep = toggleSet(setExpandedSteps);
  const toggleSection = toggleSet(setExpandedSections);

  const setAll = (open) => {
    setExpandedSteps(open ? new Set(SHEET.map((s) => s.id)) : new Set());
    setExpandedSections(open ? new Set(SHEET.flatMap((s) => s.sections.map((sec) => sec.id))) : new Set());
  };

  const toggleField = (key, field) => {
    const current = !!items[key]?.[field];
    update(key, { [field]: !current }).catch(() => {});
  };

  const startPractice = (type) => {
    if (!practiceProblem) return;
    navigate(`/interview/${type}`, {
      state: {
        practice: {
          questionTitle: practiceProblem.title,
          sheetId: SHEET_ID,
          problemId: practiceProblem.id,
          model: selectedModelId,
          language: selectedLanguage,
        },
      },
    });
  };

  const overallPct = Math.round((stats.done / SHEET_TOTAL) * 100);

  return (
    <div className="page-shell">
    <PageHeader
      icon={<Icon name="code" size={20} />}
      title="DSA Master Sheet"
      subtitle={`${stats.done} / ${SHEET_TOTAL} solved · ${overallPct}%`}
      backTo="/"
      backLabel="Home"
    />
    <div className="roadmap-page striver-page">

      <section className="striver-summary">
        <div className="striver-progress-row">
          <span className="striver-progress-label">{stats.done} / {SHEET_TOTAL} solved · {overallPct}%</span>
          <span className="striver-progress-meta"><Icon name="star" size={13} /> {stats.important} important · <Icon name="edit" size={13} /> {stats.notes} notes</span>
        </div>
        <div className="striver-bar"><div className="striver-bar-fill" style={{ width: `${overallPct}%` }} /></div>
        <p className="striver-desc">
          {SHEET_TOTAL} must-solve LeetCode problems, pattern by pattern, in Java.
        </p>
        <ol className="striver-steps">
          <li><span className="striver-step-num">1</span><span>Learn the pattern, then solve the <span className="striver-anchor-badge"><Icon name="anchor" size={12} /> Anchor</span> and write its Java template in <span className="striver-pill"><Icon name="book" size={12} /> notes</span>.</span></li>
          <li><span className="striver-step-num">2</span><span>Solve the rest alone — 20 min try, 40 min max before peeking at the solution, then re-code it from scratch.</span></li>
        </ol>
        <div className="striver-legend">
          <span><span className="striver-pill"><Icon name="check" size={12} /></span>Solved</span>
          <span><span className="striver-pill"><Icon name="star" size={12} /></span>Revise</span>
          <span><span className="striver-pill"><Icon name="edit" size={12} /></span>Notes</span>
          <span><span className="striver-pill"><Icon name="external" size={12} /></span>LeetCode</span>
          <span><span className="striver-pill"><Icon name="play" size={12} /></span>Video</span>
        </div>
      </section>

      <div className="striver-toolbar">
      <div className="striver-controls">
        <input
          className="striver-search"
          type="search"
          placeholder="Search problems or LeetCode slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="striver-select" aria-label="Filter by difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="all">All difficulties</option>
          {Object.entries(DIFFICULTY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="striver-expand-btns">
          <Button variant="secondary" size="sm" onClick={() => setAll(true)}>Expand all</Button>
          <Button variant="secondary" size="sm" onClick={() => setAll(false)}>Collapse all</Button>
        </div>
      </div>
      <div className="striver-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`striver-chip ${filter === f.id ? 'active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.icon && <Icon name={f.icon} size={14} />} {f.label}
          </button>
        ))}
      </div>
      </div>

      {tracker.loadFailed ? (
        <TrackerNotice tracker={tracker} />
      ) : error && (
        <button type="button" className="striver-error" onClick={clearError}><Icon name="alert" size={14} /> {error} (click to dismiss)</button>
      )}

      {loading ? (
        <div className="striver-loading">Loading your progress…</div>
      ) : (
        <div className="roadmap-content">
          {SHEET.map((step) => {
            const stepProblems = step.sections.flatMap((s) => s.problems);
            const stepDone = stepProblems.filter((p) => items[qKey(p.id)]?.done).length;
            const visibleSections = step.sections
              .map((sec) => ({ ...sec, visible: sec.problems.filter(matches) }))
              .filter((sec) => !filtering || sec.visible.length > 0);
            if (filtering && visibleSections.length === 0) return null;
            const stepOpen = expandedSteps.has(step.id);

            return (
              <section key={step.id} id={`step-${step.id}`} className="topic-section striver-step">
                <h2 className="topic-header striver-step-header">
                  <button type="button" className="striver-toggle" aria-expanded={stepOpen} onClick={() => toggleStep(step.id)}>
                    <span className={`striver-caret ${stepOpen ? 'open' : ''}`} aria-hidden="true">▶</span>
                    {step.title}
                  </button>
                  <span className="topic-progress">{stepDone} / {stepProblems.length}</span>
                </h2>

                {stepOpen && visibleSections.map((sec) => {
                  const sectionOpen = expandedSections.has(sec.id);
                  const secDone = sec.problems.filter((p) => items[qKey(p.id)]?.done).length;
                  const sectionNote = items[secKey(sec.id)]?.note || '';
                  const sectionNoteOpen = openNote === secKey(sec.id);

                  return (
                    <div key={sec.id} className="striver-section">
                      <div className="striver-section-header">
                        <button type="button" className="striver-toggle" aria-expanded={sectionOpen} onClick={() => toggleSection(sec.id)}>
                          <span className="striver-section-title">
                            <span className={`striver-caret small ${sectionOpen ? 'open' : ''}`} aria-hidden="true">▶</span>
                            {sec.title}
                          </span>
                        </button>
                        <span className="striver-section-right">
                          <button
                            className={`roadmap-action-btn striver-icon-btn ${sectionNote.trim() ? 'has-note' : ''}`}
                            title={sectionNote.trim() ? 'Edit pattern notes' : 'Add pattern notes'}
                            onClick={(e) => { e.stopPropagation(); setOpenNote(sectionNoteOpen ? null : secKey(sec.id)); }}
                          >
                            <Icon name="book" size={16} />
                          </button>
                          <span className="striver-mini-bar" style={{ '--pct': `${sec.problems.length ? Math.round((secDone / sec.problems.length) * 100) : 0}%` }} aria-hidden="true" />
                          <span className="topic-progress">{secDone} / {sec.problems.length}</span>
                        </span>
                      </div>

                      {sectionNoteOpen && (
                        <NoteEditor
                          title={`Pattern notes — ${sec.title}`}
                          initialValue={sectionNote}
                          placeholder={'Java template, how to recognise this pattern, pitfalls…\ne.g. "Lower bound template: lo=0, hi=n, while lo<hi …"'}
                          onSave={(note, source) => update(secKey(sec.id), { note, itemType: 'section', title: sec.title, noteSource: source || 'manual' })}
                          onClose={() => setOpenNote(null)}
                          sheetId={SHEET_ID}
                          itemKey={secKey(sec.id)}
                          itemType="section"
                          contextTitle={sec.title}
                          language={selectedLanguage}
                          noteSource={items[secKey(sec.id)]?.noteSource}
                        />
                      )}

                      {sectionOpen && (
                        <div className="question-list striver-question-list">
                          {(filtering ? sec.visible : sec.problems).map((p) => (
                            <ProblemRow
                              key={p.id}
                              problem={p}
                              item={items[qKey(p.id)] || {}}
                              practiced={practiced.has(p.title)}
                              noteOpen={openNote === qKey(p.id)}
                              sheetId={SHEET_ID}
                              sectionTitle={sec.title}
                              language={selectedLanguage}
                              onToggleDone={() => toggleField(qKey(p.id), 'done')}
                              onToggleImportant={() => toggleField(qKey(p.id), 'important')}
                              onToggleNote={() => setOpenNote(openNote === qKey(p.id) ? null : qKey(p.id))}
                              onSaveNote={(note, source) => update(qKey(p.id), { note, itemType: 'question', title: p.title, sectionTitle: sec.title, difficulty: p.difficulty, noteSource: source || 'manual' })}
                              onCloseNote={() => setOpenNote(null)}
                              onPractice={() => setPracticeProblem(p)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}

      {practiceProblem && (
        <Dialog open onClose={() => setPracticeProblem(null)} title={practiceProblem.title} description="Practice this problem with the AI interviewer.">
          <div className="sheet-practice-form">
            <div>
                <label className="striver-modal-label">AI Model</label>
                <ModelSelector
                  selectedModel={selectedModelId}
                  onModelChange={setChosenModelId}
                />
              </div>
              <label className="striver-modal-label">Language</label>
              <select className="striver-select full" aria-label="Language" value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)}>
                {['Java', 'Python', 'C++', 'JavaScript', 'TypeScript', 'Go', 'Rust'].map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            <div className="modal-options">
              <button className="modal-option-btn" onClick={() => startPractice('tutorDsa')}>
                <Icon name="graduation" size={18} /> Start Tutor Session
                <span>Guided step-by-step learning with visual dry runs</span>
              </button>
              <button className="modal-option-btn" onClick={() => startPractice('dsa')}>
                <Icon name="clock" size={18} /> Mock Interview
                <span>Simulated interview environment without hints</span>
              </button>
            </div>
            <Button variant="secondary" className="sheet-modal-cancel" onClick={() => setPracticeProblem(null)}>Cancel</Button>
        </Dialog>
      )}
    </div>
    </div>
  );
}

function ProblemRow({
  problem, item, practiced, noteOpen, sheetId, sectionTitle, language,
  onToggleDone, onToggleImportant, onToggleNote, onSaveNote, onCloseNote, onPractice,
}) {
  const hasNote = !!(item.note && item.note.trim());
  const link = leetcodeUrl(problem.leetcode);

  return (
    <>
      <div className={`question-item striver-row ${item.done ? 'completed' : ''} ${item.important ? 'important' : ''}`}>
        <div className="question-left">
          <button
            className="striver-check"
            title={item.done ? 'Mark as unsolved' : 'Mark as solved'}
            onClick={onToggleDone}
            aria-pressed={!!item.done}
          >
            <Icon name={item.done ? 'check' : 'circle'} size={16} />
          </button>
          <a className="question-title striver-title" href={link} target="_blank" rel="noopener noreferrer">
            {problem.title}
          </a>
          {practiced && <span className="striver-ai-badge" title="You practiced this with the AI"><Icon name="sparkles" size={12} /> AI</span>}
          {problem.anchor && <span className="striver-anchor-badge" title="Anchor: learn the pattern's template on this problem"><Icon name="anchor" size={12} /> Anchor</span>}
        </div>
        <div className="question-right">
          <span className={`difficulty-badge diff-${DIFF_CLASS[problem.difficulty]}`}>{DIFFICULTY_LABEL[problem.difficulty]}</span>
          <div className="striver-actions">
            <a
              className="roadmap-action-btn striver-icon-btn lc"
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              title={`Solve on LeetCode${problem.premium ? ' (Premium)' : ''}`}
            >
              <Icon name={problem.premium ? 'lock' : 'external'} size={16} />
            </a>
            <a
              className="roadmap-action-btn striver-icon-btn"
              href={videoSearchUrl(problem.title)}
              target="_blank"
              rel="noopener noreferrer"
              title="Find a video solution"
            >
              <Icon name="play" size={16} />
            </a>
            <button
              className={`roadmap-action-btn striver-icon-btn ${item.important ? 'active' : ''}`}
              title={item.important ? 'Unmark important' : 'Mark important'}
              onClick={onToggleImportant}
            >
              <Icon name="star" size={16} />
            </button>
            <button
              className={`roadmap-action-btn striver-icon-btn ${hasNote ? 'has-note' : ''}`}
              title={hasNote ? 'Edit note' : 'Add note'}
              onClick={onToggleNote}
            >
              <Icon name="edit" size={16} />
            </button>
            <button className="roadmap-action-btn striver-icon-btn" title="Practice with AI" onClick={onPractice}>
              <Icon name="sparkles" size={16} />
            </button>
          </div>
        </div>
      </div>
      {noteOpen && (
        <NoteEditor
          title={`Notes — ${problem.title}`}
          initialValue={item.note || ''}
          placeholder={'Approach, complexity, edge cases, mistakes…\nBrute: …\nOptimal: … O(n) time, O(1) space\nGotcha: …'}
          onSave={onSaveNote}
          onClose={onCloseNote}
          sheetId={sheetId}
          itemKey={`q:${problem.id}`}
          itemType="question"
          contextTitle={problem.title}
          difficulty={DIFFICULTY_LABEL[problem.difficulty]}
          sectionTitle={sectionTitle}
          language={language}
          noteSource={item.noteSource}
        />
      )}
    </>
  );
}
