import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DSA_MASTER as SHEET, DSA_MASTER_TOTAL as SHEET_TOTAL, DIFFICULTY_LABEL, leetcodeUrl, videoSearchUrl,
} from '../services/dsaMasterSheet';
import { getHistory } from '../services/api';
import useTracker from '../hooks/useTracker';
import NoteEditor from '../components/NoteEditor';
import ThemeToggle from '../components/ThemeToggle';
import ModelSelector, { AVAILABLE_MODELS } from '../components/ModelSelector';
import './SheetLayout.css';
import './DsaSheet.css';

const SHEET_ID = 'dsa-master';
const qKey = (id) => `q:${id}`;
const secKey = (id) => `sec:${id}`;
const DIFF_CLASS = { E: 'Easy', M: 'Medium', H: 'Hard' };

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'anchor', label: '⚓ Anchors only' },
  { id: 'todo', label: '⬜ Unsolved' },
  { id: 'done', label: '✅ Solved' },
  { id: 'important', label: '⭐ Important' },
  { id: 'notes', label: '📝 With notes' },
];

export default function DsaSheet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, loading, error, update, clearError } = useTracker(SHEET_ID);

  const initialStep = searchParams.get('step');
  const [expandedSteps, setExpandedSteps] = useState(() => new Set([initialStep || SHEET[0].id]));
  const [expandedSections, setExpandedSections] = useState(() => new Set());
  const [openNote, setOpenNote] = useState(null);
  const [filter, setFilter] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [search, setSearch] = useState('');
  const [practiced, setPracticed] = useState(new Set());
  const [practiceProblem, setPracticeProblem] = useState(null);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]);
  const [selectedLanguage, setSelectedLanguage] = useState('Java');

  useEffect(() => {
    getHistory({ isRoadmap: true })
      .then((history) => setPracticed(new Set(history.map((h) => h.questionTitle).filter(Boolean))))
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
    navigate(`/interview/${type}?isRoadmap=true`, {
      state: {
        autoStart: true,
        interviewType: type,
        questionSeed: practiceProblem.title,
        model: selectedModel.id,
        language: selectedLanguage,
        isRoadmap: true,
      },
    });
  };

  const overallPct = Math.round((stats.done / SHEET_TOTAL) * 100);

  return (
    <div className="roadmap-page striver-page">
      <header className="roadmap-header">
        <button className="back-btn" onClick={() => (window.history.length > 2 ? navigate(-1) : navigate('/'))}>← Back</button>
        <h1>DSA Master Sheet</h1>
        <ThemeToggle />
      </header>

      <section className="striver-summary">
        <div className="striver-progress-row">
          <span className="striver-progress-label">{stats.done} / {SHEET_TOTAL} solved · {overallPct}%</span>
          <span className="striver-progress-meta">⭐ {stats.important} important · 📝 {stats.notes} notes</span>
        </div>
        <div className="striver-bar"><div className="striver-bar-fill" style={{ width: `${overallPct}%` }} /></div>
        <p className="striver-hint">
          {SHEET_TOTAL} must-solve LeetCode problems, pattern by pattern, in Java. For each pattern: learn the idea → solve the ⚓ anchor and write its Java template in 📒 → solve the rest alone (20 min try, 40 min max before the solution, then re-code from scratch).
          Tick ✅ when solved, ⭐ to revise, 📝 for problem notes. 🔗 opens LeetCode, ▶️ finds a video solution.
        </p>
      </section>

      <div className="striver-controls">
        <input
          className="striver-search"
          type="search"
          placeholder="Search problems or LeetCode slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="striver-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="all">All difficulties</option>
          {Object.entries(DIFFICULTY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="striver-expand-btns">
          <button className="note-btn" onClick={() => setAll(true)}>Expand all</button>
          <button className="note-btn" onClick={() => setAll(false)}>Collapse all</button>
        </div>
      </div>
      <div className="striver-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`striver-chip ${filter === f.id ? 'active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="striver-error" onClick={clearError}>⚠️ {error} (click to dismiss)</div>
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
            const stepOpen = filtering || expandedSteps.has(step.id);

            return (
              <section key={step.id} id={`step-${step.id}`} className="topic-section striver-step">
                <h2 className="topic-header striver-step-header" onClick={() => toggleStep(step.id)}>
                  <span>
                    <span className={`striver-caret ${stepOpen ? 'open' : ''}`}>▶</span>
                    {step.title}
                  </span>
                  <span className="topic-progress">{stepDone} / {stepProblems.length}</span>
                </h2>

                {stepOpen && visibleSections.map((sec) => {
                  const sectionOpen = filtering || expandedSections.has(sec.id);
                  const secDone = sec.problems.filter((p) => items[qKey(p.id)]?.done).length;
                  const sectionNote = items[secKey(sec.id)]?.note || '';
                  const sectionNoteOpen = openNote === secKey(sec.id);

                  return (
                    <div key={sec.id} className="striver-section">
                      <div className="striver-section-header" onClick={() => toggleSection(sec.id)}>
                        <span className="striver-section-title">
                          <span className={`striver-caret small ${sectionOpen ? 'open' : ''}`}>▶</span>
                          {sec.title}
                        </span>
                        <span className="striver-section-right">
                          <button
                            className={`roadmap-action-btn striver-icon-btn ${sectionNote.trim() ? 'has-note' : ''}`}
                            title={sectionNote.trim() ? 'Edit pattern notes' : 'Add pattern notes'}
                            onClick={(e) => { e.stopPropagation(); setOpenNote(sectionNoteOpen ? null : secKey(sec.id)); }}
                          >
                            📒
                          </button>
                          <span className="topic-progress">{secDone} / {sec.problems.length}</span>
                        </span>
                      </div>

                      {sectionNoteOpen && (
                        <NoteEditor
                          title={`Pattern notes — ${sec.title}`}
                          initialValue={sectionNote}
                          placeholder={'Java template, how to recognise this pattern, pitfalls…\ne.g. "Lower bound template: lo=0, hi=n, while lo<hi …"'}
                          onSave={(note) => update(secKey(sec.id), { note })}
                          onClose={() => setOpenNote(null)}
                        />
                      )}

                      {!sectionNoteOpen && sectionNote.trim() && (
                        <div className="striver-note-preview" onClick={() => setOpenNote(secKey(sec.id))}>{sectionNote}</div>
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
                              onToggleDone={() => toggleField(qKey(p.id), 'done')}
                              onToggleImportant={() => toggleField(qKey(p.id), 'important')}
                              onToggleNote={() => setOpenNote(openNote === qKey(p.id) ? null : qKey(p.id))}
                              onSaveNote={(note) => update(qKey(p.id), { note })}
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
        <div className="modal-overlay" onClick={() => setPracticeProblem(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{practiceProblem.title}</h3>
            <p className="modal-body">Practice this problem with the AI interviewer.</p>
            <div style={{ marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ marginBottom: '15px' }}>
                <label className="striver-modal-label">AI Model</label>
                <ModelSelector
                  selectedModel={selectedModel.id}
                  onModelChange={(id) => setSelectedModel(AVAILABLE_MODELS.find((m) => m.id === id) || AVAILABLE_MODELS[0])}
                />
              </div>
              <label className="striver-modal-label">Language</label>
              <select className="striver-select full" value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)}>
                {['Java', 'Python', 'C++', 'JavaScript', 'TypeScript', 'Go', 'Rust'].map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            <div className="modal-options">
              <button className="modal-option-btn" onClick={() => startPractice('tutorDsa')}>
                🧑‍🏫 Start Tutor Session
                <span>Guided step-by-step learning with visual dry runs</span>
              </button>
              <button className="modal-option-btn" onClick={() => startPractice('dsa')}>
                ⏱️ Mock Interview
                <span>Simulated interview environment without hints</span>
              </button>
            </div>
            <button className="modal-btn--cancel" onClick={() => setPracticeProblem(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProblemRow({
  problem, item, practiced, noteOpen,
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
            {item.done ? '✅' : '⬜'}
          </button>
          <a className="question-title striver-title" href={link} target="_blank" rel="noopener noreferrer">
            {problem.title}
          </a>
          {practiced && <span className="striver-ai-badge" title="You practiced this with the AI">🤖 AI</span>}
          {problem.anchor && <span className="striver-anchor-badge" title="Anchor: learn the pattern's template on this problem">⚓ Anchor</span>}
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
              {problem.premium ? '🔒' : '🔗'}
            </a>
            <a
              className="roadmap-action-btn striver-icon-btn"
              href={videoSearchUrl(problem.title)}
              target="_blank"
              rel="noopener noreferrer"
              title="Find a video solution"
            >
              ▶️
            </a>
            <button
              className={`roadmap-action-btn striver-icon-btn ${item.important ? 'active' : ''}`}
              title={item.important ? 'Unmark important' : 'Mark important'}
              onClick={onToggleImportant}
            >
              {item.important ? '⭐' : '☆'}
            </button>
            <button
              className={`roadmap-action-btn striver-icon-btn ${hasNote ? 'has-note' : ''}`}
              title={hasNote ? 'Edit note' : 'Add note'}
              onClick={onToggleNote}
            >
              📝
            </button>
            <button className="roadmap-action-btn striver-icon-btn" title="Practice with AI" onClick={onPractice}>
              🤖
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
        />
      )}
      {!noteOpen && hasNote && (
        <div className="striver-note-preview" onClick={onToggleNote}>{item.note}</div>
      )}
    </>
  );
}
