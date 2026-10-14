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
  enforceGlobalStatus: (req, res, next) => { req.userProfile = { role: 'user' }; next(); }
}));

jest.mock('../services/ai/gateway', () => ({ generateText: jest.fn() }));
const { generateText } = require('../services/ai/gateway');

const mockWhereGet = jest.fn();
const mockDocSet = jest.fn();
const mockDocDelete = jest.fn();
const mockDocId = jest.fn();
const mockTxGet = jest.fn();
const mockTxSet = jest.fn();

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
    }),
    runTransaction: (fn) => fn({ get: mockTxGet, set: mockTxSet })
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

  it('stores denormalized note context so the record is self-describing', async () => {
    mockDocSet.mockResolvedValueOnce();
    const res = await request(app)
      .put('/api/tracker/dsa-master/items/q:two-sum')
      .send({ note: 'use a hashmap', itemType: 'question', title: 'Two Sum', sectionTitle: '1.1 Hashing', noteSource: 'manual' });

    expect(res.status).toBe(200);
    const [written] = mockDocSet.mock.calls[0];
    expect(written).toMatchObject({ itemType: 'question', title: 'Two Sum', sectionTitle: '1.1 Hashing', noteSource: 'manual' });
  });

  it('rejects an invalid noteSource', async () => {
    const res = await request(app)
      .put('/api/tracker/dsa-master/items/q:two-sum')
      .send({ noteSource: 'robot' });
    expect(res.status).toBe(400);
    expect(mockDocSet).not.toHaveBeenCalled();
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

describe('Reading progress (study-notes)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTxGet.mockResolvedValue({ exists: false, data: () => ({}) });
  });

  it('saves progress for a study notes topic', async () => {
    const res = await request(app).put('/api/tracker/study-notes/items/big-o').send({ progress: 50 });
    expect(res.status).toBe(200);
    expect(res.body.item).toEqual({ progress: 50 });
    expect(mockTxSet.mock.calls[0][1]).toMatchObject({ progress: 50, sheetId: 'study-notes', itemKey: 'big-o' });
  });

  it('never lowers saved progress', async () => {
    mockTxGet.mockResolvedValueOnce({ exists: true, data: () => ({ progress: 80 }) });
    const res = await request(app).put('/api/tracker/study-notes/items/big-o').send({ progress: 40 });
    expect(res.status).toBe(200);
    expect(res.body.item).toEqual({ progress: 80 });
    expect(mockTxSet.mock.calls[0][1]).toMatchObject({ progress: 80 });
  });

  it('rejects progress outside 0 to 100', async () => {
    const res = await request(app).put('/api/tracker/study-notes/items/big-o').send({ progress: 120 });
    expect(res.status).toBe(400);
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it('lists study notes items with their progress', async () => {
    mockWhereGet.mockResolvedValueOnce({
      forEach: (cb) => cb({ data: () => ({ sheetId: 'study-notes', itemKey: 'big-o', progress: 90 }) })
    });
    const res = await request(app).get('/api/tracker/study-notes');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual({ 'big-o': { progress: 90 } });
  });
});

describe('POST /api/tracker/:sheetId/items/:itemKey/notes/generate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('generates pseudocode-only notes for a question without saving anything', async () => {
    generateText.mockResolvedValueOnce({ text: '### 🔑 Pattern Recognition\n...' });
    const res = await request(app)
      .post('/api/tracker/dsa-master/items/q:two-sum/notes/generate')
      .send({ itemType: 'question', title: 'Two Sum', difficulty: 'E', sectionTitle: '1.1 Hashing', language: 'Java' });

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('### 🔑 Pattern Recognition\n...');
    expect(mockDocSet).not.toHaveBeenCalled();
    const call = generateText.mock.calls[0][0];
    expect(call.purpose).toBe('notes');
    expect(call.systemPrompt).toMatch(/Two Sum/);
    expect(call.systemPrompt).toMatch(/pseudocode/i);
  });

  it('generates a pattern playbook for a section', async () => {
    generateText.mockResolvedValueOnce({ text: 'playbook' });
    const res = await request(app)
      .post('/api/tracker/dsa-master/items/sec:m1-l1/notes/generate')
      .send({ itemType: 'section', title: '1.1 Hashing' });

    expect(res.status).toBe(200);
    expect(generateText.mock.calls[0][0].systemPrompt).toMatch(/pattern playbook|Generic Template/i);
  });

  it('rejects a missing title or itemType', async () => {
    expect((await request(app).post('/api/tracker/dsa-master/items/q:x/notes/generate').send({ itemType: 'question' })).status).toBe(400);
    expect((await request(app).post('/api/tracker/dsa-master/items/q:x/notes/generate').send({ itemType: 'bogus', title: 'X' })).status).toBe(400);
    expect(generateText).not.toHaveBeenCalled();
  });

  it('rejects unknown sheets and bad item keys', async () => {
    expect((await request(app).post('/api/tracker/nope/items/q:x/notes/generate').send({ itemType: 'question', title: 'X' })).status).toBe(400);
    expect((await request(app).post('/api/tracker/dsa-master/items/bad.key/notes/generate').send({ itemType: 'question', title: 'X' })).status).toBe(400);
  });
});
