// Single source of truth for every AI model the platform can use.
// Frontend reads the visible, enabled subset from GET /api/meta.

const PROVIDER_KEYS = {
  groq: 'GROQ_API_KEY',
  gemini: 'GEMINI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

const MODELS = [
  {
    id: 'qwen/qwen3.8-27b',
    provider: 'groq',
    name: 'Qwen 3.8 27B',
    badge: '300ms Ultra Fast',
    badgeColor: '#10b981',
    icon: '⚡',
    rpm: 30,
    rpd: 14400,
    contextWindow: '256K',
    description: 'Blazing-fast inference on Groq LPUs · High accuracy DSA & coding',
  },
  {
    id: 'openai/gpt-oss-120b',
    provider: 'groq',
    name: 'GPT-OSS 120B',
    badge: '120B Reasoning',
    badgeColor: '#2563eb',
    icon: '🏋️',
    rpm: 30,
    rpd: 1000,
    contextWindow: '131K',
    description: '120 Billion parameter model on Groq · In-depth architectural trade-offs & evaluation',
  },
  {
    id: 'openai/gpt-oss-20b',
    provider: 'groq',
    name: 'GPT-OSS 20B',
    badge: 'Fast Reasoning',
    badgeColor: '#0ea5e9',
    icon: '💡',
    rpm: 30,
    rpd: 1000,
    contextWindow: '131K',
    description: '20 Billion parameter lightweight reasoning model · Fast & analytical',
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'gemini',
    name: 'Gemini 2.5 Flash',
    badge: '1M Context',
    badgeColor: '#8b5cf6',
    icon: '🚀',
    rpm: 15,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Google DeepMind model with 1M token context · Exceptional architecture reasoning',
  },
  {
    id: 'gemini-2.5-flash-lite',
    provider: 'gemini',
    name: 'Gemini 2.5 Flash-Lite',
    badge: 'High Speed',
    badgeColor: '#06b6d4',
    icon: '✨',
    rpm: 30,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Rapid response time by Google · Smooth conversational drills',
  },
  { id: 'gemini-flash-latest', provider: 'gemini', name: 'Gemini Flash (latest)', hidden: true },
  { id: 'gemini-flash-lite-latest', provider: 'gemini', name: 'Gemini Flash-Lite (latest)', hidden: true },
  {
    id: 'openrouter/free',
    provider: 'openrouter',
    name: 'OpenRouter Free',
    badge: 'Auto-Failover',
    badgeColor: '#f97316',
    icon: '🛡️',
    rpm: 20,
    rpd: 1000,
    contextWindow: '200K',
    description: 'Dynamic auto-router that automatically balances across 18+ free models',
  },
];

// Old IDs saved in existing sessions or sent by older clients.
const ALIASES = {
  'llama-3.1-8b-instant': 'qwen/qwen3.8-27b',
  'llama-3.1-8b': 'qwen/qwen3.8-27b',
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'llama-3.3-70b': 'openai/gpt-oss-120b',
  'meta-llama/llama-4-scout-17b-16e-instruct': 'qwen/qwen3.8-27b',
  'qwen-2.5-coder-32b': 'qwen/qwen3.8-27b',
  'qwen/qwen3-32b': 'qwen/qwen3.8-27b',
  'qwen/qwen3.6-27b': 'qwen/qwen3.8-27b',
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-1.5-pro': 'gemini-2.5-flash',
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-exp': 'gemini-2.5-flash',
  'gemini-2.5-pro': 'gemini-2.5-flash',
  'gemini-3.1-pro-preview': 'gemini-2.5-flash',
  'gemini-flash': 'gemini-2.5-flash',
  'gemini-pro': 'gemini-2.5-flash',
};

// Order tried when the requested model is unavailable.
const FALLBACK_ORDER = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'openrouter/free',
];

const PURPOSE_DEFAULTS = {
  chat: 'qwen/qwen3.8-27b',
  scorecard: 'openai/gpt-oss-120b',
  // Notes need ~4k output tokens, which exceeds Groq's per-request cap for qwen.
  notes: 'openai/gpt-oss-120b',
};

const byId = new Map(MODELS.map((m) => [m.id, m]));

function isProviderConfigured(provider, env = process.env) {
  return Boolean(env[PROVIDER_KEYS[provider]]);
}

function resolveModelId(id) {
  if (!id || typeof id !== 'string') return null;
  const resolved = ALIASES[id] || id;
  return byId.has(resolved) ? resolved : null;
}

function getModel(id) {
  const resolved = resolveModelId(id);
  return resolved ? byId.get(resolved) : null;
}

function isEnabled(model, env = process.env) {
  return Boolean(model) && isProviderConfigured(model.provider, env);
}

/** Models shown in the UI: visible and backed by a configured provider. */
function listVisibleModels(env = process.env) {
  return MODELS.filter((m) => !m.hidden && isEnabled(m, env));
}

function defaultModelId(purpose = 'chat', env = process.env) {
  const preferred = getModel(PURPOSE_DEFAULTS[purpose]);
  if (isEnabled(preferred, env)) return preferred.id;
  const first = FALLBACK_ORDER.map(getModel).find((m) => isEnabled(m, env));
  return first ? first.id : null;
}

/** Requested model first, then every other enabled model in fallback order. */
function buildChain(requestedId, purpose = 'chat', env = process.env) {
  const start = resolveModelId(requestedId) || defaultModelId(purpose, env);
  const ids = [start, ...FALLBACK_ORDER.filter((id) => id !== start)];
  return ids.map(getModel).filter((m) => isEnabled(m, env));
}

module.exports = { ALIASES, resolveModelId, listVisibleModels, defaultModelId, buildChain };
