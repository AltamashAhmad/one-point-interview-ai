import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';
import * as api from '../services/api';

vi.mock('../services/api');
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ user: { uid: 'u1', displayName: 'Ada Lovelace' } }) }));
vi.mock('../hooks/useTracker', () => ({ default: () => ({ items: {}, loading: false, error: null }) }));
vi.mock('../components/ActiveInterviewBanner', () => ({ default: () => null }));

const mockGetLoops = vi.fn();
vi.mock('../hooks/useLoopPersist', () => ({
  useLoopPersist: () => ({
    createLoop: vi.fn(), getLoops: mockGetLoops, deleteLoop: vi.fn(), migrateLocalLoops: vi.fn().mockResolvedValue(),
  }),
}));

const renderHome = () => render(<MemoryRouter><Landing /></MemoryRouter>);
const heading = () => screen.queryByRole('heading', { name: 'Get started in three steps' });

beforeEach(() => {
  localStorage.clear();
  mockGetLoops.mockResolvedValue([]);
});

describe('Landing getting-started card', () => {
  it('shows for an account with no sessions and no loops', async () => {
    api.listSessions.mockResolvedValue([]);

    renderHome();

    expect(await screen.findByRole('heading', { name: 'Get started in three steps' })).toBeInTheDocument();
  });

  it('is hidden once the user has any session', async () => {
    api.listSessions.mockResolvedValue([{ id: 's1', status: 'completed', interviewType: 'dsa', question: { title: 'Two Sum' } }]);

    renderHome();

    await screen.findByText('Two Sum');
    expect(heading()).not.toBeInTheDocument();
  });

  it('is not shown just because the session list failed to load', async () => {
    api.listSessions.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHome();

    await waitFor(() => expect(api.listSessions).toHaveBeenCalled());
    await screen.findByRole('heading', { name: 'Practice' });
    expect(heading()).not.toBeInTheDocument();
  });

  it('is hidden for a user who already has a company loop', async () => {
    api.listSessions.mockResolvedValue([]);
    mockGetLoops.mockResolvedValue([{ id: 'l1', company: 'Acme', level: 'L4', rounds: [], status: 'in-progress' }]);

    renderHome();

    await screen.findByText('Acme');
    expect(heading()).not.toBeInTheDocument();
  });
});
