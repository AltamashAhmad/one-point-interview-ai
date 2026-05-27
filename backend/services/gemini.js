const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Model fallback chain — ordered by preference.
 * When one model hits its daily/per-minute quota (429), we automatically
 * try the next one. This prevents a single quota exhaustion from
 * taking down the whole service.
 *
 * Free-tier limits (approximate):
 *   gemini-2.0-flash       → 1,500 req/day, 15 RPM
 *   gemini-2.0-flash-lite  → 1,500 req/day, 30 RPM
 *   gemini-flash-latest    → 1,500 req/day, 15 RPM
 *   gemini-flash-lite-latest → 1,500 req/day, 30 RPM
 */
const MODEL_FALLBACK_CHAIN = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
];

/**
 * Check if an error is a quota/rate-limit error (HTTP 429).
 * @param {Error} err
 * @returns {boolean}
 */
function isQuotaError(err) {
  const msg = err?.message || '';
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Too Many Requests')
  );
}

/**
 * Generate an AI interviewer response using Gemini.
 * Automatically falls back through MODEL_FALLBACK_CHAIN on quota errors.
 *
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages
 * @param {string} systemPrompt - The interviewer persona/instructions
 * @returns {Promise<string>} - The AI response text
 */
async function generateInterviewResponse(messages, systemPrompt) {
  // Convert message history to Gemini format (all except the last message)
  const history = messages.slice(0, -1).map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));
  const lastMessage = messages[messages.length - 1];

  let lastError = null;

  for (const modelName of MODEL_FALLBACK_CHAIN) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.8,
          topP: 0.9,
        },
      });

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMessage.content);
      const text = result.response.text();

      // Log which model was actually used (useful for debugging)
      if (modelName !== MODEL_FALLBACK_CHAIN[0]) {
        console.info(`ℹ️  Used fallback model: ${modelName}`);
      }

      return text;
    } catch (err) {
      if (isQuotaError(err)) {
        console.warn(`⚠️  Model "${modelName}" quota exceeded — trying next model...`);
        lastError = err;
        continue; // try next model
      }
      // Non-quota error (bad request, auth issue, etc.) — fail immediately
      throw err;
    }
  }

  // All models exhausted
  console.error('❌ All Gemini models hit quota limits.');
  throw Object.assign(
    new Error(
      'All AI models are currently rate-limited. The free tier resets daily at midnight (Pacific Time). ' +
      'Please try again in a few minutes or tomorrow.'
    ),
    { isQuotaExhausted: true, statusCode: 429 }
  );
}

module.exports = { generateInterviewResponse, MODEL_FALLBACK_CHAIN };
