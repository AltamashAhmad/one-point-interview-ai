const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { checkUserAccess, enforceGlobalStatus } = require('../middleware/checkUserAccess');
const admin = require('../config/firebase');
const { generateInterviewResponse } = require('../services/gemini');
const { generateGroqResponse, isGroqModel, isGroqQuotaError } = require('../services/groq');
const { generateOpenRouterResponse, isOpenRouterModel } = require('../services/openrouter');

const db = admin.firestore();

// Validates Firestore document IDs to prevent path traversal / malformed IDs
function isValidDocId(id) {
  if (!id || typeof id !== 'string') return false;
  if (id.length > 128) return false;
  // Firestore IDs: no slashes, no dots-only, no __.*__ reserved names
  if (id.includes('/') || id === '.' || id === '..') return false;
  if (/^__.*__$/.test(id)) return false;
  return true;
}

/**
 * GET /api/history
 * Fetch all past interviews for the authenticated user.
 */
// Apply global status check to all history endpoints (except scorecard generation which handles quota)
router.use(verifyToken, enforceGlobalStatus);

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const snapshot = await db.collection('interviews')
      .where('userId', '==', userId)
      .get();

    const interviews = [];
    snapshot.forEach(doc => {
      interviews.push({ id: doc.id, ...doc.data() });
    });

    interviews.sort((a, b) => {
      const tA = a.updatedAt?.toMillis?.() || 0;
      const tB = b.updatedAt?.toMillis?.() || 0;
      return tB - tA; // desc
    });

    res.json({ interviews });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/history/:id
 * Fetch a specific interview by ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user.uid;
    if (!isValidDocId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session ID.' });
    }
    const docRef = db.collection('interviews').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const data = doc.data();
    if (data.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized access to this interview' });
    }

    res.json({ interview: { id: doc.id, ...data } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/history
 * Create or update an interview session.
 * Body: { sessionId: string, interviewType: string, modelUsed: string, messages: array }
 */
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const { sessionId, interviewType, modelUsed, messages,
            company, difficulty, language, questionTitle, questionLink } = req.body;

    if (!sessionId || !interviewType || !messages) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!isValidDocId(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID.' });
    }

    const docRef = db.collection('interviews').doc(sessionId);
    const doc = await docRef.get();

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    if (doc.exists) {
      if (doc.data().userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      await docRef.update({
        messages,
        modelUsed:     modelUsed     || doc.data().modelUsed,
        // Update metadata fields if provided
        ...(company       !== undefined && { company }),
        ...(difficulty    !== undefined && { difficulty }),
        ...(language      !== undefined && { language }),
        ...(questionTitle !== undefined && { questionTitle }),
        ...(questionLink  !== undefined && { questionLink }),
        updatedAt: timestamp
      });
    } else {
      await docRef.set({
        userId,
        interviewType,
        modelUsed:     modelUsed     || 'unknown',
        company:       company       || null,
        difficulty:    difficulty    || null,
        language:      language      || null,
        questionTitle: questionTitle || null,
        questionLink:  questionLink  || null,
        messages,
        startedAt: timestamp,
        updatedAt: timestamp
      });
    }

    res.json({ success: true, sessionId });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/history/:id
 * Delete a specific interview session.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user.uid;
    if (!isValidDocId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session ID.' });
    }
    const docRef = db.collection('interviews').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    if (doc.data().userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    await docRef.delete();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/history/:id/scorecard
 * Generates an AI scorecard based on the interview transcript.
 */
router.post('/:id/scorecard', checkUserAccess, async (req, res, next) => {
  try {
    const userId = req.user.uid;
    if (!isValidDocId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session ID.' });
    }
    const docRef = db.collection('interviews').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Interview not found' });
    }

    const data = doc.data();
    if (data.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // If scorecard already exists, just return it
    if (data.scorecard) {
      return res.json({ scorecard: data.scorecard });
    }

    const messages = data.messages || [];
    if (messages.length === 0) {
      return res.status(400).json({ error: 'No interview transcript available to score' });
    }

    // Count actual candidate (user) messages — AI-only transcripts shouldn't get scored
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) {
      return res.status(400).json({
        error: 'Cannot generate a scorecard — you didn\'t provide any responses during this interview. Start a new session and answer the questions to get scored.'
      });
    }

    // Build the transcript text
    const transcript = messages
      .filter(m => m.role !== 'system')
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const totalMessages = messages.filter(m => m.role !== 'system').length;

    const systemPrompt = `You are a Principal Engineer and expert technical interviewer at a top tech company.
Your task is to evaluate the following interview transcript and generate a final scorecard.

CRITICAL SCORING RULES:
- The transcript contains ${totalMessages} total messages, of which ${userMessages.length} are from the CANDIDATE.
- Base your score ONLY on what the candidate actually said and demonstrated. Never infer or hallucinate abilities not shown in the transcript.
- NON-NEGOTIABLE RULE 1: If the candidate provided very few responses (1-2 messages) or only trivial/vague answers, the score MUST be between 0-25 and the verdict MUST be "No Hire".
- NON-NEGOTIABLE RULE 2: If the candidate NEVER wrote any actual code (in any language) for a DSA/LLD problem, the verdict MUST be "No Hire" and the score MUST NOT exceed 30.
- If the candidate attempted the problem with code but made significant errors or had incomplete solutions, score 25-50 ("No Hire").
- If the candidate provided a reasonable approach with minor gaps and working code, score 50-75 ("Lean Hire" or "Hire").
- Only give 75+ ("Strong Hire") if the candidate demonstrated strong problem-solving, clear communication, and optimal, working code.
- Strengths and weaknesses MUST reflect what actually happened in the transcript. Do NOT fabricate accomplishments.

You MUST output ONLY a valid JSON object with the following exact structure, no markdown blocks:
{
  "score": <number 0-100>,
  "verdict": "<'Hire', 'Strong Hire', 'Lean Hire', or 'No Hire'>",
  "strengths": ["point 1", "point 2"],
  "weaknesses": ["point 1", "point 2"],
  "problemSolving": "<Detailed paragraph on their problem solving and technical skills>",
  "communication": "<Detailed paragraph on their communication and clarity>"
}

Transcript (${userMessages.length} candidate messages, ${totalMessages - userMessages.length} interviewer messages):
${transcript}`;

    const aiMessages = [
      { role: 'user', content: 'Generate the scorecard for this interview.' }
    ];

    let responseText = '';
    // Use the user's selected scorecard model. If the request arrives with no
    // body (Express 5 leaves req.body undefined), fall back to the model the
    // interview was conducted with.
    let modelUsed = req.body?.model || data.modelUsed || 'openai/gpt-oss-120b:free';
    
    // Check if user is admin for VIP API key routing
    const isAdmin = req.userProfile?.role === 'admin';

    if (modelUsed && isGroqModel(modelUsed)) {
      try {
        responseText = await generateGroqResponse(aiMessages, systemPrompt, modelUsed);
        if (!responseText || responseText.trim() === '') throw new Error('EMPTY_RESPONSE');
      } catch (groqErr) {
        if (isGroqQuotaError(groqErr) || groqErr.message === 'EMPTY_RESPONSE') {
          console.warn(`⚠️  Groq failed on scorecard generation with "${modelUsed}" — falling back to Gemini`);
          responseText = await generateInterviewResponse(aiMessages, systemPrompt, null, isAdmin);
        } else {
          throw groqErr;
        }
      }
    } else if (modelUsed && isOpenRouterModel(modelUsed)) {
      try {
        responseText = await generateOpenRouterResponse(modelUsed, systemPrompt, aiMessages);
        if (!responseText || responseText.trim() === '') throw new Error('EMPTY_RESPONSE');
      } catch (orErr) {
        if (orErr.code === 'OPENROUTER_QUOTA_EXCEEDED' || orErr.message === 'EMPTY_RESPONSE') {
          console.warn(`⚠️  OpenRouter failed on scorecard generation with "${modelUsed}" — falling back to Gemini`);
          responseText = await generateInterviewResponse(aiMessages, systemPrompt, null, isAdmin);
        } else {
          throw orErr;
        }
      }
    } else {
      responseText = await generateInterviewResponse(aiMessages, systemPrompt, modelUsed, isAdmin);
    }

    // Robust JSON extraction
    let scorecard;
    try {
      let cleanedText = responseText;
      const firstBrace = cleanedText.indexOf('{');
      const lastBrace = cleanedText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
      }
      scorecard = JSON.parse(cleanedText);
    } catch (e) {
      console.error('Failed to parse scorecard JSON:', responseText);
      return res.status(500).json({ error: 'AI failed to generate a valid scorecard. Please try again.' });
    }

    // Save to Firestore
    await docRef.update({
      scorecard,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ scorecard });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
