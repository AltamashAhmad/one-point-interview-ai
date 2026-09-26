const { isPrimaryModel } = require('./primaryAi');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

function isRouterModel(model) {
  if (!model || typeof model !== 'string') return false;
  // Never intercept Primary AI models (Groq)
  if (isPrimaryModel(model)) return false;
  return (
    model.startsWith('openrouter/') ||
    model.endsWith(':free') ||
    model.includes('routerAi') ||
    model === 'openrouter/free'
  );
}

async function generateRouterResponse(model, systemInstruction, history) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured on the server.');
  }

  const url = 'https://openrouter.ai/api/v1/chat/completions';
  
  // Format history for Router AI (OpenAI-compatible format)
  const messages = [
    { role: 'system', content: systemInstruction },
    ...history.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
        'X-Title': 'One Point Interview AI',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false
      }),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Router AI request timed out after 90s');
      timeoutErr.code = 'OPENROUTER_QUOTA_EXCEEDED';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`[Router AI API Error] ${response.status}:`, errorData);
    let errorMessage = 'Failed to generate response from Router AI.';
    try {
      const parsed = JSON.parse(errorData);
      if (parsed.error && parsed.error.message) {
        errorMessage = parsed.error.message;
      }
    } catch (e) {
      // ignore parse error
    }
    
    if (response.status === 402 || response.status === 429 || response.status >= 500) {
      const err = new Error('Model is currently overloaded or out of credits. Please try another model or wait a few minutes.');
      err.code = 'OPENROUTER_QUOTA_EXCEEDED';
      throw err;
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error('No response choices returned from Router AI.');
  }

  let content = data.choices[0].message?.content || '';
  // Strip reasoning blocks if returned by thinking models (e.g. DeepSeek-R1 / Qwen reasoning models)
  content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  return content;
}

module.exports = {
  isRouterModel,
  generateRouterResponse
};
