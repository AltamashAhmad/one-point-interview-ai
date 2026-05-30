const express = require('express');
const router  = express.Router();
const { verifyToken }               = require('../middleware/auth');
const { generateInterviewResponse } = require('../services/gemini');
const { generateGroqResponse, isGroqModel, isGroqQuotaError } = require('../services/groq');
const { getSystemPrompt }           = require('../services/prompts');
const { getQuestion }               = require('../services/questionBank');
const admin                         = require('../config/firebase');

const db = admin.firestore();

const VALID_INTERVIEW_TYPES = ['dsa', 'systemDesign', 'lld', 'tutorDsa', 'tutorLld', 'tutorSystemDesign', 'managerial'];
const VALID_DIFFICULTIES    = ['EASY', 'MEDIUM', 'HARD', 'ANY'];

/**
 * POST /api/chat
 *
 * Body:
 *   messages:       Array<{ role: 'user' | 'assistant', content: string }>
 *   interviewType:  'dsa' | 'systemDesign' | 'lld'
 *   userName:       string  (candidate first name)
 *   model:          string  (Gemini model id)
 *   company:        string  (optional — target company)
 *   difficulty:     string  (optional — 'EASY' | 'MEDIUM' | 'HARD' | 'ANY')
 *   language:       string  (optional — preferred coding language)
 *   questionSeed:   string  (optional — if provided, skip question selection and
 *                            use this pre-selected question title for continuity)
 *
 * Response:
 *   { role: 'assistant', content: string, questionTitle?: string }
 */
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const {
      messages,
      interviewType,
      userName    = 'there',
      model,
      company     = '',
      difficulty  = 'ANY',
      language    = 'any language',
      questionSeed,          // title of the already-selected question (continuity)
    } = req.body;

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
      if (msg.content.length > 8000) {
        return res.status(400).json({ error: 'Message content too long (max 8000 chars)' });
      }
    }
    if (!interviewType || !VALID_INTERVIEW_TYPES.includes(interviewType)) {
      return res.status(400).json({
        error: `interviewType must be one of: ${VALID_INTERVIEW_TYPES.join(', ')}`,
      });
    }
    if (messages[0].role !== 'user') {
      return res.status(400).json({ error: 'First message must have role "user"' });
    }

    // Normalise difficulty
    const diffNorm = (difficulty || 'ANY').toUpperCase();
    const diff     = VALID_DIFFICULTIES.includes(diffNorm) ? diffNorm : 'ANY';

    // ── Question Selection ───────────────────────────────────────
    // Only select a new question on the FIRST message of a session.
    // Subsequent messages pass questionSeed to avoid re-selecting.
    let questionData = null;

    if (messages.length === 1) {
      // First message — pick a real question from the bank
      // Fetch practiced questions to avoid duplicates
      const userId = req.user.uid;
      const snapshot = await db.collection('interviews')
        .where('userId', '==', userId)
        .get();
        
      const practicedQuestions = [];
      snapshot.forEach(doc => {
        const qTitle = doc.data().questionTitle;
        if (qTitle) practicedQuestions.push(qTitle);
      });

      // Map tutor types to their base types for question selection
      const baseType = interviewType.startsWith('tutor') 
        ? interviewType === 'tutorDsa' ? 'dsa' 
          : interviewType === 'tutorLld' ? 'lld' 
          : interviewType === 'tutorSystemDesign' ? 'systemDesign' 
          : 'dsa'
        : interviewType === 'managerial' ? 'managerial'
        : interviewType;

      questionData = getQuestion(baseType, company, diff, practicedQuestions);
    }
    // For subsequent messages, the question is already embedded in the
    // conversation history, so we don't need to re-inject it.

    // ── Build System Prompt ──────────────────────────────────────
    const systemPrompt = getSystemPrompt(interviewType, userName, {
      company:      company || null,
      difficulty:   diff,
      language:     language || 'any language',
      questionData: messages.length === 1 ? questionData : null,
    });

    // ── Generate Response (route to Groq or Gemini) ─────────────
    let responseText;
    if (model && isGroqModel(model)) {
      try {
        responseText = await generateGroqResponse(messages, systemPrompt, model);
      } catch (groqErr) {
        if (isGroqQuotaError(groqErr)) {
          // Groq quota hit → fall back to Gemini automatically
          console.warn(`⚠️  Groq quota on "${model}" — falling back to Gemini`);
          responseText = await generateInterviewResponse(messages, systemPrompt, null);
        } else {
          throw groqErr;
        }
      }
    } else {
      responseText = await generateInterviewResponse(messages, systemPrompt, model);
    }

    // Return the response plus the selected question title (for frontend continuity)
    const responseBody = { role: 'assistant', content: responseText };
    if (questionData) {
      responseBody.questionTitle = questionData.title 
        || questionData.question?.title
        || questionData.problem?.title
        || null;
      responseBody.questionLink  = questionData.question?.link || null;
      responseBody.companyName   = questionData.companyName || null;
    }

    res.json(responseBody);

  } catch (error) {
    if (isGroqQuotaError(error)) {
      return res.status(429).json({
        error: '⏳ Groq API rate limit reached. The app will automatically retry with Gemini. Please try again in a moment.',
        retryAfter: 30,
      });
    }

    if (error.message?.includes('RECITATION')) {
      return res.status(400).json({
        error: '⚠️ The AI safety filter blocked the response because it matched an exact coding solution too closely (Copyright/Recitation protection). Please try explaining your answer in your own words, or just type a slightly different variation of the code.',
      });
    }

    if (error.isQuotaExhausted || error.message?.includes('rate-limited')) {
      return res.status(429).json({
        error: '⏳ The AI interviewer is taking a short break — free tier quota reached. Please try again in a few minutes or after midnight (Pacific Time) when quotas reset.',
        retryAfter: 60,
      });
    }
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
      dsa:               { label: 'DSA',                description: 'Data Structures & Algorithms',          color: '#3b82f6' },
      systemDesign:      { label: 'System Design',      description: 'Scalable System Architecture',           color: '#8b5cf6' },
      lld:               { label: 'LLD',                description: 'Low-Level / OOP Design',                 color: '#10b981' },
      tutorDsa:          { label: 'DSA Tutor',          description: 'Learn DSA with guided teaching',         color: '#f59e0b' },
      tutorLld:          { label: 'LLD Tutor',          description: 'Learn OOP Design with guided teaching',  color: '#06b6d4' },
      tutorSystemDesign: { label: 'System Design Tutor', description: 'Learn System Design with guided teaching', color: '#ec4899' },
      managerial:        { label: 'Managerial',         description: 'Behavioral and cultural fit interview',  color: '#f43f5e' },
    },
  });
});

module.exports = router;
