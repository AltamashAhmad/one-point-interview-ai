import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GettingStarted from './GettingStarted';

beforeEach(() => localStorage.clear());

describe('GettingStarted', () => {
  it('lists three steps and sends the user to the chosen one', () => {
    const onGo = vi.fn();
    render(<GettingStarted userId="u1" onGo={onGo} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /start dsa round/i }));
    fireEvent.click(screen.getByRole('button', { name: /start learning/i }));
    fireEvent.click(screen.getByRole('button', { name: /open sheet/i }));

    expect(onGo.mock.calls.map(([to]) => to)).toEqual(['/interview/dsa', '/interview/tutorDsa', '/dsa-sheet']);
  });

  it('hides when dismissed and stays hidden on the next visit for the same account', () => {
    const { unmount } = render(<GettingStarted userId="u1" onGo={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss getting started' }));
    expect(screen.queryByText('Get started in three steps')).not.toBeInTheDocument();

    unmount();
    render(<GettingStarted userId="u1" onGo={() => {}} />);
    expect(screen.queryByText('Get started in three steps')).not.toBeInTheDocument();
  });

  it('remembers dismissal per account, not per browser', () => {
    localStorage.setItem('opi_getting_started_dismissed_u1', '1');

    render(<GettingStarted userId="u2" onGo={() => {}} />);

    expect(screen.getByText('Get started in three steps')).toBeInTheDocument();
  });

  it('still hides for this visit when storage is unavailable', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<GettingStarted userId="u1" onGo={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss getting started' }));

    expect(screen.queryByText('Get started in three steps')).not.toBeInTheDocument();
    setItem.mockRestore();
  });
});
