const Groq = require('groq-sdk');

let client = null;
function getClient() {
  if (!client && process.env.GROQ_API_KEY) client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

function toChatMessages(systemPrompt, messages) {
  return [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  ];
}

async function generate({ messages, systemPrompt, model, signal, onToken, maxTokens = 2048, temperature = 0.7 }) {
  const groq = getClient();
  if (!groq) throw Object.assign(new Error('GROQ_API_KEY not configured'), { status: 401 });

  const body = {
    model,
    messages: toChatMessages(systemPrompt, messages),
    temperature,
    max_tokens: maxTokens,
    top_p: 0.9,
    stream: Boolean(onToken),
  };

  if (!onToken) {
    const completion = await groq.chat.completions.create(body, { signal });
    return completion.choices?.[0]?.message?.content || '';
  }

  const stream = await groq.chat.completions.create(body, { signal });
  let text = '';
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      text += delta;
      onToken(delta);
    }
  }
  return text;
}

module.exports = { generate };
