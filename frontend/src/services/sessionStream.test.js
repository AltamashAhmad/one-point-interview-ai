import { readEventStream, sendSessionTurn } from './api';

vi.mock('./firebase', () => ({
  appCheck: null,
  auth: { currentUser: { getIdToken: () => Promise.resolve('mock-token') } },
}));

function bodyFrom(chunks) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    getReader: () => ({
      read: async () => (i < chunks.length ? { value: encoder.encode(chunks[i++]), done: false } : { value: undefined, done: true }),
    }),
  };
}

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

describe('readEventStream', () => {
  it('parses events split across chunk boundaries', async () => {
    const full = sse('token', { text: 'Hel' }) + sse('token', { text: 'lo' }) + sse('done', { content: 'Hello' });
    const events = [];
    await readEventStream(bodyFrom([full.slice(0, 10), full.slice(10, 37), full.slice(37)]), (e, d) => events.push([e, d]));
    expect(events).toEqual([
      ['token', { text: 'Hel' }],
      ['token', { text: 'lo' }],
      ['done', { content: 'Hello' }],
    ]);
  });
});

describe('sendSessionTurn', () => {
  afterEach(() => { delete global.fetch; });

  it('streams tokens and resolves with the saved reply', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: bodyFrom([
        sse('token', { text: 'Hi' }),
        sse('done', { message: { role: 'assistant', content: 'Hi' }, model: 'qwen/qwen3.8-27b', fellBack: false, messageCount: 3 }),
      ]),
    });
    const tokens = [];
    const result = await sendSessionTurn('s1', { content: 'x', model: 'qwen/qwen3.8-27b' }, { onToken: (t) => tokens.push(t) });

    expect(tokens).toEqual(['Hi']);
    expect(result).toEqual({ message: { role: 'assistant', content: 'Hi' }, model: 'qwen/qwen3.8-27b', fellBack: false, messageCount: 3 });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/sessions\/s1\/turns$/);
    expect(init.headers.Authorization).toBe('Bearer mock-token');
    expect(JSON.parse(init.body)).toEqual({ content: 'x', model: 'qwen/qwen3.8-27b' });
  });

  it('turns an error event into an axios-shaped error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: bodyFrom([sse('error', { error: 'All AI models are busy', code: 'AI_UNAVAILABLE' })]),
    });
    await expect(sendSessionTurn('s1', { content: 'x' })).rejects.toMatchObject({
      response: { data: { code: 'AI_UNAVAILABLE' } },
    });
  });

  it('surfaces JSON errors returned before the stream opens (e.g. quota)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      body: null,
      json: async () => ({ error: 'Daily limit reached', code: 'DAILY_QUOTA_EXCEEDED' }),
    });
    await expect(sendSessionTurn('s1', { content: 'x' })).rejects.toMatchObject({
      response: { status: 403, data: { code: 'DAILY_QUOTA_EXCEEDED' } },
    });
  });
});
