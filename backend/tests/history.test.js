process.env.GEMINI_API_KEY = 'test_key';
process.env.GROQ_API_KEY = 'test_key';
const request = require('supertest');
const express = require('express');
const historyRouter = require('../routes/history');
const admin = require('../config/firebase');
const groqService = require('../services/groq');

// Mock dependencies
jest.mock('../middleware/auth', () => ({
  verifyToken: (req, res, next) => {
    req.user = { uid: 'user123' };
    next();
  }
}));

const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn();

jest.mock('../config/firebase', () => {
  const firestoreMock = () => ({
    collection: () => ({
      doc: () => ({
        get: mockDocGet,
        update: mockDocUpdate
      })
    })
  });
  firestoreMock.FieldValue = { serverTimestamp: jest.fn() };
  return { firestore: firestoreMock };
});

jest.mock('../services/groq', () => ({
  generateGroqResponse: jest.fn(),
  isGroqModel: jest.fn().mockReturnValue(true)
}));

const app = express();
app.use(express.json());
app.use('/api/history', historyRouter);

describe('POST /api/history/:id/scorecard', () => {
  let mockDocData;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDocData = {
      userId: 'user123',
      modelUsed: 'llama-3.1-8b-instant',
      messages: []
    };

    mockDocUpdate.mockResolvedValue(true);
    mockDocGet.mockImplementation(() => ({
      exists: true,
      data: () => mockDocData
    }));
  });

  it('returns 404 if interview does not exist', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false });
    const res = await request(app).post('/api/history/1/scorecard');
    expect(res.statusCode).toBe(404);
  });

  it('returns 403 if user does not own the interview', async () => {
    mockDocData.userId = 'differentUser';
    const res = await request(app).post('/api/history/1/scorecard');
    expect(res.statusCode).toBe(403);
  });

  it('returns existing scorecard if it already exists', async () => {
    mockDocData.scorecard = { score: 90, verdict: 'Hire' };
    const res = await request(app).post('/api/history/1/scorecard');
    expect(res.statusCode).toBe(200);
    expect(res.body.scorecard.score).toBe(90);
  });

  it('returns 400 if there are no messages at all', async () => {
    const res = await request(app).post('/api/history/1/scorecard');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/No interview transcript/);
  });

  it('returns 400 if user sent 0 messages (caught by our new fix)', async () => {
    mockDocData.messages = [
      { role: 'system', content: 'system instructions' },
      { role: 'assistant', content: 'Hello' }
    ];
    const res = await request(app).post('/api/history/1/scorecard');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Cannot generate a scorecard — you didn't provide any responses/);
  });

  it('generates a scorecard successfully with user messages', async () => {
    mockDocData.messages = [
      { role: 'assistant', content: 'Question' },
      { role: 'user', content: 'Answer' }
    ];

    const fakeScorecard = {
      score: 50,
      verdict: 'Lean Hire',
      strengths: ['Good'],
      weaknesses: ['Bad'],
      problemSolving: 'Okay',
      communication: 'Okay'
    };

    groqService.generateGroqResponse.mockResolvedValueOnce(JSON.stringify(fakeScorecard));

    const res = await request(app).post('/api/history/1/scorecard');
    if (res.statusCode === 500) console.log(res.body);
    expect(res.statusCode).toBe(200);
    expect(res.body.scorecard).toEqual(fakeScorecard);
    expect(mockDocUpdate).toHaveBeenCalledWith(expect.objectContaining({
      scorecard: fakeScorecard
    }));
  });

  it('handles JSON parsing failure gracefully', async () => {
    mockDocData.messages = [{ role: 'user', content: 'Answer' }];
    groqService.generateGroqResponse.mockResolvedValueOnce('invalid json from AI');

    const res = await request(app).post('/api/history/1/scorecard');
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/AI failed to generate a valid scorecard/);
  });
});
