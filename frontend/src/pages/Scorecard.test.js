import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, act } from '@testing-library/react';
import Scorecard from './Scorecard';
import * as api from '../services/api';

jest.mock('../services/api');

let mockParams = { id: '123' };
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useParams: () => mockParams,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: '' })
}), { virtual: true });

describe('Scorecard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: '123' };
  });

  it('shows loading state initially', async () => {
    // Return a promise that never resolves so it stays in loading state
    api.getHistoryById.mockReturnValue(new Promise(() => {}));
    
    render(<Scorecard />);

    expect(screen.getByText(/Loading your AI Scorecard/i)).toBeInTheDocument();
  });

  it('renders scorecard when API returns data', async () => {
    const mockInterview = {
      id: '123',
      interviewType: 'dsa',
      company: 'Test Company',
      difficulty: 'HARD',
      scorecard: {
        score: 85,
        verdict: 'Strong Hire',
        strengths: ['Great algorithms'],
        weaknesses: ['None'],
        problemSolving: 'Excellent',
        communication: 'Clear'
      }
    };

    api.getHistoryById.mockResolvedValueOnce(mockInterview);

    render(<Scorecard />);

    await waitFor(() => {
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('Strong Hire')).toBeInTheDocument();
      expect(screen.getByText('Great algorithms')).toBeInTheDocument();
    });
  });

  it('shows error if interview not found', async () => {
    api.getHistoryById.mockResolvedValueOnce(null);

    render(<Scorecard />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load scorecard/i)).toBeInTheDocument();
    });
  });

  it('shows error if scorecard is not available yet', async () => {
    const mockInterview = {
      id: '123',
      interviewType: 'dsa',
      // missing scorecard
    };

    api.getHistoryById.mockResolvedValueOnce(mockInterview);

    render(<Scorecard />);

    await waitFor(() => {
      expect(screen.getByText(/Scorecard is not available for this session/i)).toBeInTheDocument();
    });
  });

  it('shows error if API throws an error', async () => {
    api.getHistoryById.mockRejectedValueOnce(new Error('Network error'));

    render(<Scorecard />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load scorecard/i)).toBeInTheDocument();
    });
  });
});
