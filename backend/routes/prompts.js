const express = require('express');
const router  = express.Router();
const { verifyToken }               = require('../middleware/auth');
const { checkUserAccess }           = require('../middleware/checkUserAccess');
const { getSystemPrompt }           = require('../services/prompts');
const { getQuestion }               = require('../services/questionBank');

// POST /api/prompts/generate
router.post('/generate', verifyToken, checkUserAccess, async (req, res) => {
  try {
    const {
      interviewType,
      userName,
      config = {},
    } = req.body;

    const isSuperAdmin = (req.user?.email || '').trim().toLowerCase() === (process.env.ADMIN_EMAIL || 'altamashahmadajaz2@gmail.com').toLowerCase();
    
    if (req.userProfile?.role !== 'admin' && !isSuperAdmin) {
      return res.status(403).json({ 
        error: `Forbidden: Admin access required. (Role: ${req.userProfile?.role || 'none'}, Email: ${req.user?.email || 'none'})` 
      });
    }

    if (!interviewType) {
      return res.status(400).json({ error: 'interviewType is required' });
    }

    let questionData = null;
    let diff = config.difficulty || 'ANY';
    let company = config.company;
    let language = config.language;
    let questionSeed = config.questionSeed;

    if (questionSeed) {
      questionData = { title: questionSeed, isSeed: true };
    } else {
      const baseType = interviewType.startsWith('tutor') 
        ? interviewType === 'tutorDsa' ? 'dsa' 
          : interviewType === 'tutorLld' ? 'lld' 
          : interviewType === 'tutorSystemDesign' ? 'systemDesign' 
          : 'dsa'
        : interviewType === 'managerial' ? 'managerial'
        : interviewType;

      questionData = getQuestion(baseType, company, diff, []);
    }

    const systemPrompt = getSystemPrompt(interviewType, userName || 'Admin', {
      company:      company || null,
      difficulty:   diff,
      language:     language || 'any language',
      questionData: questionData,
    });

    res.json({
      prompt: systemPrompt,
      questionData: questionData,
    });

  } catch (error) {
    console.error('Prompt generation error:', error);
    res.status(500).json({ error: error.message || 'Internal server error during prompt generation' });
  }
});

module.exports = router;
