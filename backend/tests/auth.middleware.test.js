const { verifyToken, forgetVerifiedUser } = require('../middleware/auth');

const mockVerifyIdToken = jest.fn();
jest.mock('../config/firebase', () => ({
  auth: () => ({
    verifyIdToken: mockVerifyIdToken,
  }),
}));

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should return 401 if no auth header is provided', async () => {
    await verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authorization header missing or malformed. Expected: Bearer <token>' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if auth header format is invalid', async () => {
    req.headers.authorization = 'InvalidTokenFormat';
    await verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authorization header missing or malformed. Expected: Bearer <token>' });
  });

  it('should return 401 if token is revoked (auth/id-token-revoked)', async () => {
    req.headers.authorization = 'Bearer valid.but.revoked';

    mockVerifyIdToken
      .mockResolvedValueOnce({ uid: 'revoked-user' })
      .mockRejectedValueOnce({ code: 'auth/id-token-revoked' });

    await verifyToken(req, res, next);

    expect(mockVerifyIdToken).toHaveBeenLastCalledWith('valid.but.revoked', true);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Session revoked. Please sign in again.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for generic invalid token errors', async () => {
    req.headers.authorization = 'Bearer invalid.token';
    
    mockVerifyIdToken.mockRejectedValueOnce(new Error('Invalid token'));

    await verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid authentication token.' });
  });

  it('should attach user to req and call next() on valid token', async () => {
    req.headers.authorization = 'Bearer valid.token';
    const mockUser = { uid: 'user123', email: 'test@example.com' };
    
    mockVerifyIdToken.mockResolvedValue(mockUser);

    await verifyToken(req, res, next);

    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid.token', true);
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('only re-checks revocation over the network every few minutes per user', async () => {
    req.headers.authorization = 'Bearer cached.token';
    mockVerifyIdToken.mockResolvedValue({ uid: 'fast-user' });

    await verifyToken(req, res, next);
    await verifyToken(req, res, next);
    await verifyToken(req, res, next);

    const revocationChecks = mockVerifyIdToken.mock.calls.filter(([, checkRevoked]) => checkRevoked === true);
    expect(revocationChecks).toHaveLength(1);
    expect(next).toHaveBeenCalledTimes(3);

    forgetVerifiedUser('fast-user');
    await verifyToken(req, res, next);
    expect(mockVerifyIdToken.mock.calls.filter(([, checkRevoked]) => checkRevoked === true)).toHaveLength(2);
  });
});
