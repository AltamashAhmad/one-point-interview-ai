import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AccessWall from './AccessWall';

const authState = {
  user: { displayName: 'Ada Lovelace', email: 'ada@example.com' },
  trialUsed: 3,
  trialLimit: 3,
  refreshUserProfile: vi.fn(),
};

vi.mock('../contexts/useAuth', () => ({ useAuth: () => authState }));
vi.mock('../services/api', () => ({
  submitAccessRequest: vi.fn(),
  getAccessRequestStatus: vi.fn(() => Promise.resolve({ status: 'none' })),
}));

describe('AccessWall', () => {
  it('shows the trial-complete wall with a request call to action', () => {
    render(<AccessWall />);

    expect(screen.getByText(/You've Used Your 3 Free Sessions/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request Full Access/ })).toBeInTheDocument();
  });

  it('keeps submit disabled until a purpose is chosen', () => {
    render(<AccessWall />);

    fireEvent.click(screen.getByRole('button', { name: /Request Full Access/ }));

    expect(screen.getByRole('heading', { name: 'Request Full Access' })).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Submit request' });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Preparing for job interviews/ }));
    expect(submit).toBeEnabled();
  });
});
