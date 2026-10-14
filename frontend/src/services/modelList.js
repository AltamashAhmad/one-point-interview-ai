// Bundled fallback model list, used until GET /api/meta returns the live catalogue.
export const AVAILABLE_MODELS = [
  // ── Groq LPUs (Ultra-Low Latency) ───────────────────────────
  {
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B',
    provider: 'groq',
    badge: '300ms Ultra Fast',
    badgeColor: '#10b981',
    rpm: 30,
    rpd: 14400,
    contextWindow: '256K',
    description: 'Blazing-fast inference on Groq LPUs · High accuracy DSA & coding',
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'groq',
    badge: '120B Reasoning',
    badgeColor: '#2563eb',
    rpm: 30,
    rpd: 1000,
    contextWindow: '131K',
    description: '120 Billion parameter model on Groq · In-depth architectural trade-offs & evaluation',
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    provider: 'groq',
    badge: 'Fast Reasoning',
    badgeColor: '#0ea5e9',
    rpm: 30,
    rpd: 1000,
    contextWindow: '131K',
    description: '20 Billion parameter lightweight reasoning model · Fast & analytical',
  },

  // ── Google AI (Gemini Studio) ───────────────────────────────
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    badge: '1M Context',
    badgeColor: '#8b5cf6',
    rpm: 15,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Google DeepMind model with 1M token context · Exceptional architecture reasoning',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'gemini',
    badge: 'High Speed',
    badgeColor: '#06b6d4',
    rpm: 30,
    rpd: 1500,
    contextWindow: '1M tokens',
    description: 'Rapid response time by Google · Smooth conversational drills',
  },

  // ── OpenRouter (Multi-Provider Dynamic Failover) ─────────────
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free',
    provider: 'openrouter',
    badge: 'Auto-Failover',
    badgeColor: '#f97316',
    rpm: 20,
    rpd: 1000,
    contextWindow: '200K',
    description: 'Dynamic auto-router that automatically balances across 18+ free models',
  },
];
