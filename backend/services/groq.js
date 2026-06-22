const Groq = require('groq-sdk');

if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️  GROQ_API_KEY not set — Groq models will be unavailable');
}

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

/**
 * Groq model IDs available on the free tier.
 * Ordered by quality for interview use.
 *
 * Free-tier limits (approximate):
 *   openai/gpt-oss-120b       → 30 RPM, 1K RPD, 200K TPD  ← best reasoning
 *   openai/gpt-oss-20b        → 30 RPM, 1K RPD, 200K TPD  ← fast reasoning
 *   llama-3.3-70b-versatile   → 30 RPM, 1K RPD, 100K TPD
 *   meta-llama/llama-4-scout  → 30 RPM, 1K RPD, 500K TPD
 *   llama-3.1-8b-instant      → 30 RPM, 14.4K RPD         ← highest RPD
 *   qwen/qwen3-32b            → 60 RPM, 1K RPD
 */
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'llama-3.1-8b-instant',
  'qwen/qwen3-32b',
  'qwen/qwen3.6-27b',
];

/**
 * Returns true if the given model ID is a Groq model.
 */
function isGroqModel(modelId) {
  return GROQ_MODELS.includes(modelId);
}

/**
 * Returns true if the error is a quota / rate-limit error (HTTP 429).
 */
function isGroqQuotaError(err) {
  const msg  = err?.message || '';
  const code = err?.status || err?.statusCode;
  return (
    code === 429 ||
    code >= 500 ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('rate_limit') ||
    msg.includes('Rate limit') ||
    msg.includes('RATE_LIMIT_EXCEEDED') ||
    msg.includes('Service Unavailable')
  );
}

/**
 * Generate an AI interviewer response using Groq.
 *
 * Groq uses an OpenAI-compatible chat completions API.
 * The system prompt is passed as a system role message.
 *
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages
 * @param {string} systemPrompt
 * @param {string} modelId - A valid Groq model ID
 * @returns {Promise<string>} - The AI response text
 */
async function generateGroqResponse(messages, systemPrompt, modelId) {
  if (!groq) {
    throw new Error('Groq client not initialised — GROQ_API_KEY missing');
  }

  // Build Groq message format: system first, then conversation history
  const groqMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(msg => ({
      role:    msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })),
  ];

  // Add timeout to prevent indefinite hangs
  const timeoutMs = 30_000;
  const completion = await Promise.race([
    groq.chat.completions.create({
      model:              modelId,
      messages:           groqMessages,
      temperature:        0.7,
      max_tokens:         2048,
      top_p:              0.9,
      stream:             false,
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Groq request timed out after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);

  const text = completion.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned an empty response');

  console.info(`✅ Groq model: ${modelId}`);
  return text;
}

module.exports = { generateGroqResponse, isGroqModel, isGroqQuotaError, GROQ_MODELS };
