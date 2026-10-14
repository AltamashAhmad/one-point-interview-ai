const request = require('supertest');
const express = require('express');
const { httpError, errorHandler, GENERIC_SERVER_MESSAGE } = require('../utils/httpError');
const { validateEnv, REQUIRED } = require('../config/env');
const logger = require('../utils/logger');

function appThatThrows(err) {
  const app = express();
  app.get('/boom', () => { throw err; });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows user-facing errors with their status and code', async () => {
    const res = await request(appThatThrows(httpError(403, 'Origin not allowed.', 'CORS_BLOCKED'))).get('/boom');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Origin not allowed.', code: 'CORS_BLOCKED' });
  });

  it('hides internal and upstream provider errors behind a generic 500', async () => {
    const upstream = Object.assign(new Error('404 {"error":{"message":"The model `x` does not exist"}}'), { status: 404 });
    const res = await request(appThatThrows(upstream)).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: GENERIC_SERVER_MESSAGE, code: 'INTERNAL_ERROR' });
  });

  it('passes retryAfter through for exposed rate-limit errors', async () => {
    const err = Object.assign(httpError(429, 'Busy', 'AI_QUOTA_EXHAUSTED'), { retryAfter: 60 });
    const res = await request(appThatThrows(err)).get('/boom');
    expect(res.status).toBe(429);
    expect(res.body.retryAfter).toBe(60);
  });
});

describe('validateEnv', () => {
  beforeEach(() => jest.spyOn(logger, 'warn').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('throws listing every missing required variable', () => {
    expect(() => validateEnv({})).toThrow(REQUIRED.join(', '));
  });

  it('passes when required variables are present and warns about optional ones', () => {
    const env = Object.fromEntries(REQUIRED.map((k) => [k, 'x']));
    expect(() => validateEnv(env)).not.toThrow();
    expect(logger.warn).toHaveBeenCalled();
  });
});
