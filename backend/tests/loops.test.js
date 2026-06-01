process.env.GEMINI_API_KEY = 'test_key';
process.env.GROQ_API_KEY = 'test_key';
const request = require('supertest');
const express = require('express');

// Mock auth so every request is an authenticated user
jest.mock('../middleware/auth', () => ({
  verifyToken: (req, res, next) => {
    req.user = { uid: 'user123' };
    next();
  }
}));

const mockAdd = jest.fn();
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn();
const mockDocDelete = jest.fn();
const mockWhereGet = jest.fn();

jest.mock('../config/firebase', () => {
  const firestoreMock = () => ({
    collection: () => ({
      add: mockAdd,
      where: () => ({
        get: mockWhereGet
      }),
      doc: () => ({
        get: mockDocGet,
        update: mockDocUpdate,
        delete: mockDocDelete
      })
    })
  });
  firestoreMock.FieldValue = { serverTimestamp: jest.fn() };
  return { firestore: firestoreMock };
});

const loopsRouter = require('../routes/loops');

const app = express();
app.use(express.json());
app.use('/api/loops', loopsRouter);

const sampleRounds = [
  { type: 'dsa', name: 'Coding 1' },
  { type: 'systemDesign', name: 'System Design' }
];

describe('Loops API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/loops', () => {
    it('returns the user\'s loops', async () => {
      mockWhereGet.mockResolvedValueOnce({
        forEach: (cb) => {
          cb({ id: 'loop1', data: () => ({ userId: 'user123', company: 'Google' }) });
        }
      });

      const res = await request(app).get('/api/loops');
      expect(res.status).toBe(200);
      expect(res.body.loops).toHaveLength(1);
      expect(res.body.loops[0]).toEqual({ id: 'loop1', userId: 'user123', company: 'Google' });
    });
  });

  describe('POST /api/loops', () => {
    it('creates a loop and returns it with a generated id', async () => {
      mockAdd.mockResolvedValueOnce({ id: 'newLoop' });

      const res = await request(app)
        .post('/api/loops')
        .send({ company: 'Meta', level: 'L5', rounds: sampleRounds });

      expect(res.status).toBe(200);
      expect(res.body.loop.id).toBe('newLoop');
      expect(res.body.loop.company).toBe('Meta');
      expect(res.body.loop.status).toBe('in-progress');
      expect(res.body.loop.currentRoundIndex).toBe(0);
      expect(res.body.loop.rounds).toHaveLength(2);
      expect(res.body.loop.rounds[0].status).toBe('pending');
    });

    it('rejects a loop with no company', async () => {
      const res = await request(app)
        .post('/api/loops')
        .send({ rounds: sampleRounds });
      expect(res.status).toBe(400);
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it('rejects a loop with no rounds', async () => {
      const res = await request(app)
        .post('/api/loops')
        .send({ company: 'Meta' });
      expect(res.status).toBe(400);
      expect(mockAdd).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/loops/:id', () => {
    it('returns a loop owned by the user', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        id: 'loop1',
        data: () => ({ userId: 'user123', company: 'Google' })
      });
      const res = await request(app).get('/api/loops/loop1');
      expect(res.status).toBe(200);
      expect(res.body.loop.company).toBe('Google');
    });

    it('blocks access to another user\'s loop', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        id: 'loop1',
        data: () => ({ userId: 'someoneElse', company: 'Google' })
      });
      const res = await request(app).get('/api/loops/loop1');
      expect(res.status).toBe(403);
    });

    it('returns 404 for a missing loop', async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false });
      const res = await request(app).get('/api/loops/loop1');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/loops/:id/round', () => {
    it('advances to the next round when a round is passed', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        id: 'loop1',
        data: () => ({
          userId: 'user123',
          status: 'in-progress',
          currentRoundIndex: 0,
          rounds: [
            { type: 'dsa', name: 'R1', status: 'pending', score: null, sessionId: null },
            { type: 'systemDesign', name: 'R2', status: 'locked', score: null, sessionId: null }
          ]
        })
      });
      mockDocUpdate.mockResolvedValueOnce();

      const res = await request(app)
        .put('/api/loops/loop1/round')
        .send({ roundIndex: 0, status: 'passed', score: 80, sessionId: 'sess1' });

      expect(res.status).toBe(200);
      expect(res.body.loop.currentRoundIndex).toBe(1);
      expect(res.body.loop.rounds[0].status).toBe('passed');
      expect(res.body.loop.rounds[1].status).toBe('pending');
    });

    it('marks the loop failed when a round fails', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        id: 'loop1',
        data: () => ({
          userId: 'user123',
          status: 'in-progress',
          currentRoundIndex: 0,
          rounds: [{ type: 'dsa', name: 'R1', status: 'pending', score: null, sessionId: null }]
        })
      });
      mockDocUpdate.mockResolvedValueOnce();

      const res = await request(app)
        .put('/api/loops/loop1/round')
        .send({ roundIndex: 0, status: 'failed', score: 30, sessionId: 'sess1' });

      expect(res.status).toBe(200);
      expect(res.body.loop.status).toBe('failed');
    });

    it('rejects an invalid roundIndex', async () => {
      const res = await request(app)
        .put('/api/loops/loop1/round')
        .send({ roundIndex: -1 });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/loops/:id', () => {
    it('deletes a loop owned by the user', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ userId: 'user123' })
      });
      mockDocDelete.mockResolvedValueOnce();
      const res = await request(app).delete('/api/loops/loop1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('blocks deleting another user\'s loop', async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ userId: 'someoneElse' })
      });
      const res = await request(app).delete('/api/loops/loop1');
      expect(res.status).toBe(403);
      expect(mockDocDelete).not.toHaveBeenCalled();
    });
  });
});
