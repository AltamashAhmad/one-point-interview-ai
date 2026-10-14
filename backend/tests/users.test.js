process.env.GEMINI_API_KEY = 'test_key';
process.env.GROQ_API_KEY = 'test_key';
const request = require('supertest');
const express = require('express');

jest.mock('../middleware/auth', () => ({
  verifyToken: (req, res, next) => {
    req.user = { uid: 'user123' };
    next();
  }
}));

const mockUpdate = jest.fn();

jest.mock('../config/firebase', () => {
  const firestoreMock = () => ({
    collection: () => ({
      doc: () => ({ update: mockUpdate })
    })
  });
  firestoreMock.FieldValue = { serverTimestamp: jest.fn(() => 'ts') };
  return { firestore: firestoreMock };
});

jest.mock('../middleware/checkUserAccess', () => ({ getPlatformSettings: jest.fn() }));

const usersRouter = require('../routes/users');

const app = express();
app.use(express.json());
app.use('/api/users', usersRouter);

describe('PATCH /api/users/me/preferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves the theme on the signed-in profile', async () => {
    mockUpdate.mockResolvedValueOnce();
    const res = await request(app).patch('/api/users/me/preferences').send({ theme: 'light' });
    expect(res.status).toBe(200);
    expect(res.body.preferences).toEqual({ theme: 'light' });
    expect(mockUpdate).toHaveBeenCalledWith({ 'preferences.theme': 'light' });
  });

  it('rejects anything other than dark or light', async () => {
    const res = await request(app).patch('/api/users/me/preferences').send({ theme: 'neon' });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
