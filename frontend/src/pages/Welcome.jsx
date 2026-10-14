import React from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { Button, Icon } from '../components/ui';
import './Welcome.css';

const ROUNDS = [
  { icon: 'code', title: 'DSA', text: 'Solve a coding problem live. Arrays, trees, graphs, dynamic programming and more.' },
  { icon: 'layers', title: 'System Design', text: 'Design a real system at scale: APIs, storage, caching, availability and trade-offs.' },
  { icon: 'box', title: 'Low-Level Design', text: 'Model classes and interfaces with SOLID principles and design patterns.' },
  { icon: 'message', title: 'Behavioral', text: 'A hiring-manager round on past experience: conflict, ownership, ambiguity.' },
];

const STEPS = [
  { title: 'Pick a round', text: 'Choose the interview type, difficulty, language and a target company.' },
  { title: 'Talk it through', text: 'Answer in chat and write code in the editor while a timed AI interviewer pushes back.' },
  { title: 'Get your scorecard', text: 'A rubric-based verdict with strengths, weaknesses and what to fix next.' },
];

const LEARN = [
  { icon: 'graduation', title: 'Tutor mode', text: 'Learn step by step, from brute force to optimal. No timer, no pressure.' },
  { icon: 'book', title: 'Notes', text: 'Data structures and algorithms explained from first principles.' },
  { icon: 'checklist', title: 'DSA sheet', text: 'Must-solve problems grouped by pattern, with progress you can track.' },
  { icon: 'calendar', title: 'Prep plan', text: 'A day-by-day SDE-2 plan that shows when you are slipping.' },
];

export default function Welcome() {
  return (
    <div className="welcome-page">
      <header className="welcome-header">
        <div className="welcome-inner welcome-header__row">
          <Link to="/welcome" className="welcome-logo" aria-label="OnePoint AI home">
            <span className="welcome-logo__mark" aria-hidden="true"><Icon name="target" size={18} /></span>
            <span className="welcome-logo__text">OnePoint<span> AI</span></span>
          </Link>
          <nav className="welcome-header__actions" aria-label="Account">
            <ThemeToggle />
            <Button as={Link} to="/login" variant="ghost" size="sm" className="welcome-signin">Sign in</Button>
            <Button as={Link} to="/login" size="sm">Get started</Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="welcome-hero" aria-labelledby="welcome-title">
          <div className="welcome-inner">
            <p className="welcome-eyebrow">AI mock interviews</p>
            <h1 id="welcome-title" className="welcome-title">Crack your next FAANG interview.</h1>
            <p className="welcome-lead">
              Practice the way real loops work: timed mock rounds with an AI interviewer, a scorecard after every
              session, and a plan you can follow.
            </p>
            <div className="welcome-cta">
              <Button as={Link} to="/login" size="lg" iconRight="arrowRight">Start practicing free</Button>
              <Button as={Link} to="/login" size="lg" variant="secondary">Sign in</Button>
            </div>
          </div>
        </section>

        <section className="welcome-section" aria-labelledby="welcome-rounds">
          <div className="welcome-inner">
            <h2 id="welcome-rounds" className="welcome-h2">Four rounds, like the real loop</h2>
            <ul className="welcome-grid welcome-grid--four">
              {ROUNDS.map((round) => (
                <li key={round.title} className="welcome-card">
                  <span className="welcome-card__icon" aria-hidden="true"><Icon name={round.icon} size={20} /></span>
                  <h3 className="welcome-card__title">{round.title}</h3>
                  <p className="welcome-card__text">{round.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="welcome-section" aria-labelledby="welcome-how">
          <div className="welcome-inner">
            <h2 id="welcome-how" className="welcome-h2">How it works</h2>
            <ol className="welcome-grid welcome-grid--three welcome-steps">
              {STEPS.map((step, index) => (
                <li key={step.title} className="welcome-card">
                  <span className="welcome-step__number" aria-hidden="true">{index + 1}</span>
                  <h3 className="welcome-card__title">{step.title}</h3>
                  <p className="welcome-card__text">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="welcome-section" aria-labelledby="welcome-learn">
          <div className="welcome-inner">
            <h2 id="welcome-learn" className="welcome-h2">Prepare between rounds</h2>
            <ul className="welcome-grid welcome-grid--four">
              {LEARN.map((item) => (
                <li key={item.title} className="welcome-card">
                  <span className="welcome-card__icon" aria-hidden="true"><Icon name={item.icon} size={20} /></span>
                  <h3 className="welcome-card__title">{item.title}</h3>
                  <p className="welcome-card__text">{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="welcome-final" aria-labelledby="welcome-final-title">
          <div className="welcome-inner welcome-final__box">
            <h2 id="welcome-final-title" className="welcome-h2">Ready for your first mock round?</h2>
            <p className="welcome-lead">Create a free account and run a full interview in minutes.</p>
            <Button as={Link} to="/login" size="lg" iconRight="arrowRight">Get started free</Button>
          </div>
        </section>
      </main>

      <footer className="welcome-footer">
        <div className="welcome-inner welcome-footer__row">
          <span>&copy; {new Date().getFullYear()} OnePoint AI</span>
          <Link to="/login" className="welcome-footer__link">Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
