import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import InterviewTopBar from './InterviewTopBar';

vi.mock('../ModelSelector', () => ({ default: () => <div>Model picker</div> }));
vi.mock('../ThemeToggle', () => ({ default: () => <button type="button">Theme</button> }));

function renderBar(overrides = {}) {
  const props = {
    config: { label: 'DSA', isTutor: false },
    title: 'Two Sum',
    live: true,
    isMobile: false,
    clock: { label: '44:10', title: 'Time left', urgent: false, expired: false },
    model: { value: 'm1', onChange: vi.fn(), disabled: false },
    showCodeButton: true,
    codeDisabled: false,
    onOpenCode: vi.fn(),
    endLabel: 'End Interview',
    endBusy: false,
    endDisabled: false,
    onEnd: vi.fn(),
    newSessionDisabled: false,
    onNewSession: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
  render(<InterviewTopBar {...props} />);
  return props;
}

describe('InterviewTopBar', () => {
  it('shows the timer, model picker and session actions while a session is live', () => {
    const props = renderBar();
    expect(screen.getByRole('timer')).toHaveTextContent('44:10');
    expect(screen.getByText('Model picker')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByText('End Interview'));
    expect(props.onEnd).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTitle('Open Code Editor'));
    expect(props.onOpenCode).toHaveBeenCalledTimes(1);
  });

  it('hides session controls before a session starts', () => {
    renderBar({ live: false, clock: null });
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.queryByText('End Interview')).not.toBeInTheDocument();
    expect(screen.getByText('Two Sum')).toBeInTheDocument();
  });

  it('keeps New Session and End in the More menu on every screen size', () => {
    const props = renderBar();
    expect(screen.queryByText('New Session')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByText('New Session'));
    expect(props.onNewSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('New Session')).not.toBeInTheDocument();
  });

  it('keeps the theme switch in the More menu on phones', () => {
    renderBar({ isMobile: true, live: false, clock: null });
    expect(screen.queryByRole('button', { name: 'Theme' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('button', { name: 'Theme' })).toBeInTheDocument();
  });

  it('returns to the previous page with Back', () => {
    const props = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });
});
