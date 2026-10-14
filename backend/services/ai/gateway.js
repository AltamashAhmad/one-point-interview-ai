const registry = require('./modelRegistry');
const { stripThinking, createThinkingFilter } = require('./thinking');
const { httpError } = require('../../utils/httpError');
const logger = require('../../utils/logger');

const PROVIDERS = {
  groq: require('./providers/groq'),
  gemini: require('./providers/gemini'),
  openrouter: require('./providers/openrouter'),
};

const REQUEST_TIMEOUT_MS = 90_000;
const STREAM_IDLE_TIMEOUT_MS = 45_000;

// modelId -> timestamp until which the model is skipped
const cooldowns = new Map();

function statusOf(err) {
  return err?.status || err?.statusCode || err?.response?.status;
}

/** How long to skip a model after this error. */
function cooldownFor(err) {
  const status = statusOf(err);
  const msg = (err?.message || '').toLowerCase();
  if (status === 404 || msg.includes('decommissioned') || msg.includes('does not exist') || msg.includes('not found')) {
    return 6 * 60 * 60 * 1000;
  }
  if (status === 401 || status === 403) return 60 * 60 * 1000;
  if (status === 429 || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted')) {
    return 60 * 1000;
  }
  return 20 * 1000;
}

function isCoolingDown(modelId, now = Date.now()) {
  const until = cooldowns.get(modelId);
  if (!until) return false;
  if (until <= now) {
    cooldowns.delete(modelId);
    return false;
  }
  return true;
}

function linkSignals(external, ms) {
  const controller = new AbortController();
  let timer = null;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(new Error(`AI request timed out after ${ms / 1000}s`)), ms);
  };
  const onExternalAbort = () => controller.abort(external.reason);
  if (external) {
    if (external.aborted) controller.abort(external.reason);
    else external.addEventListener('abort', onExternalAbort, { once: true });
  }
  arm();
  return {
    signal: controller.signal,
    touch: arm,
    dispose: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onExternalAbort);
    },
  };
}

/**
 * Generates a reply, trying the requested model first and falling back across providers.
 * With `onToken`, streams visible text; fallback only happens before the first token is sent.
 *
 * @returns {Promise<{ text: string, model: string, requestedModel: string|null, fellBack: boolean }>}
 */
async function generateText({
  messages,
  systemPrompt,
  model,
  purpose = 'chat',
  isAdmin = false,
  signal,
  onToken,
  maxTokens,
  temperature,
}) {
  const requestedModel = registry.resolveModelId(model);
  const chain = registry.buildChain(model, purpose);
  const candidates = chain.filter((m) => !isCoolingDown(m.id));
  const attempts = candidates.length > 0 ? candidates : chain;

  let lastError = null;
  for (const candidate of attempts) {
    if (signal?.aborted) throw signal.reason || new Error('Request aborted');

    const timeoutMs = onToken ? STREAM_IDLE_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
    const link = linkSignals(signal, timeoutMs);
    const filter = onToken ? createThinkingFilter() : null;
    let emitted = false;

    const forward = onToken
      ? (delta) => {
          link.touch();
          const visible = filter.push(delta);
          if (visible) {
            emitted = true;
            onToken(visible);
          }
        }
      : undefined;

    try {
      const raw = await PROVIDERS[candidate.provider].generate({
        messages,
        systemPrompt,
        model: candidate.id,
        isAdmin,
        signal: link.signal,
        onToken: forward,
        maxTokens,
        temperature,
      });

      if (filter) {
        const tail = filter.flush();
        if (tail) {
          emitted = true;
          onToken(tail);
        }
      }

      const text = stripThinking(raw);
      if (!text) throw Object.assign(new Error('Empty AI response'), { status: 502 });

      if (candidate.id !== attempts[0].id) {
        logger.info('AI fallback used', { from: attempts[0].id, to: candidate.id });
      }
      return { text, model: candidate.id, requestedModel, fellBack: candidate.id !== (requestedModel || attempts[0].id) };
    } catch (err) {
      if (signal?.aborted) throw signal.reason || err;
      lastError = err;
      const cooldownMs = cooldownFor(err);
      cooldowns.set(candidate.id, Date.now() + cooldownMs);
      logger.warn('AI model failed; cooling down', {
        model: candidate.id,
        status: statusOf(err),
        err: (err.message || '').slice(0, 160),
        cooldownSec: Math.round(cooldownMs / 1000),
      });
      if (emitted) {
        throw httpError(502, 'The AI stopped mid-answer. Please send your message again.', 'AI_STREAM_INTERRUPTED');
      }
    } finally {
      link.dispose();
    }
  }

  logger.error('All AI models failed', { err: lastError?.message });
  throw Object.assign(
    httpError(503, 'All AI models are busy right now. Please try again in a minute or pick another model.', 'AI_UNAVAILABLE'),
    { retryAfter: 60 }
  );
}

function modelStatus() {
  const now = Date.now();
  return registry.listVisibleModels().map((m) => ({ id: m.id, available: !isCoolingDown(m.id, now) }));
}

function resetCooldowns() {
  cooldowns.clear();
}

module.exports = { generateText, modelStatus, resetCooldowns, PROVIDERS };
