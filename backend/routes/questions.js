const express = require('express');
const router  = express.Router();
const { verifyToken }   = require('../middleware/auth');
const { getCompanyList } = require('../services/questionBank');

/**
 * GET /api/questions/companies
 * Returns the full list of companies available in the DSA question bank.
 * Used for autocomplete in the InterviewSetup screen.
 *
 * Response:
 *   { companies: Array<{ slug, name, questionCount }> }
 */
router.get('/companies', verifyToken, (req, res) => {
  const companies = getCompanyList();
  res.json({ companies });
});

module.exports = router;
