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

jest.mock('../middleware/checkUserAccess', () => ({
  enforceGlobalStatus: (req, res, next) => next()
}));

const mockWhereGet = jest.fn();
const mockDocSet = jest.fn();
const mockDocDelete = jest.fn();
const mockDocId = jest.fn();

jest.mock('../config/firebase', () => {
  const trackerCol = {
    where: () => ({ get: mockWhereGet }),
    doc: (id) => {
      mockDocId(id);
      return { set: mockDocSet, delete: mockDocDelete };
    }
  };
  const firestoreMock = () => ({
    collection: () => ({
      doc: () => ({ collection: () => trackerCol })
    })
  });
  firestoreMock.FieldValue = { serverTimestamp: jest.fn(() => 'ts') };
  return { firestore: firestoreMock };
});

const trackerRouter = require('../routes/tracker');

const app = express();
app.use(express.json());
app.use('/api/tracker', trackerRouter);

describe('Tracker API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns items keyed by itemKey without internal fields', async () => {
    mockWhereGet.mockResolvedValueOnce({
      forEach: (cb) => {
        cb({ data: () => ({ sheetId: 'dsa-master', itemKey: 'q:two-sum', done: true, note: 'hash map', updatedAt: 'x' }) });
      }
    });

    const res = await request(app).get('/api/tracker/dsa-master');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual({ 'q:two-sum': { done: true, note: 'hash map' } });
  });

  it('rejects unknown sheets', async () => {
    const res = await request(app).get('/api/tracker/unknown');
    expect(res.status).toBe(400);
  });

  it('upserts a whitelisted patch with merge', async () => {
    mockDocSet.mockResolvedValueOnce();
    const res = await request(app)
      .put('/api/tracker/dsa-master/items/q:two-sum')
      .send({ important: true, note: 'revise', role: 'admin' });

    expect(res.status).toBe(200);
    expect(mockDocId).toHaveBeenCalledWith('dsa-master__q:two-sum');
    const [written, opts] = mockDocSet.mock.calls[0];
    expect(written).toEqual({ important: true, note: 'revise', sheetId: 'dsa-master', itemKey: 'q:two-sum', updatedAt: 'ts' });
    expect(opts).toEqual({ merge: true });
  });

  it('validates field types', async () => {
    const res = await request(app)
      .put('/api/tracker/dsa-master/items/q:two-sum')
      .send({ done: 'yes' });
    expect(res.status).toBe(400);
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it('rejects oversized notes', async () => {
    const res = await request(app)
      .put('/api/tracker/dsa-master/items/q:two-sum')
      .send({ note: 'a'.repeat(20001) });
    expect(res.status).toBe(400);
  });

  it('rejects item keys with path characters', async () => {
    const res = await request(app)
      .put('/api/tracker/prep-plan/items/bad.key')
      .send({ done: true });
    expect(res.status).toBe(400);
  });

  it('validates daily log entries', async () => {
    mockDocSet.mockResolvedValueOnce();
    const ok = await request(app)
      .put('/api/tracker/prep-plan/items/log:2026-09-28')
      .send({ log: { topic: 'Java loops', minutes: 90, status: 'done' }, note: 'ok' });
    expect(ok.status).toBe(200);

    const bad = await request(app)
      .put('/api/tracker/prep-plan/items/log:2026-09-28')
      .send({ log: { topic: 'Java loops', minutes: -5, status: 'done' } });
    expect(bad.status).toBe(400);
  });

  it('deletes an item', async () => {
    mockDocDelete.mockResolvedValueOnce();
    const res = await request(app).delete('/api/tracker/prep-plan/items/log:2026-09-28');
    expect(res.status).toBe(200);
    expect(mockDocId).toHaveBeenCalledWith('prep-plan__log:2026-09-28');
  });
});
