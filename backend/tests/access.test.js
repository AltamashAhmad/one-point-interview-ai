process.env.GEMINI_API_KEY = 'test_key';
process.env.GROQ_API_KEY = 'test_key';
const request = require('supertest');
const express = require('express');

jest.mock('../middleware/auth', () => ({
  verifyToken: (req, res, next) => { req.user = { uid: 'user123', email: 'u@example.com' }; next(); },
}));
jest.mock('../middleware/checkUserAccess', () => ({ enforceGlobalStatus: (req, res, next) => next() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const mockSendEmail = jest.fn().mockResolvedValue();
jest.mock('../services/emailService', () => ({ sendAccessRequestEmail: (...args) => mockSendEmail(...args) }));

const mockAdd = jest.fn().mockResolvedValue({ id: 'req1' });
const mockUpdate = jest.fn().mockResolvedValue();
let mockPendingExists = false;

jest.mock('../config/firebase', () => {
  const firestore = () => ({
    collection: (name) => {
      if (name === 'users') {
        return { doc: () => ({ get: async () => ({ exists: true, data: () => ({ status: 'PENDING', email: 'u@example.com', displayName: 'U' }) }), update: (...a) => mockUpdate(...a) }) };
      }
      const query = { where: () => query, limit: () => query, get: async () => ({ empty: !mockPendingExists, docs: mockPendingExists ? [{ id: 'old', data: () => ({ status: 'pending' }) }] : [] }), add: (...a) => mockAdd(...a) };
      return query;
    },
  });
  firestore.FieldValue = { serverTimestamp: () => 'ts' };
  return { firestore };
});

const accessRouter = require('../routes/access');

const app = express();
app.use(express.json());
app.use('/api/access', accessRouter);
app.use((err, req, res, next) => res.status(500).json({ error: err.message }));

beforeEach(() => { jest.clearAllMocks(); mockPendingExists = false; });

describe('POST /api/access/request', () => {
  it('stores a trimmed request and emails the admin', async () => {
    const res = await request(app).post('/api/access/request').send({ purpose: 'learning', reason: '  please  ' });

    expect(res.status).toBe(201);
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'learning', reason: 'please', status: 'pending' }));
    expect(mockSendEmail).toHaveBeenCalled();
  });

  it('rejects a reason that is not text with 400 instead of crashing', async () => {
    const res = await request(app).post('/api/access/request').send({ purpose: 'learning', reason: { a: 1 } });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be text/);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('rejects a reason longer than 500 characters', async () => {
    const res = await request(app).post('/api/access/request').send({ purpose: 'learning', reason: 'x'.repeat(501) });

    expect(res.status).toBe(400);
  });

  it('rejects an unknown purpose and a missing body', async () => {
    const unknown = await request(app).post('/api/access/request').send({ purpose: 'spam' });
    const missing = await request(app).post('/api/access/request');

    expect(unknown.status).toBe(400);
    expect(missing.status).toBe(400);
  });

  it('refuses a second pending request', async () => {
    mockPendingExists = true;

    const res = await request(app).post('/api/access/request').send({ purpose: 'learning' });

    expect(res.status).toBe(409);
    expect(mockAdd).not.toHaveBeenCalled();
  });
});
