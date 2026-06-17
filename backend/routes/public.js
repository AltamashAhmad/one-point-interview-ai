const express = require('express');
const router  = express.Router();
const admin = require('../config/firebase');
const db = admin.firestore();

/**
 * GET /api/public/status
 *
 * Returns public platform settings like whether signups are allowed.
 * Does not require authentication.
 */
router.get('/status', async (req, res, next) => {
  try {
    let allowNewSignups = true;
    let maintenanceMode = false;

    const settingsDoc = await db.collection('platformSettings').doc('main').get();
    if (settingsDoc.exists) {
      allowNewSignups = settingsDoc.data().allowNewSignups !== false;
      maintenanceMode = settingsDoc.data().maintenanceMode === true;
    }

    res.json({ allowNewSignups, maintenanceMode });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
