import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { PROVIDER_ICON, useModels } from '../../services/modelCatalog';
import { getCompanyList } from '../../services/api';
import { Button, Card, Field, Icon, IconButton, Input, SegmentedControl, Select } from '../ui';
import './InterviewSetup.css';

const SCORECARD_PREFERRED_MODEL = 'openai/gpt-oss-120b';
const MAX_SUGGESTIONS = 8;

const LANGUAGES = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Kotlin', 'Swift',
];

const DIFFICULTIES = [
  { value: 'ANY', label: 'Any', hint: 'Surprise me' },
  { value: 'EASY', label: 'Easy', hint: 'Warm-up round' },
  { value: 'MEDIUM', label: 'Medium', hint: 'Real interview' },
  { value: 'HARD', label: 'Hard', hint: 'Stretch goal' },
];

const SETUP_COPY = {
  dsa: "We'll pick a real question from 8,177 company-tagged LeetCode problems.",
  systemDesign: "You'll get a classic design problem (URL shortener, chat, payments…) with real requirements and scale numbers to reason about.",
  lld: "You'll get a classic object-oriented design problem (parking lot, Splitwise, rate limiter…) to model with classes and patterns.",
  managerial: 'A behavioral round about real past experiences. Answer with specific examples (situation, your actions, the result).',
};
const TUTOR_COPY = 'Pick a level. The tutor will teach you a problem step by step. No timer and no score, so ask anything.';

/** Radio list of AI models. Native radios keep arrow-key and screen-reader behaviour. */
function ModelList({ name, label, models, value, onChange, showStats = true }) {
  return (
    <div className="model-list" role="radiogroup" aria-label={label}>
      {models.map((m) => {
        const selected = m.id === value;
        return (
          <label key={m.id} className={`model-row${selected ? ' is-selected' : ''}`}>
            <input
              type="radio"
              className="model-row__input"
              name={name}
              value={m.id}
              checked={selected}
              onChange={() => onChange(m.id)}
            />
            <span className="model-row__icon" aria-hidden="true"><Icon name={PROVIDER_ICON[m.provider] || 'sparkles'} size={16} /></span>
            <span className="model-row__main">
              <span className="model-row__name">
                {m.name}
                {m.badge && (
                  <span className="model-row__badge" style={{ color: `color-mix(in srgb, ${m.badgeColor} 40%, var(--text-primary))`, background: `${m.badgeColor}22` }}>{m.badge}</span>
                )}
              </span>
              <span className="model-row__desc">{m.description}</span>
            </span>
            {showStats && <span className="model-row__stats">{m.rpm} RPM · {m.rpd} RPD</span>}
            {selected && <Icon name="check" size={16} className="model-row__check" />}
          </label>
        );
      })}
    </div>
  );
}

export default function InterviewSetup({ interviewType, typeConfig, onBegin }) {
  const isTutor = typeConfig?.isTutor || false;
  const isBehavioral = interviewType === 'managerial';
  const isShowingCompanyForType = (interviewType === 'dsa' || isBehavioral) && !isTutor;
  const { models: AVAILABLE_MODELS, defaultModelId } = useModels();
  const preferredScorecard = AVAILABLE_MODELS.some((m) => m.id === SCORECARD_PREFERRED_MODEL) ? SCORECARD_PREFERRED_MODEL : defaultModelId;

  const [selectedModel, setSelectedModel] = useState(defaultModelId);
  const [scorecardModel, setScorecardModel] = useState(preferredScorecard);
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [language, setLanguage] = useState('Java');
  const [company, setCompany] = useState('');
  const [allCompanies, setAllCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const modelTouchedRef = useRef(false);
  const scorecardModelTouchedRef = useRef(false);
  const companyInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const listId = useId();

  // The catalogue starts from a bundled model list and is replaced by the live one a moment later.
  useEffect(() => {
    if (!modelTouchedRef.current) setSelectedModel(defaultModelId);
    if (!scorecardModelTouchedRef.current) setScorecardModel(preferredScorecard);
  }, [defaultModelId, preferredScorecard]);

  useEffect(() => {
    getCompanyList()
      .then((list) => setAllCompanies(list))
      .catch(() => setAllCompanies([]))
      .finally(() => setLoadingCompanies(false));
  }, []);

  const suggestions = useMemo(() => {
    const query = company.trim().toLowerCase();
    if (!query) return [];
    return allCompanies.filter((c) => c.name.toLowerCase().includes(query)).slice(0, MAX_SUGGESTIONS);
  }, [company, allCompanies]);
  const listOpen = suggestionsOpen && suggestions.length > 0;

  useEffect(() => {
    function closeOnOutsideClick(e) {
      if (companyInputRef.current?.contains(e.target) || suggestionsRef.current?.contains(e.target)) return;
      setSuggestionsOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const pickCompany = (name) => {
    setCompany(name);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
    companyInputRef.current?.blur();
  };

  const clearCompany = () => {
    setCompany('');
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  };

  const onCompanyKeyDown = (e) => {
    if (e.key === 'Escape') { setSuggestionsOpen(false); return; }
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestionsOpen(true);
      const down = e.key === 'ArrowDown';
      const last = suggestions.length - 1;
      setActiveSuggestion((i) => {
        if (i < 0) return down ? 0 : last;
        return down ? (i >= last ? 0 : i + 1) : (i <= 0 ? last : i - 1);
      });
    } else if (e.key === 'Enter' && listOpen && activeSuggestion >= 0) {
      e.preventDefault();
      pickCompany(suggestions[activeSuggestion].name);
    }
  };

  const handleBegin = () => {
    onBegin({
      model: selectedModel,
      scorecardModel: isTutor ? null : scorecardModel,
      difficulty: isBehavioral ? 'ANY' : difficulty,
      language: isBehavioral ? null : language,
      company: company.trim(),
    });
  };

  const summary = [
    typeConfig.fullName,
    isShowingCompanyForType && company ? company : null,
    !isBehavioral ? DIFFICULTIES.find((d) => d.value === difficulty)?.label : null,
    !isBehavioral ? language : null,
    AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.name,
  ].filter(Boolean);

  return (
    <div className="setup">
      <div className="setup-scroll">
        <div className="setup-inner">
          <header className="setup-hero">
            <span className="setup-hero__icon" aria-hidden="true"><Icon name={typeConfig.icon} size={28} /></span>
            <div>
              <h1 className="setup-title">{isTutor ? 'Set up your lesson' : 'Configure your interview'}</h1>
              <p className="setup-subtitle">{isTutor ? TUTOR_COPY : SETUP_COPY[interviewType]}</p>
            </div>
          </header>

          {isShowingCompanyForType && (
            <Card
              titleAs="h2"
              title="Target company"
              description={isBehavioral
                ? "The interviewer will lean on that company's values and culture."
                : "We'll pick questions frequently asked there."}
            >
              <Field
                label="Company"
                hint={isBehavioral
                  ? 'Optional. Leave blank for a general behavioral round.'
                  : 'Leave blank for a random question from any company.'}
              >
                {(props) => (
                  <div className="company-field">
                    <Input
                      {...props}
                      ref={companyInputRef}
                      role="combobox"
                      aria-expanded={listOpen}
                      aria-controls={listId}
                      aria-autocomplete="list"
                      aria-activedescendant={listOpen && activeSuggestion >= 0 ? `${listId}-${activeSuggestion}` : undefined}
                      placeholder={loadingCompanies ? 'Loading companies…' : 'e.g. Google, Amazon, Meta'}
                      value={company}
                      onChange={(e) => { setCompany(e.target.value); setSuggestionsOpen(true); setActiveSuggestion(-1); }}
                      onFocus={() => setSuggestionsOpen(true)}
                      onKeyDown={onCompanyKeyDown}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {company && (
                      <IconButton icon="x" label="Clear company" size="sm" className="company-clear" onClick={clearCompany} />
                    )}
                    {listOpen && (
                      <ul id={listId} role="listbox" aria-label="Matching companies" className="company-list" ref={suggestionsRef}>
                        {suggestions.map((c, i) => (
                          <li
                            key={c.slug}
                            id={`${listId}-${i}`}
                            role="option"
                            aria-selected={i === activeSuggestion}
                            className="company-option"
                            onMouseDown={() => pickCompany(c.name)}
                          >
                            <span>{c.name}</span>
                            <span className="company-option__count">{c.questionCount} Qs</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Field>
            </Card>
          )}

          {!isBehavioral && (
            <Card titleAs="h2" title="Difficulty" description="Choose your challenge level.">
              <SegmentedControl
                ariaLabel="Difficulty"
                className="setup-segmented"
                value={difficulty}
                onChange={setDifficulty}
                options={DIFFICULTIES.map(({ value, label }) => ({ value, label }))}
              />
              <p className="setup-hint">{DIFFICULTIES.find((d) => d.value === difficulty)?.hint}</p>
            </Card>
          )}

          {!isBehavioral && (
            <Card
              titleAs="h2"
              title="Preferred language"
              description={isTutor
                ? 'Examples and code will be shown in this language.'
                : interviewType === 'systemDesign'
                  ? 'Only used if you sketch code (APIs, data models, snippets).'
                  : 'The interviewer will evaluate your code in this language.'}
            >
              <Select aria-label="Preferred language" className="setup-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
              </Select>
            </Card>
          )}

          <Card titleAs="h2" title="AI model" description="Choose speed vs quality. You can switch mid-interview for free.">
            <ModelList
              name="interview-model"
              label="AI model"
              models={AVAILABLE_MODELS}
              value={selectedModel}
              onChange={(id) => { modelTouchedRef.current = true; setSelectedModel(id); }}
            />
          </Card>

          {!isTutor && (
            <Card
              titleAs="h2"
              title="Scorecard evaluator"
              description="The AI that grades your performance at the end. GPT-OSS 120B is recommended."
            >
              <ModelList
                name="scorecard-model"
                label="Scorecard evaluator model"
                models={AVAILABLE_MODELS}
                value={scorecardModel}
                showStats={false}
                onChange={(id) => { scorecardModelTouchedRef.current = true; setScorecardModel(id); }}
              />
            </Card>
          )}
        </div>
      </div>

      <footer className="setup-footer">
        <div className="setup-summary">
          {summary.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="setup-summary__sep" aria-hidden="true">·</span>}
              <span className={i === 0 ? 'setup-summary__type' : undefined}>{item}</span>
            </React.Fragment>
          ))}
        </div>
        <Button size="lg" onClick={handleBegin}>{isTutor ? 'Start learning' : 'Begin interview'}</Button>
      </footer>
    </div>
  );
}
