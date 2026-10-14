const URL = 'https://openrouter.ai/api/v1/chat/completions';

// Streams are not used here: the auto-router can switch models mid-request, so we emit the final text once.
async function generate({ messages, systemPrompt, model, signal, onToken, maxTokens = 2000, temperature = 0.7 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw Object.assign(new Error('OPENROUTER_API_KEY not configured'), { status: 401 });

  const response = await fetch(URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
      'X-Title': 'One Point Interview AI',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text();
    throw Object.assign(new Error(`OpenRouter ${response.status}: ${body.slice(0, 300)}`), { status: response.status });
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (onToken && text) onToken(text);
  return text;
}

module.exports = { generate };
