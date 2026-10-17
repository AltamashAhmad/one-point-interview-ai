const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

function pickApiKey(isAdmin) {
  const vipKeys = (process.env.VIP_GEMINI_API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean);
  if (isAdmin && vipKeys.length > 0) return vipKeys[crypto.randomInt(0, vipKeys.length)];
  return process.env.GEMINI_API_KEY;
}

async function generate({ messages, systemPrompt, model, isAdmin, signal, onToken, maxTokens = 2048, temperature = 0.7 }) {
  const apiKey = pickApiKey(isAdmin);
  if (!apiKey) throw Object.assign(new Error('GEMINI_API_KEY not configured'), { status: 401 });

  const genModel = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    // Thinking tokens count against maxOutputTokens; cap them so answers aren't cut short.
    generationConfig: { maxOutputTokens: maxTokens, temperature, topP: 0.9, thinkingConfig: { thinkingBudget: 512 } },
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));
  const last = messages[messages.length - 1];
  const chat = genModel.startChat({ history });

  if (!onToken) {
    const result = await chat.sendMessage(last.content, { signal });
    return result.response.text();
  }

  const result = await chat.sendMessageStream(last.content, { signal });
  let text = '';
  for await (const chunk of result.stream) {
    const delta = chunk.text();
    if (delta) {
      text += delta;
      onToken(delta);
    }
  }
  return text;
}

module.exports = { generate };
