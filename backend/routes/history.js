const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const admin = require('../config/firebase');

const db = admin.firestore();

/**
 * GET /api/history
 * Fetch all past interviews for the authenticated user.
 */
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const snapshot = await db.collection('interviews')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .get();

    const interviews = [];
    snapshot.forEach(doc => {
      interviews.push({ id: doc.id, ...doc.data() });
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
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.uid;
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
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const { sessionId, interviewType, modelUsed, messages } = req.body;

    if (!sessionId || !interviewType || !messages) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const docRef = db.collection('interviews').doc(sessionId);
    const doc = await docRef.get();

    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    if (doc.exists) {
      // Ensure the user owns this document
      if (doc.data().userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      // Update existing session
      await docRef.update({
        messages,
        modelUsed: modelUsed || doc.data().modelUsed, // update if provided
        updatedAt: timestamp
      });
    } else {
      // Create new session
      await docRef.set({
        userId,
        interviewType,
        modelUsed: modelUsed || 'unknown',
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
router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.uid;
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

module.exports = router;
