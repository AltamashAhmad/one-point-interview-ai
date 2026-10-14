import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import PrepPlan from './PrepPlan';

const tracker = vi.hoisted(() => ({ items: {} }));

vi.mock('../hooks/useTracker', () => ({
  default: () => ({
    items: tracker.items,
    loading: false,
    error: null,
    update: vi.fn(() => Promise.resolve()),
    remove: vi.fn(),
    clearError: vi.fn(),
  }),
}));

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The Monday that started `weeks` full weeks before this week's Monday. */
function mondayWeeksBack(weeks) {
  const now = new Date();
  const sinceMonday = (now.getDay() + 6) % 7;
  return isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday - weeks * 7));
}

function renderPlan(items = {}) {
  tracker.items = items;
  return render(<MemoryRouter><PrepPlan /></MemoryRouter>);
}

describe('PrepPlan', () => {
  it('asks for a start date instead of showing empty numbers', () => {
    renderPlan();
    expect(screen.getByRole('heading', { name: 'Set your start date' })).toBeInTheDocument();
    expect(screen.getAllByText('Not set')).toHaveLength(3);
  });

  it('shows the current week and the weeks left once a start date is saved', () => {
    const dayName = DAY_NAMES[(new Date().getDay() + 6) % 7];
    renderPlan({ 'meta:settings': { startDate: mondayWeeksBack(2) } });
    expect(screen.getByRole('heading', { name: `Week 3 · ${dayName}` })).toBeInTheDocument();
    expect(screen.getByText('69')).toBeInTheDocument();
  });

  it('answers the 10–12 hour question before the detail', () => {
    renderPlan();
    expect(screen.getByText(/10–12 h\/week is enough to finish every phase properly/)).toBeInTheDocument();
  });

  it('switches phases and shows that phase\'s exit test', () => {
    renderPlan();
    fireEvent.click(screen.getByRole('tab', { name: /Phase 2/ }));
    expect(screen.getByRole('heading', { level: 2, name: /DSA: DSA Master Sheet/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Exit test' })).toBeInTheDocument();
  });

  it('shows backticks in the plan as code, not as raw symbols', () => {
    renderPlan();
    expect(screen.getByText('java -version', { selector: 'code' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('`');
  });

  it('keeps the log entry disabled until a topic is written', () => {
    renderPlan();
    expect(screen.getByRole('button', { name: 'Add entry' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Arrays' } });
    expect(screen.getByRole('button', { name: 'Add entry' })).toBeEnabled();
  });
});
