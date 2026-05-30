import * as api from './api';
import axios from 'axios';

jest.mock('axios');

jest.mock('./firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: jest.fn().mockResolvedValue('mock-token')
    }
  }
}));

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sendMessage sends correct payload and respects AbortSignal', async () => {
    const mockResponse = { data: { reply: 'Hello' } };
    axios.post.mockResolvedValueOnce(mockResponse);

    const abortController = new AbortController();
    
    const response = await api.sendMessage(
      [{ role: 'user', content: 'Hi' }],
      'dsa',
      'Test User',
      'llama-3.1-8b-instant',
      { company: 'Google', difficulty: 'HARD', language: 'python' },
      abortController.signal
    );

    expect(response).toEqual(mockResponse.data);
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8080/api/chat',
      {
        messages: [{ role: 'user', content: 'Hi' }],
        interviewType: 'dsa',
        userName: 'Test User',
        model: 'llama-3.1-8b-instant',
        company: 'Google',
        difficulty: 'HARD',
        language: 'python'
      },
      expect.objectContaining({ signal: abortController.signal })
    );
  });

  it('getHistory calls correct endpoint', async () => {
    const mockResponse = { data: { interviews: [{ id: 1 }] } };
    axios.get.mockResolvedValueOnce(mockResponse);

    const response = await api.getHistory();
    
    expect(response).toEqual(mockResponse.data.interviews);
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8080/api/history', expect.any(Object));
  });

  it('generateScorecard calls correct POST endpoint', async () => {
    const mockResponse = { data: { scorecard: { score: 90 } } };
    axios.post.mockResolvedValueOnce(mockResponse);

    const response = await api.generateScorecard('interview-123');
    
    expect(response).toEqual(mockResponse.data.scorecard);
    expect(axios.post).toHaveBeenCalledWith('http://localhost:8080/api/history/interview-123/scorecard', {}, expect.any(Object));
  });
});
