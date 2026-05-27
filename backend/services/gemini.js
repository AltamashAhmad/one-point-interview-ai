const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate an AI interviewer response using Gemini.
 *
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages - Full conversation history
 * @param {string} systemPrompt - The interviewer persona/instructions
 * @returns {Promise<string>} - The AI response text
 */
async function generateInterviewResponse(messages, systemPrompt) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.8,
      topP: 0.9,
    },
  });

  // Convert messages to Gemini history format (all except the last one)
  const history = messages.slice(0, -1).map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history });

  // Send the last message and get response
  const lastMessage = messages[messages.length - 1];
  const result = await chat.sendMessage(lastMessage.content);
  return result.response.text();
}

module.exports = { generateInterviewResponse };
