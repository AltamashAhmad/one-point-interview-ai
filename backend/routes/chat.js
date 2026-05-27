const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { generateInterviewResponse } = require('../services/gemini');
const { getSystemPrompt } = require('../services/prompts');

const VALID_INTERVIEW_TYPES = ['dsa', 'systemDesign', 'lld'];

/**
 * POST /api/chat
 *
 * Body:
 *   messages: Array<{ role: 'user' | 'assistant', content: string }>
 *   interviewType: 'dsa' | 'systemDesign' | 'lld'
 *
 * Response:
 *   { role: 'assistant', content: string }
 */
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { messages, interviewType, userName = 'there' } = req.body;

    // ── Input Validation ────────────────────────────────────────
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages must be a non-empty array' });
    }

    if (messages.length > 100) {
      return res.status(400).json({ error: 'Message history too long (max 100 messages)' });
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content || typeof msg.content !== 'string') {
        return res.status(400).json({ error: 'Each message must have a role and content string' });
      }
      if (!['user', 'assistant'].includes(msg.role)) {
        return res.status(400).json({ error: 'Message role must be "user" or "assistant"' });
      }
      if (msg.content.length > 5000) {
        return res.status(400).json({ error: 'Message content too long (max 5000 chars)' });
      }
    }

    if (!interviewType || !VALID_INTERVIEW_TYPES.includes(interviewType)) {
      return res.status(400).json({
        error: `interviewType must be one of: ${VALID_INTERVIEW_TYPES.join(', ')}`,
      });
    }

    // Ensure conversation starts with a user message (Gemini requirement)
    if (messages[0].role !== 'user') {
      return res.status(400).json({ error: 'First message must have role "user"' });
    }

    // ── Generate Response ───────────────────────────────────────
    const systemPrompt = getSystemPrompt(interviewType, userName);
    const responseText = await generateInterviewResponse(messages, systemPrompt);

    res.json({
      role: 'assistant',
      content: responseText,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/types
 * Returns available interview types (for frontend reference)
 */
router.get('/types', (req, res) => {
  res.json({
    types: VALID_INTERVIEW_TYPES,
    details: {
      dsa: { label: 'DSA', description: 'Data Structures & Algorithms', color: '#3b82f6' },
      systemDesign: { label: 'System Design', description: 'Scalable System Architecture', color: '#8b5cf6' },
      lld: { label: 'LLD', description: 'Low-Level / OOP Design', color: '#10b981' },
    },
  });
});

module.exports = router;
