import * as api from './api';

const mockPost = vi.fn();
const mockGet = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('axios', () => {
  const instance = {
    post: (...args) => mockPost(...args),
    get: (...args) => mockGet(...args),
    put: (...args) => mockPut(...args),
    patch: (...args) => mockPut(...args),
    delete: (...args) => mockDelete(...args),
  };
  return {
    __esModule: true,
    default: {
      create: vi.fn(() => instance),
      post: instance.post,
      get: instance.get,
      put: instance.put,
      delete: instance.delete,
    },
    create: vi.fn(() => instance),
    post: instance.post,
    get: instance.get,
    put: instance.put,
    delete: instance.delete,
  };
});

vi.mock('./firebase', () => ({
  appCheck: null,
  auth: {
    currentUser: {
      getIdToken: () => Promise.resolve('mock-token'),
    },
  },
}));

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createSession posts the session request and returns the session', async () => {
    mockPost.mockResolvedValueOnce({ data: { session: { id: 's1', status: 'active' } } });

    const payload = { interviewType: 'dsa', config: { company: 'Google', difficulty: 'HARD', language: 'Java' } };
    const session = await api.createSession(payload);

    expect(session).toEqual({ id: 's1', status: 'active' });
    expect(mockPost).toHaveBeenCalledWith('/api/sessions', payload, expect.objectContaining({
      headers: expect.any(Object),
    }));
  });

  it('listSessions drops empty filters', async () => {
    mockGet.mockResolvedValueOnce({ data: { sessions: [{ id: 1 }] } });

    const sessions = await api.listSessions({ status: 'active', interviewType: 'dsa', question: undefined, loopId: '' });

    expect(sessions).toEqual([{ id: 1 }]);
    expect(mockGet).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({ params: { status: 'active', interviewType: 'dsa' } }));
  });

  it('endSession posts to the end endpoint and returns the scored session', async () => {
    mockPost.mockResolvedValueOnce({ data: { session: { id: 's1', scorecard: { score: 90 } } } });

    const session = await api.endSession('s1', 'openai/gpt-oss-120b');

    expect(session.scorecard.score).toBe(90);
    expect(mockPost).toHaveBeenCalledWith('/api/sessions/s1/end', { scorecardModel: 'openai/gpt-oss-120b' }, expect.any(Object));
  });
});
