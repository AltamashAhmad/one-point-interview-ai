process.env.GROQ_API_KEY = 'test';
process.env.GEMINI_API_KEY = 'test';
process.env.OPENROUTER_API_KEY = 'test';

const registry = require('../services/ai/modelRegistry');
const gateway = require('../services/ai/gateway');
const { stripThinking, createThinkingFilter } = require('../services/ai/thinking');

const groq = gateway.PROVIDERS.groq;
const gemini = gateway.PROVIDERS.gemini;
const openrouter = gateway.PROVIDERS.openrouter;

const baseArgs = { messages: [{ role: 'user', content: 'hi' }], systemPrompt: 'sys' };

beforeEach(() => {
  gateway.resetCooldowns();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  groq.generate = jest.fn();
  gemini.generate = jest.fn();
  openrouter.generate = jest.fn();
});
afterEach(() => jest.restoreAllMocks());

describe('modelRegistry', () => {
  it('maps retired model IDs to live ones', () => {
    expect(registry.resolveModelId('llama-3.1-8b-instant')).toBe('qwen/qwen3.8-27b');
    expect(registry.resolveModelId('gemini-1.5-pro')).toBe('gemini-2.5-flash');
    expect(registry.resolveModelId('made-up-model')).toBeNull();
  });

  it('only lists models whose provider key is configured', () => {
    const ids = registry.listVisibleModels({ GEMINI_API_KEY: 'x' }).map((m) => m.id);
    expect(ids).toEqual(['gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  });

  it('puts the requested model first and never repeats a model', () => {
    const chain = registry.buildChain('gemini-2.5-flash').map((m) => m.id);
    expect(chain[0]).toBe('gemini-2.5-flash');
    expect(new Set(chain).size).toBe(chain.length);
  });

  it('picks a scorecard default suited for evaluation', () => {
    expect(registry.defaultModelId('scorecard')).toBe('openai/gpt-oss-120b');
  });
});

describe('gateway.generateText', () => {
  it('returns the first successful model and strips reasoning blocks', async () => {
    groq.generate.mockResolvedValueOnce('<think>hmm</think>Hello there');
    const result = await gateway.generateText({ ...baseArgs, model: 'qwen/qwen3.8-27b' });
    expect(result).toEqual({ text: 'Hello there', model: 'qwen/qwen3.8-27b', requestedModel: 'qwen/qwen3.8-27b', fellBack: false });
  });

  it('falls back to the next model when one is decommissioned, and skips it next time', async () => {
    groq.generate
      .mockRejectedValueOnce(Object.assign(new Error('model_not_found'), { status: 404 }))
      .mockResolvedValueOnce('from gpt-oss');
    const first = await gateway.generateText({ ...baseArgs, model: 'qwen/qwen3.8-27b' });
    expect(first.model).toBe('openai/gpt-oss-120b');
    expect(first.fellBack).toBe(true);

    groq.generate.mockResolvedValueOnce('again');
    await gateway.generateText({ ...baseArgs, model: 'qwen/qwen3.8-27b' });
    expect(groq.generate).toHaveBeenLastCalledWith(expect.objectContaining({ model: 'openai/gpt-oss-120b' }));
  });

  it('treats an empty answer as a failure and moves on', async () => {
    gemini.generate.mockResolvedValueOnce('   ').mockResolvedValueOnce('ok');
    const result = await gateway.generateText({ ...baseArgs, model: 'gemini-2.5-flash' });
    expect(result.model).toBe('gemini-2.5-flash-lite');
  });

  it('throws a user-facing 503 when every model fails', async () => {
    const quota = Object.assign(new Error('429 quota'), { status: 429 });
    groq.generate.mockRejectedValue(quota);
    gemini.generate.mockRejectedValue(quota);
    openrouter.generate.mockRejectedValue(quota);
    await expect(gateway.generateText(baseArgs)).rejects.toMatchObject({ status: 503, expose: true, code: 'AI_UNAVAILABLE' });
  });

  it('streams visible tokens and hides reasoning', async () => {
    groq.generate.mockImplementationOnce(async ({ onToken }) => {
      ['<thi', 'nk>secret</th', 'ink>Hel', 'lo'].forEach(onToken);
      return '<think>secret</think>Hello';
    });
    const tokens = [];
    const result = await gateway.generateText({ ...baseArgs, onToken: (t) => tokens.push(t) });
    expect(tokens.join('')).toBe('Hello');
    expect(result.text).toBe('Hello');
  });

  it('does not fall back after tokens were already streamed', async () => {
    groq.generate.mockImplementationOnce(async ({ onToken }) => {
      onToken('partial ');
      throw Object.assign(new Error('connection reset'), { status: 500 });
    });
    await expect(gateway.generateText({ ...baseArgs, onToken: () => {} }))
      .rejects.toMatchObject({ code: 'AI_STREAM_INTERRUPTED' });
    expect(gemini.generate).not.toHaveBeenCalled();
  });

  it('stops immediately when the caller aborts', async () => {
    const controller = new AbortController();
    groq.generate.mockImplementationOnce(async () => {
      controller.abort(new Error('Client disconnected'));
      throw new Error('aborted');
    });
    await expect(gateway.generateText({ ...baseArgs, signal: controller.signal })).rejects.toThrow('Client disconnected');
    expect(gemini.generate).not.toHaveBeenCalled();
  });
});

describe('thinking helpers', () => {
  it('stripThinking removes every reasoning block', () => {
    expect(stripThinking('<think>a</think>x<think>b</think>y')).toBe('xy');
  });

  it('filter passes through text that only looks like a tag prefix', () => {
    const f = createThinkingFilter();
    expect(f.push('a <')).toBe('a ');
    expect(f.push('b')).toBe('<b');
    expect(f.flush()).toBe('');
  });
});
