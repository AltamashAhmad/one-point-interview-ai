const express = require('express');
const admin = require('../config/firebase');
const { version } = require('../package.json');
const lifecycle = require('../utils/lifecycle');

const router = express.Router();
const READINESS_TIMEOUT_MS = 2000;

/** Liveness: the process is up. Cheap, no dependencies. */
router.get('/', (req, res) => {
  res.json({ status: 'healthy', service: 'One Point Interview AI', version, uptimeSec: Math.round(process.uptime()), timestamp: new Date().toISOString() });
});

/** Readiness: can serve traffic (not draining, Firestore reachable). Load balancers should route on this. */
router.get('/ready', async (req, res) => {
  if (lifecycle.isShuttingDown()) {
    return res.status(503).json({ status: 'draining' });
  }
  let timer;
  try {
    await Promise.race([
      admin.firestore().collection('_health').limit(1).get(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Firestore timeout')), READINESS_TIMEOUT_MS); }),
    ]);
    res.json({ status: 'ready', checks: { firestore: 'ok' } });
  } catch (error) {
    res.status(503).json({ status: 'unavailable', checks: { firestore: error.message } });
  } finally {
    clearTimeout(timer);
  }
});

module.exports = router;
