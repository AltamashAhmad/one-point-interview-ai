const request = require('supertest');
const { createFakeFirestore } = require('./helpers/fakeFirestore');

const mockFake = createFakeFirestore();
jest.mock('../config/firebase', () => {
  const firestore = () => mockFake.db;
  firestore.FieldValue = { serverTimestamp: () => new Date(), increment: (n) => n };
  return { firestore, auth: () => ({}), appCheck: () => ({}) };
});
jest.mock('../middleware/appCheck', () => ({ verifyAppCheck: (req, res, next) => next() }));

const { createApp } = require('../app');
const lifecycle = require('../utils/lifecycle');

const app = createApp();

describe('app middleware stack', () => {
  it('tags every response with a request id and echoes a well-formed incoming one', async () => {
    const fresh = await request(app).get('/api/health');
    expect(fresh.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const traced = await request(app).get('/api/health').set('X-Request-Id', 'trace-abc-12345');
    expect(traced.headers['x-request-id']).toBe('trace-abc-12345');

    const hostile = await request(app).get('/api/health').set('X-Request-Id', '<script>alert(1)</script>');
    expect(hostile.headers['x-request-id']).not.toContain('<');
  });

  it('returns JSON 404s that carry the request id', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND', requestId: res.headers['x-request-id'] });
  });

  it('blocks unknown browser origins', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CORS_BLOCKED');
  });

  it('does not advertise the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('health checks', () => {
  it('liveness reports version and uptime', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'healthy' });
    expect(res.body.version).toBeTruthy();
  });

  it('readiness checks Firestore and reports draining during shutdown', async () => {
    const ready = await request(app).get('/api/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body).toMatchObject({ status: 'ready', checks: { firestore: 'ok' } });

    lifecycle.markShuttingDown();
    const draining = await request(app).get('/api/health/ready');
    expect(draining.status).toBe(503);
    expect(draining.body.status).toBe('draining');
  });
});
