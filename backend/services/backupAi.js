const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const defaultKey = process.env.GEMINI_API_KEY;
// Parse comma-separated VIP keys if they exist
const vipKeys = process.env.VIP_GEMINI_API_KEYS 
  ? process.env.VIP_GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean)
  : [];

/**
 * Default fallback chain when user hasn't picked a model.
 * Active verified models in 2026:
 *   gemini-2.5-flash       → 10 RPM, 1500 RPD, 1M context
 *   gemini-2.5-flash-lite  → 30 RPM, 1500 RPD, high throughput
 *   gemini-flash-latest    → Stable alias
 *   gemini-flash-lite-latest
 */
const MODEL_FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
];

const BACKUP_MODEL_ALIASES = {
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-pro': 'gemini-2.5-flash',
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-exp': 'gemini-2.5-flash',
  'gemini-2.5-pro': 'gemini-2.5-flash',
  'gemini-3.1-pro-preview': 'gemini-2.5-flash',
};

/**
 * Returns true if the error is a quota / rate-limit error (HTTP 429),
 * 404 (deprecated model), or temporary service unavailable / overloaded error.
 */
function isQuotaError(err) {
  const msg = err?.message || '';
  const status = err?.status || err?.statusCode;
  return (
    status === 429 ||
    status === 404 ||
    status === 503 ||
    status >= 500 ||
    msg.includes('429') ||
    msg.includes('404') ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('quota') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Too Many Requests') ||
    msg.includes('Service Unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('not found') ||
    msg.includes('unsupported')
  );
}

/**
 * Generate an AI interviewer response using Backup AI.
 *
 * If `preferredModel` is provided (user's UI selection), it goes first.
 * On a 429 / quota error we silently try the next model in the chain.
 *
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages
 * @param {string} systemPrompt - The interviewer persona / instructions
 * @param {string} [preferredModel]  - Model chosen by the user in the UI
 * @param {boolean} [isAdmin] - If true, selects an API key from the VIP pool
 * @returns {Promise<string>} - The AI response text
 */
async function generateBackupResponse(messages, systemPrompt, preferredModel, isAdmin = false) {
  // Select API key logic
  let apiKeyToUse = defaultKey;
  if (isAdmin && vipKeys.length > 0) {
    const randomIndex = Math.floor(Math.random() * vipKeys.length);
    apiKeyToUse = vipKeys[randomIndex];
    console.info(`👑 Admin detected! Routing through VIP API Key Pool...`);
  }
  
  const genAI = new GoogleGenerativeAI(apiKeyToUse);

  const resolvedPreferredModel = preferredModel ? (BACKUP_MODEL_ALIASES[preferredModel] || preferredModel) : null;

  // Build the chain: user's pick first, then every other fallback
  const chain = resolvedPreferredModel
    ? [resolvedPreferredModel, ...MODEL_FALLBACK_CHAIN.filter((m) => m !== resolvedPreferredModel)]
    : MODEL_FALLBACK_CHAIN;

  // Convert message history to Backup AI chat format (all except the last message)
  const history = messages.slice(0, -1).map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));
  const lastMessage = messages[messages.length - 1];

  let lastError = null;

  for (const modelName of chain) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
          topP: 0.9,
        },
      });

      const chat = model.startChat({ history });

      // Add timeout to prevent indefinite hangs
      const timeoutMs = 90_000;
      const result = await Promise.race([
        chat.sendMessage(lastMessage.content),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Backup AI request timed out after ${timeoutMs / 1000}s`)), timeoutMs)
        ),
      ]);
      const text = result.response.text();

      // Log when a fallback was used — visible in server console
      if (modelName !== chain[0]) {
        console.info(`ℹ️  Quota fallback used: ${chain[0]} → ${modelName}`);
      } else {
        console.info(`✅ Backup AI Model: ${modelName}`);
      }

      return text;
    } catch (err) {
      if (isQuotaError(err)) {
        console.warn(`⚠️  "${modelName}" quota exceeded or unavailable — trying next fallback in chain...`);
        lastError = err;
        continue;
      }
      // Non-quota error: fail fast (bad auth, invalid request, etc.)
      throw err;
    }
  }

  // All models in the chain are exhausted
  console.error('❌ All models hit quota limits:', chain.join(', '));
  throw Object.assign(
    new Error(
      'All AI models are currently rate-limited. The free tier resets daily at midnight (Pacific Time). ' +
      'Please try again in a few minutes or after the daily quota resets.'
    ),
    { isQuotaExhausted: true, statusCode: 429 }
  );
}

module.exports = { generateBackupResponse, MODEL_FALLBACK_CHAIN, BACKUP_MODEL_ALIASES, isQuotaError };
