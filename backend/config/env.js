const logger = require('../utils/logger');

const REQUIRED = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'GEMINI_API_KEY',
];

const OPTIONAL = {
  GROQ_API_KEY: 'Groq models (Qwen, GPT-OSS) will be unavailable',
  OPENROUTER_API_KEY: 'OpenRouter models will be unavailable',
  OPENAI_API_KEY: 'code review will use the interviewer model instead of the structured reviewer',
  ALLOWED_ORIGINS: 'CORS falls back to http://localhost:3000 only',
};

/**
 * Fails fast on missing required configuration and warns once about optional features.
 */
function validateEnv(env = process.env) {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. See backend/.env.example.`);
  }
  for (const [key, impact] of Object.entries(OPTIONAL)) {
    if (!env[key]) logger.warn(`${key} not set — ${impact}`);
  }
}

module.exports = { validateEnv, REQUIRED };
