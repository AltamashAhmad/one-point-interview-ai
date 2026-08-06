const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { verifyToken } = require('../middleware/auth');
const { checkUserAccess } = require('../middleware/checkUserAccess');
const { auditCode } = require('../services/openaiCodeAudit');

const router = express.Router();

const auditLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid || ipKeyGenerator(req),
  message: { error: 'Too many code audits. Please wait a few minutes before trying again.' },
});

const VALID_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'cpp',
  'c++',
  'csharp',
  'go',
  'rust',
  'swift',
  'kotlin',
  'ruby',
  'php',
];

function sanitizeShortText(value, maxLength = 180) {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/[\x00-\x1F\x7F]/g, '').replace(/```/g, '').trim().slice(0, maxLength);
}

router.post('/', verifyToken, checkUserAccess, auditLimiter, async (req, res, next) => {
  try {
    const {
      code,
      language = 'javascript',
      problemTitle = '',
      promptContext = '',
    } = req.body || {};

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'code must be a non-empty string.' });
    }
    if (code.length > 20_000) {
      return res.status(400).json({ error: 'Code is too long. Please submit 20,000 characters or fewer.' });
    }

    const normalizedLanguage = sanitizeShortText(language, 40).toLowerCase() || 'javascript';
    if (!VALID_LANGUAGES.includes(normalizedLanguage)) {
      return res.status(400).json({ error: 'Unsupported language for code audit.' });
    }

    const audit = await auditCode({
      code,
      language: normalizedLanguage,
      problemTitle: sanitizeShortText(problemTitle),
      promptContext: sanitizeShortText(promptContext, 600),
    });

    res.json({
      role: 'assistant',
      content: audit.summary,
      audit,
      provider: 'openai',
    });
  } catch (error) {
    if (error.status === 503 || error.code === 'OPENAI_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'OpenAI code audit is not configured. Set OPENAI_API_KEY on the backend deployment.',
        code: 'OPENAI_NOT_CONFIGURED',
      });
    }

    if (error.status === 429 || error.code === 'rate_limit_exceeded') {
      return res.status(429).json({
        error: 'OpenAI code audit is temporarily rate-limited. Please try again shortly.',
        retryAfter: 60,
      });
    }

    next(error);
  }
});

module.exports = router;
