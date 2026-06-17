const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

function isOpenRouterModel(model) {
  // We primarily identify via the frontend, but we can also use a string check.
  // We'll trust the provider passed from the frontend via the `chat.js` logic.
  return model && (model.includes('/') || model.includes('openrouter'));
}

async function generateOpenRouterResponse(model, systemInstruction, history) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured on the server.');
  }

  const url = 'https://openrouter.ai/api/v1/chat/completions';
  
  // Format history for OpenRouter (OpenAI-compatible format)
  const messages = [
    { role: 'system', content: systemInstruction },
    ...history.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  ];

  const response = await fetch(url, {
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
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`[OpenRouter API Error] ${response.status}:`, errorData);
    let errorMessage = 'Failed to generate response from OpenRouter.';
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
    throw new Error('No response choices returned from OpenRouter.');
  }

  return data.choices[0].message.content;
}

module.exports = {
  isOpenRouterModel,
  generateOpenRouterResponse
};
