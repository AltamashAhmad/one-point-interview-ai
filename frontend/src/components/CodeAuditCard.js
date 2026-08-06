import React from 'react';
import './CodeAuditCard.css';

const VERDICT_LABELS = {
  needs_clarification: 'Needs clarification',
  incorrect: 'Incorrect',
  partially_correct: 'Partially correct',
  correct_but_suboptimal: 'Correct but suboptimal',
  strong: 'Strong',
};

function ListBlock({ title, items, renderItem }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="audit-section">
      <h4>{title}</h4>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{renderItem ? renderItem(item) : item}</li>
        ))}
      </ul>
    </section>
  );
}

export default function CodeAuditCard({ audit }) {
  if (!audit) return null;

  return (
    <article className="code-audit-card">
      <div className="audit-card-header">
        <div>
          <span className="audit-eyebrow">OpenAI Code Audit</span>
          <h3>{VERDICT_LABELS[audit.verdict] || 'Code review'}</h3>
        </div>
        <span className={`audit-verdict audit-verdict-${audit.verdict || 'needs_clarification'}`}>
          {VERDICT_LABELS[audit.verdict] || audit.verdict || 'Review'}
        </span>
      </div>

      <p className="audit-summary">{audit.summary}</p>

      <div className="complexity-grid">
        <div className="complexity-tile">
          <span>Time</span>
          <strong>{audit.timeComplexity?.bigO || 'Unknown'}</strong>
          <p>{audit.timeComplexity?.explanation}</p>
        </div>
        <div className="complexity-tile">
          <span>Space</span>
          <strong>{audit.spaceComplexity?.bigO || 'Unknown'}</strong>
          <p>{audit.spaceComplexity?.explanation}</p>
        </div>
      </div>

      <ListBlock
        title="Bugs"
        items={audit.bugs}
        renderItem={(bug) => (
          <>
            <strong>{bug.severity?.toUpperCase()} · {bug.location}</strong>
            <span>{bug.issue}</span>
            <small>{bug.whyItMatters}</small>
          </>
        )}
      />

      <ListBlock
        title="Logical Vulnerabilities"
        items={audit.logicalVulnerabilities}
        renderItem={(item) => (
          <>
            <strong>{item.issue}</strong>
            <span>{item.impact}</span>
          </>
        )}
      />

      {audit.missedEdgeCases?.length > 0 && (
        <details className="audit-details" open>
          <summary>Missed Edge Cases</summary>
          <ul>
            {audit.missedEdgeCases.map((edgeCase, index) => (
              <li key={`edge-${index}`}>
                <strong>{edgeCase.case}</strong>
                <span>Expected: {edgeCase.expectedBehavior}</span>
                <small>{edgeCase.whyItCanFail}</small>
              </li>
            ))}
          </ul>
        </details>
      )}

      <ListBlock title="Efficiency Notes" items={audit.efficiencyNotes} />
      <ListBlock title="Next-Step Hints" items={audit.nextStepHints} />

      {audit.followUpQuestion && (
        <div className="audit-follow-up">
          <span>Interviewer follow-up</span>
          <p>{audit.followUpQuestion}</p>
        </div>
      )}
    </article>
  );
}
