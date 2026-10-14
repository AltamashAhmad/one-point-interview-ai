const express = require('express');
const router = express.Router();
const registry = require('../services/ai/modelRegistry');
const { modelStatus } = require('../services/ai/gateway');
const { INTERVIEW_TYPES } = require('../config/interviewTypes');

const PUBLIC_FIELDS = ['id', 'provider', 'name', 'badge', 'badgeColor', 'icon', 'rpm', 'rpd', 'contextWindow', 'description'];

/**
 * GET /api/meta
 * Platform catalogue for the frontend: enabled AI models (with live availability) and interview types.
 */
router.get('/', (req, res) => {
  const availability = new Map(modelStatus().map((m) => [m.id, m.available]));
  const models = registry.listVisibleModels().map((m) => ({
    ...Object.fromEntries(PUBLIC_FIELDS.map((f) => [f, m[f]])),
    available: availability.get(m.id) !== false,
  }));

  res.set('Cache-Control', 'private, max-age=60');
  res.json({
    models,
    defaults: {
      chat: registry.defaultModelId('chat'),
      scorecard: registry.defaultModelId('scorecard'),
    },
    interviewTypes: INTERVIEW_TYPES,
  });
});

module.exports = router;
