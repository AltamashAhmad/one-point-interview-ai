const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'One Point Interview AI',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
