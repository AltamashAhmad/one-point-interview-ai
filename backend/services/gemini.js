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
 * Updated May 2026 — 2.0-flash* deprecated June 1, 2026.
 *
 * Free-tier limits (approximate):
 *   gemini-2.5-flash       → 10 RPM,  1500 RPD
 *   gemini-2.5-flash-lite  → 30 RPM,  1500 RPD  ← highest RPM
 *   gemini-3.1-flash-lite  → 15 RPM,  1500 RPD
 *   gemini-3-flash-preview → 10 RPM,   500 RPD
 *   gemini-flash-latest    → 15 RPM,  1500 RPD  ← stable alias
 */
const MODEL_FALLBACK_CHAIN = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
];

/**
 * Returns true if the error is a quota / rate-limit error (HTTP 429)
 * or a temporary 503 Service Unavailable / Overloaded error.
 */
function isQuotaError(err) {
  const msg = err?.message || '';
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('quota') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Too Many Requests') ||
    msg.includes('Service Unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded')
  );
}

/**
 * Generate an AI interviewer response using Gemini.
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
async function generateInterviewResponse(messages, systemPrompt, preferredModel, isAdmin = false) {
  // Select API key logic
  let apiKeyToUse = defaultKey;
  if (isAdmin && vipKeys.length > 0) {
    const randomIndex = Math.floor(Math.random() * vipKeys.length);
    apiKeyToUse = vipKeys[randomIndex];
    console.info(`👑 Admin detected! Routing through VIP API Key Pool...`);
  }
  
  const genAI = new GoogleGenerativeAI(apiKeyToUse);

  // Build the chain: user's pick first, then every other fallback
  const chain = preferredModel
    ? [preferredModel, ...MODEL_FALLBACK_CHAIN.filter((m) => m !== preferredModel)]
    : MODEL_FALLBACK_CHAIN;

  // Convert message history to Gemini chat format (all except the last message)
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
      const timeoutMs = 30_000;
      const result = await Promise.race([
        chat.sendMessage(lastMessage.content),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Gemini request timed out after ${timeoutMs / 1000}s`)), timeoutMs)
        ),
      ]);
      const text = result.response.text();

      // Log when a fallback was used — visible in server console
      if (modelName !== chain[0]) {
        console.info(`ℹ️  Quota fallback used: ${chain[0]} → ${modelName}`);
      } else {
        console.info(`✅ Model: ${modelName}`);
      }

      return text;
    } catch (err) {
      if (isQuotaError(err)) {
        console.warn(`⚠️  "${modelName}" quota exceeded — trying next...`);
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

module.exports = { generateInterviewResponse, MODEL_FALLBACK_CHAIN };
