/**
 * Prompts and parsing for post-interview evaluation (scorecards and revision notes).
 * Shared by the sessions API and the legacy history API.
 */

function transcriptOf(messages) {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
}

function buildScorecardPrompt(messages) {
  const userMessages = messages.filter((m) => m.role === 'user');
  const totalMessages = messages.filter((m) => m.role !== 'system').length;

  return `You are a Principal Engineer and expert technical interviewer at a top tech company.
Your task is to evaluate the following interview transcript and generate a final scorecard.

CRITICAL SCORING RULES:
- The transcript contains ${totalMessages} total messages, of which ${userMessages.length} are from the CANDIDATE.
- Base your score ONLY on what the candidate actually said and demonstrated. Never infer or hallucinate abilities not shown in the transcript.
- The passing threshold is ${PASS_SCORE}.
- NON-NEGOTIABLE RULE 1: If the candidate provided very few responses (1-2 messages) or only trivial/vague answers, the score MUST be between 0-25 and the verdict MUST be "No Hire".
- NON-NEGOTIABLE RULE 2: If the candidate NEVER wrote any actual code (in any language) for a DSA/LLD problem, the verdict MUST be "No Hire" and the score MUST NOT exceed 30.
- If the candidate attempted the problem with code but made significant errors or had incomplete solutions, score 25-49 ("No Hire").
- If the candidate provided a reasonable approach with minor gaps or partial solution, score 50-69 ("Lean Hire").
- If the candidate provided a solid approach with optimal or near-optimal working code, score 70-84 ("Hire").
- Only give 85+ ("Strong Hire") if the candidate demonstrated strong problem-solving, clear communication, and optimal, working code.
- Strengths and weaknesses MUST reflect what actually happened in the transcript. Do NOT fabricate accomplishments.

You MUST output ONLY a valid JSON object with the following exact structure, no markdown blocks:
{
  "score": <number 0-100>,
  "verdict": "<'Hire', 'Strong Hire', 'Lean Hire', or 'No Hire'>",
  "strengths": ["point 1", "point 2"],
  "weaknesses": ["point 1", "point 2"],
  "problemSolving": "<Detailed paragraph on their problem solving and technical skills>",
  "communication": "<Detailed paragraph on their communication and clarity>"
}

Transcript (${userMessages.length} candidate messages, ${totalMessages - userMessages.length} interviewer messages):
${transcriptOf(messages)}`;
}

/** Extracts the JSON object from a model reply; returns null when it isn't valid. */
function parseScorecard(text) {
  if (!text) return null;
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1) return null;
  try {
    const parsed = JSON.parse(text.slice(first, last + 1));
    if (typeof parsed.score !== 'number') return null;
    const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    let verdict = String(parsed.verdict || 'No Hire');
    // Ensure verdict is aligned with passing score threshold
    if (score < PASS_SCORE && (verdict === 'Hire' || verdict === 'Strong Hire')) {
      verdict = score >= 50 ? 'Lean Hire' : 'No Hire';
    } else if (score >= PASS_SCORE && verdict === 'No Hire') {
      verdict = 'Hire';
    }
    return {
      score,
      verdict,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
      problemSolving: String(parsed.problemSolving || ''),
      communication: String(parsed.communication || ''),
    };
  } catch {
    return null;
  }
}

function buildNotesPrompt(messages, language) {
  return `You are an expert Computer Science tutor.
Your task is to analyze the following interview transcript and generate comprehensive, personalized revision notes for the candidate in Markdown format.
These notes should be highly detailed and tailored specifically based on the candidate's conversation, reasoning, and mistakes.

${language ? `IMPORTANT: The user selected the programming language: **${language}**. All code examples, optimal solutions, and syntax must be written in **${language}**.` : ''}

The notes MUST include the following sections exactly:
### 1. Intuition & Approach
(Explain how to identify the pattern and approach the problem based on the discussion)

### 2. Brute Force
(Describe the naive approach and its Time/Space complexity)

### 3. Optimization Path
(Explain the thought process to move from brute force to optimal)

### 4. Optimal Solution
(Provide the final code and its complexity. Provide well-commented, complete code)

Format the output strictly as a Markdown document. Do not wrap the whole response in a JSON object.

Transcript:
${transcriptOf(messages)}`;
}

const PASS_SCORE = 70;

module.exports = { buildScorecardPrompt, parseScorecard, buildNotesPrompt, PASS_SCORE };
