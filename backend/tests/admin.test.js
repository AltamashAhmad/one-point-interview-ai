process.env.GEMINI_API_KEY = 'test_key';
process.env.GROQ_API_KEY = 'test_key';
const request = require('supertest');
const express = require('express');
const { searchTokens } = require('../services/userSearch');

jest.mock('../middleware/auth', () => ({
  verifyToken: (req, res, next) => { req.user = { uid: 'admin1' }; next(); },
  forgetVerifiedUser: jest.fn(),
}));
jest.mock('../middleware/requireAdmin', () => ({ requireAdmin: (req, res, next) => next() }));
jest.mock('../middleware/checkUserAccess', () => ({ evictCache: jest.fn(), invalidatePlatformSettings: jest.fn() }));
jest.mock('../services/emailService', () => ({
  sendApprovalEmail: jest.fn(),
  sendDenialEmail: jest.fn(),
  sendSuspensionEmail: jest.fn(),
}));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

// In-memory stand-in for the Firestore query API used by the admin routes.
jest.mock('../config/firebase', () => {
  const state = { collections: {}, indexMissing: false };
  const fieldValue = (data, field) => (field === 'createdAt' ? data.createdAt?.toMillis?.() : data[field]);
  const matches = (data, f) => {
    const value = data[f.field];
    if (f.op === '==') return value === f.value;
    if (f.op === 'array-contains') return Array.isArray(value) && value.includes(f.value);
    throw new Error(`unsupported operator ${f.op}`);
  };
  const run = (name, q, paged) => {
    let docs = Object.entries(state.collections[name] || {}).map(([id, data]) => ({ id, data }));
    docs = docs.filter((d) => q.filters.every((f) => matches(d.data, f)));
    if (q.orders.length) {
      docs.sort((a, b) => {
        for (const o of q.orders) {
          const av = fieldValue(a.data, o.field) ?? 0;
          const bv = fieldValue(b.data, o.field) ?? 0;
          if (av !== bv) return o.dir === 'desc' ? bv - av : av - bv;
        }
        return 0;
      });
    }
    if (!paged) return docs;
    const start = q.offset || 0;
    return docs.slice(start, q.limit == null ? undefined : start + q.limit);
  };
  const snapshot = (docs) => ({
    size: docs.length,
    docs: docs.map((d) => ({ id: d.id, exists: true, data: () => d.data })),
    forEach: (cb) => docs.forEach((d) => cb({ id: d.id, data: () => d.data })),
  });
  const makeQuery = (name, q = { filters: [], orders: [], offset: 0, limit: null }) => {
    const next = (patch) => makeQuery(name, { ...q, ...patch });
    const needsIndex = () => {
      if (state.indexMissing && q.filters.length && q.orders.length) {
        const message = state.indexBuilding ? 'That index is currently building and cannot be used yet.' : 'The query requires an index.';
        throw Object.assign(new Error(message), { code: 9 });
      }
    };
    return {
      where: (field, op, value) => next({ filters: [...q.filters, { field, op, value }] }),
      orderBy: (field, dir = 'asc') => next({ orders: [...q.orders, { field, dir }] }),
      offset: (n) => next({ offset: n }),
      limit: (n) => next({ limit: n }),
      count: () => ({
        get: async () => ({ data: () => ({ count: run(name, q, false).length }) }),
      }),
      aggregate: () => ({
        get: async () => ({
          data: () => ({ calls: run(name, q, false).reduce((sum, d) => sum + (d.data.totalAiCalls || 0), 0) }),
        }),
      }),
      doc: (id) => ({
        get: async () => {
          const data = (state.collections[name] || {})[id];
          return { id, exists: Boolean(data), data: () => data };
        },
      }),
      get: async () => {
        needsIndex();
        return snapshot(run(name, q, true));
      },
    };
  };
  const db = { collection: (name) => makeQuery(name) };
  const firestore = () => db;
  firestore.AggregateField = { sum: (field) => ({ field }) };
  return { firestore, __state: state };
});

const { __state: fakeDb } = require('../config/firebase');
const adminRouter = require('../routes/admin');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use((err, req, res, next) => res.status(500).json({ error: err.message }));

const T = (ms) => ({ toMillis: () => ms });

beforeEach(() => {
  fakeDb.indexMissing = false;
  fakeDb.indexBuilding = false;
  fakeDb.collections = {
    users: {
      u1: { email: 'ada@example.com', displayName: 'Ada Lovelace', searchTokens: searchTokens('ada@example.com', 'Ada Lovelace'), status: 'APPROVED', isUnlimited: true, totalAiCalls: 40, createdAt: T(3000) },
      u2: { email: 'ahmad@example.com', displayName: 'Ahmad', searchTokens: searchTokens('ahmad@example.com', 'Ahmad'), status: 'PENDING', totalAiCalls: 5, createdAt: T(2000) },
      u3: { email: 'bob@example.com', displayName: 'Bob', searchTokens: searchTokens('bob@example.com', 'Bob'), status: 'APPROVED', totalAiCalls: 15, createdAt: T(1000) },
    },
    accessRequests: {
      r1: { email: 'ahmad@example.com', status: 'pending', createdAt: T(2500) },
      r2: { email: 'carol@example.com', status: 'approved', createdAt: T(1500) },
    },
  };
});

describe('GET /api/admin/stats', () => {
  it('counts users by status and sums AI calls from aggregates', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      users: { total: 3, pending: 1, approved: 2, banned: 0, suspended: 0, unlimited: 1 },
      pendingRequests: 1,
      totalAiCalls: 60,
    });
  });
});

describe('GET /api/admin/users', () => {
  it('lists the newest users first with a total and page info', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.users.map((u) => u.uid)).toEqual(['u1', 'u2', 'u3']);
    expect(res.body).toMatchObject({ total: 3, page: 1, pageSize: 20, truncated: false });
  });

  it('filters by status and counts only that status', async () => {
    const res = await request(app).get('/api/admin/users?status=pending');
    expect(res.body.users.map((u) => u.uid)).toEqual(['u2']);
    expect(res.body.total).toBe(1);
  });

  it('pages with an offset and keeps the total', async () => {
    for (let i = 0; i < 25; i += 1) {
      fakeDb.collections.users[`x${i}`] = { email: `user${i}@example.com`, status: 'APPROVED', createdAt: T(100 + i) };
    }
    const res = await request(app).get('/api/admin/users?page=2');
    expect(res.body.users).toHaveLength(8);
    expect(res.body.total).toBe(28);
    expect(res.body.page).toBe(2);
  });

  it('matches the start of any word in the name or email, ignoring case', async () => {
    const byName = await request(app).get('/api/admin/users?search=LOVE');
    expect(byName.body.users.map((u) => u.uid)).toEqual(['u1']);

    const byEmail = await request(app).get('/api/admin/users?search=ahm');
    expect(byEmail.body.users.map((u) => u.uid)).toEqual(['u2']);
    expect(byEmail.body).toMatchObject({ total: 1, truncated: false });
  });

  it('requires every typed word to match', async () => {
    const hit = await request(app).get('/api/admin/users?search=ada%20lov');
    expect(hit.body.users.map((u) => u.uid)).toEqual(['u1']);

    const miss = await request(app).get('/api/admin/users?search=ada%20bob');
    expect(miss.body.users).toEqual([]);
  });

  it('returns nothing for a search with no letters or digits', async () => {
    const res = await request(app).get('/api/admin/users?search=%40%40');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ users: [], total: 0 });
  });

  it('finds a user by exact uid', async () => {
    const res = await request(app).get('/api/admin/users?search=u3');
    expect(res.body.users.map((u) => u.uid)).toEqual(['u3']);
  });

  it('flags search results that hit the per-query limit', async () => {
    for (let i = 0; i < 205; i += 1) {
      fakeDb.collections.users[`z${i}`] = { email: `zed${i}@example.com`, searchTokens: searchTokens(`zed${i}@example.com`), status: 'APPROVED', createdAt: T(i) };
    }
    const res = await request(app).get('/api/admin/users?search=zed');
    expect(res.body.truncated).toBe(true);
    expect(res.body.total).toBe(200);
  });

  it('rejects unknown status filters', async () => {
    const res = await request(app).get('/api/admin/users?status=nope');
    expect(res.status).toBe(400);
  });

  it('answers 503 INDEX_REQUIRED when the status query needs an index that is not deployed', async () => {
    fakeDb.indexMissing = true;
    const res = await request(app).get('/api/admin/users?status=PENDING');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('INDEX_REQUIRED');
  });

  it('says the list is still being prepared while the index is building', async () => {
    fakeDb.indexMissing = true;
    fakeDb.indexBuilding = true;
    const res = await request(app).get('/api/admin/users?status=PENDING');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/still being prepared/);
  });
});

describe('GET /api/admin/requests', () => {
  it('lists requests for one status, newest first', async () => {
    const res = await request(app).get('/api/admin/requests?status=pending');
    expect(res.body.requests.map((r) => r.id)).toEqual(['r1']);
    expect(res.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
  });

  it('lists every request for status all', async () => {
    const res = await request(app).get('/api/admin/requests?status=all');
    expect(res.body.requests.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(res.body.total).toBe(2);
  });

  it('rejects unknown statuses', async () => {
    const res = await request(app).get('/api/admin/requests?status=bogus');
    expect(res.status).toBe(400);
  });
});

describe('reasons typed by an admin', () => {
  const tooLong = 'x'.repeat(501);

  it('rejects a ban reason that is not text or is too long', async () => {
    const notText = await request(app).put('/api/admin/users/u3/status').send({ action: 'ban', reason: { $gt: '' } });
    const long = await request(app).put('/api/admin/users/u3/status').send({ action: 'ban', reason: tooLong });

    expect(notText.status).toBe(400);
    expect(notText.body.code).toBe('INVALID_REQUEST');
    expect(long.status).toBe(400);
  });

  it('rejects a denial reason that is not text or is too long', async () => {
    const notText = await request(app).put('/api/admin/requests/r1/deny').send({ reason: ['a'] });
    const long = await request(app).put('/api/admin/requests/r1/deny').send({ reason: tooLong });

    expect(notText.status).toBe(400);
    expect(long.status).toBe(400);
  });

  it('answers 400 instead of crashing when the body is missing', async () => {
    const res = await request(app).put('/api/admin/users/u3/status');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid action');
  });
});
