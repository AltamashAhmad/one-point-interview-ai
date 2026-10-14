import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import History from './HistoryList';
import * as api from '../services/api';
import { ThemeProvider } from '../contexts/ThemeContext';

vi.mock('../services/api');
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ userProfile: null }) }));

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams()],
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const renderWithTheme = (ui) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('History Component', () => {
  it('renders the history page header without its own Home button (the shell provides navigation)', async () => {
    api.listSessions.mockResolvedValueOnce([
      {
        id: 's1',
        interviewType: 'dsa',
        status: 'completed',
        messages: [{ role: 'user', content: 'hello' }],
      },
    ]);

    renderWithTheme(<History />);

    expect(screen.queryByRole('button', { name: /home/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Interview History/i)).toBeInTheDocument();
      expect(screen.getByText('1 session')).toBeInTheDocument();
    });
  });
});
