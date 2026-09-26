import * as api from './api';
import axios from 'axios';

const mockPost = jest.fn();
const mockGet = jest.fn();
const mockPut = jest.fn();
const mockDelete = jest.fn();

jest.mock('axios', () => {
  const instance = {
    post: (...args) => mockPost(...args),
    get: (...args) => mockGet(...args),
    put: (...args) => mockPut(...args),
    delete: (...args) => mockDelete(...args),
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => instance),
      post: instance.post,
      get: instance.get,
      put: instance.put,
      delete: instance.delete,
    },
    create: jest.fn(() => instance),
    post: instance.post,
    get: instance.get,
    put: instance.put,
    delete: instance.delete,
  };
});

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
    mockPost.mockResolvedValueOnce(mockResponse);

    const abortController = new AbortController();
    
    const response = await api.sendMessage(
      [{ role: 'user', content: 'Hi' }],
      'dsa',
      'Test User',
      'qwen/qwen3.8-27b',
      { company: 'Google', difficulty: 'HARD', language: 'python' },
      abortController.signal
    );

    expect(response).toEqual(mockResponse.data);
    expect(mockPost).toHaveBeenCalledWith(
      '/api/chat',
      {
        messages: [{ role: 'user', content: 'Hi' }],
        interviewType: 'dsa',
        userName: 'Test User',
        model: 'qwen/qwen3.8-27b',
        company: 'Google',
        difficulty: 'HARD',
        language: 'python',
        questionSeed: null
      },
      expect.objectContaining({ signal: abortController.signal })
    );
  });

  it('getHistory calls correct endpoint', async () => {
    const mockResponse = { data: { interviews: [{ id: 1 }] } };
    mockGet.mockResolvedValueOnce(mockResponse);

    const response = await api.getHistory();
    
    expect(response).toEqual(mockResponse.data.interviews);
    expect(mockGet).toHaveBeenCalledWith('/api/history', expect.any(Object));
  });

  it('generateScorecard calls correct POST endpoint', async () => {
    const mockResponse = { data: { scorecard: { score: 90 } } };
    mockPost.mockResolvedValueOnce(mockResponse);

    const response = await api.generateScorecard('interview-123');
    
    expect(response).toEqual(mockResponse.data.scorecard);
    expect(mockPost).toHaveBeenCalledWith('/api/history/interview-123/scorecard', {}, expect.any(Object));
  });
});
