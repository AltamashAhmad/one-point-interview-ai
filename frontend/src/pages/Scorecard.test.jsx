import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import Scorecard from './ScorecardView';
import * as api from '../services/api';
import { ThemeProvider } from '../contexts/ThemeContext';

vi.mock('../services/api');
vi.mock('../contexts/useAuth', () => ({ useAuth: () => ({ userProfile: null }) }));

let mockParams = { id: '123' };
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => mockParams,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: '' })
}));

const renderWithTheme = (ui) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('Scorecard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { id: '123' };
  });

  it('shows loading state initially', async () => {
    // Return a promise that never resolves so it stays in loading state
    api.getSession.mockReturnValue(new Promise(() => {}));
    
    renderWithTheme(<Scorecard />);

    expect(screen.getByText(/Loading your AI Scorecard/i)).toBeInTheDocument();
  });

  it('renders scorecard when API returns data', async () => {
    const mockInterview = {
      id: '123',
      interviewType: 'dsa',
      status: 'completed',
      config: { company: 'Test Company', difficulty: 'HARD' },
      scorecard: {
        score: 85,
        verdict: 'Strong Hire',
        strengths: ['Great algorithms'],
        weaknesses: ['None'],
        problemSolving: 'Excellent',
        communication: 'Clear'
      }
    };

    api.getSession.mockResolvedValueOnce(mockInterview);

    renderWithTheme(<Scorecard />);

    await waitFor(() => {
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('Strong Hire')).toBeInTheDocument();
      expect(screen.getByText('Great algorithms')).toBeInTheDocument();
      expect(screen.getByText(/back to home/i)).toBeInTheDocument();
    });
  });

  it('shows error if interview not found', async () => {
    api.getSession.mockResolvedValueOnce(null);

    renderWithTheme(<Scorecard />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load scorecard/i)).toBeInTheDocument();
    });
  });

  it('shows error if scorecard is not available yet', async () => {
    const mockInterview = {
      id: '123',
      interviewType: 'dsa',
      status: 'completed',
      // missing scorecard
    };

    api.getSession.mockResolvedValueOnce(mockInterview);

    renderWithTheme(<Scorecard />);

    await waitFor(() => {
      expect(screen.getByText(/Scorecard is not available for this session/i)).toBeInTheDocument();
    });
  });

  it('offers to continue an interview that has not been scored', async () => {
    api.getSession.mockResolvedValueOnce({ id: '123', interviewType: 'dsa', status: 'active', scorecard: null });

    renderWithTheme(<Scorecard />);

    await waitFor(() => {
      expect(screen.getByText(/hasn't been scored yet/i)).toBeInTheDocument();
      expect(screen.getByText('Continue interview')).toBeInTheDocument();
    });
  });

  it('shows error if API throws an error', async () => {
    api.getSession.mockRejectedValueOnce(new Error('Network error'));

    renderWithTheme(<Scorecard />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load scorecard/i)).toBeInTheDocument();
    });
  });

  it('retries after a failed load', async () => {
    api.getSession
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        id: '123', interviewType: 'dsa', status: 'completed',
        scorecard: { score: 72, verdict: 'Hire', strengths: [], weaknesses: [] },
      });

    renderWithTheme(<Scorecard />);

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('72')).toBeInTheDocument();
    expect(api.getSession).toHaveBeenCalledTimes(2);
  });

  it('does not offer a retry when the scorecard simply is not ready', async () => {
    api.getSession.mockResolvedValueOnce({ id: '123', interviewType: 'dsa', status: 'completed' });

    renderWithTheme(<Scorecard />);

    await screen.findByText(/Scorecard is not available/i);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});
