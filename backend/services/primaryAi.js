const PrimaryAI = require('groq-sdk');

if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️  GROQ_API_KEY not set — Primary AI models will be unavailable');
}

const primaryService = process.env.GROQ_API_KEY
  ? new PrimaryAI({ apiKey: process.env.GROQ_API_KEY })
  : null;

/**
 * Primary AI model IDs available on the free tier.
 * Verified active in 2026:
 *   qwen/qwen3.8-27b          → ~300ms ultra-low latency, optimal for real-time interview chat
 *   openai/gpt-oss-20b        → ~370ms fast reasoning
 *   openai/gpt-oss-120b       → 120B reasoning, deep technical evaluation / scorecard
 */
const PRIMARY_MODELS = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
];

/**
 * Legacy model ID alias map for seamless backwards compatibility.
 */
const PRIMARY_MODEL_ALIASES = {
  'llama-3.1-8b-instant': 'qwen/qwen3.8-27b',
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'meta-llama/llama-4-scout-17b-16e-instruct': 'qwen/qwen3.8-27b',
  'qwen-2.5-coder-32b': 'qwen/qwen3.8-27b',
  'qwen/qwen3-32b': 'qwen/qwen3.8-27b',
  'qwen/qwen3.6-27b': 'qwen/qwen3.8-27b',
};

/**
 * Returns true if the given model ID is a Primary AI model or known legacy alias.
 */
function isPrimaryModel(modelId) {
  if (!modelId || typeof modelId !== 'string') return false;
  return PRIMARY_MODELS.includes(modelId) || Boolean(PRIMARY_MODEL_ALIASES[modelId]);
}

/**
 * Returns true if the error is a quota / rate-limit error (HTTP 429),
 * service outage (503/500), or deprecated model error (404).
 */
function isPrimaryQuotaError(err) {
  const msg  = err?.message || '';
  const code = err?.status || err?.statusCode;
  return (
    code === 429 ||
    code === 404 ||
    code >= 500 ||
    msg.includes('429') ||
    msg.includes('404') ||
    msg.includes('503') ||
    msg.includes('rate_limit') ||
    msg.includes('Rate limit') ||
    msg.includes('RATE_LIMIT_EXCEEDED') ||
    msg.includes('Service Unavailable') ||
    msg.includes('decommissioned') ||
    msg.includes('not found')
  );
}

/**
 * Generate an AI interviewer response using Primary AI.
 *
 * Primary AI uses an OpenAI-compatible chat completions API.
 * The system prompt is passed as a system role message.
 *
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages
 * @param {string} systemPrompt
 * @param {string} modelId - A valid Primary AI model ID
 * @returns {Promise<string>} - The AI response text
 */
async function generatePrimaryResponse(messages, systemPrompt, modelId) {
  if (!primaryService) {
    throw new Error('Primary AI client not initialised — GROQ_API_KEY missing');
  }

  // Build Primary AI message format: system first, then conversation history
  const primaryAiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(msg => ({
      role:    msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    })),
  ];

  const resolvedModel = PRIMARY_MODEL_ALIASES[modelId] || modelId;

  // Add timeout to prevent indefinite hangs
  const timeoutMs = 90_000;
  const completion = await Promise.race([
    primaryService.chat.completions.create({
      model:              resolvedModel,
      messages:           primaryAiMessages,
      temperature:        0.7,
      max_tokens:         2048,
      top_p:              0.9,
      stream:             false,
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Primary AI request timed out after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);

  const text = completion.choices?.[0]?.message?.content;
  if (!text) throw new Error('Primary AI returned an empty response');

  console.info(`✅ Primary AI model: ${resolvedModel} (requested: ${modelId})`);
  return text;
}

module.exports = { generatePrimaryResponse, isPrimaryModel, isPrimaryQuotaError, PRIMARY_MODELS, PRIMARY_MODEL_ALIASES };
