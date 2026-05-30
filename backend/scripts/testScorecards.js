require('dotenv').config();
const { generateGroqResponse } = require('../services/groq');

const MODEL = 'llama-3.1-8b-instant';

// The AI's initial question to the candidate
const INITIAL_SYSTEM_MESSAGES = [
  { role: 'system', content: 'You are an interviewer...' },
  { role: 'assistant', content: `Problem: Jump Game
Given an array of integers where each element represents a non-negative integer, determine if you can reach the last index from the first index by jumping to the indices specified in the array. A jump from index i to index j is valid if i is less than j and j - i <= nums[i].
Example 1: Input: nums = [2,3,1,1,4] Output: True
Example 2: Input: nums = [3,2,1,0,4] Output: False
Constraints: The length of nums is between 1 and 2000 (inclusive). The elements in nums are non-negative integers.
Please describe your conceptual approach to solve this problem, and estimate the time and space complexity of your solution.`}
];

const SCENARIOS = [
  {
    name: "Scenario 1: Irrelevant / Little response",
    userMessages: [
      { role: 'user', content: 'lets test the scorecard this is the question' }
    ]
  },
  {
    name: "Scenario 2: Little response (Vague)",
    userMessages: [
      { role: 'user', content: 'I would probably use a loop to check the jumps.' }
    ]
  },
  {
    name: "Scenario 3: Wrong approach, no code",
    userMessages: [
      { role: 'user', content: 'I think we can solve this by just checking if there are any zeros in the array. If there is a zero, we return false. Otherwise we return true. This will be O(N) time and O(1) space.' },
      { role: 'assistant', content: 'What if the array is [2, 0, 0]? We can jump over the first zero, but not the second. Your approach would say false, but wait, [2,0,0] the first jump from 2 is up to index 2, so we reach the end.' },
      { role: 'user', content: 'Oh right, then I will sort the array first, then check.' }
    ]
  },
  {
    name: "Scenario 4: Correct approach, no code",
    userMessages: [
      { role: 'user', content: 'We can use a greedy approach. We keep track of the maximum reachable index as we iterate through the array. If at any point the current index is greater than the maximum reachable index, we know we cannot proceed further and return false. If we successfully iterate through the entire array or if our max reachable index reaches or exceeds the last index, we return true. The time complexity would be O(N) since we iterate through the array once, and space complexity would be O(1) as we only need one variable to store the max reachable index.' },
      { role: 'assistant', content: 'That sounds like a solid optimal approach. Could you please write the code for this?' },
      { role: 'user', content: 'I dont know how to write the code.' }
    ]
  },
  {
    name: "Scenario 5: Correct approach, wrong code",
    userMessages: [
      { role: 'user', content: 'We can use a greedy approach. We keep track of the maximum reachable index as we iterate through the array.' },
      { role: 'assistant', content: 'Great, can you write the code?' },
      { role: 'user', content: `
\`\`\`java
class Solution {
    public boolean canJump(int[] nums) {
        int maxReach = 0;
        for (int i = 0; i < nums.length; i++) {
            maxReach = Math.max(maxReach, i + nums[i]);
            // Forgot the check if i > maxReach
        }
        return true; // Always returning true
    }
}
\`\`\``}
    ]
  },
  {
    name: "Scenario 6: Correct approach, correct code",
    userMessages: [
      { role: 'user', content: 'I will use a greedy approach tracking the furthest we can reach. It is O(N) time.' },
      { role: 'assistant', content: 'Sounds good, please code it.' },
      { role: 'user', content: `
\`\`\`java
class Solution {
    public boolean canJump(int[] nums) {
        int maxReach = 0;
        for (int i = 0; i < nums.length; i++) {
            if (i > maxReach) {
                return false;
            }
            maxReach = Math.max(maxReach, i + nums[i]);
            if (maxReach >= nums.length - 1) {
                return true;
            }
        }
        return true;
    }
}
\`\`\``}
    ]
  },
  {
    name: "Scenario 7: Brute -> Better -> Optimal + Code",
    userMessages: [
      { role: 'user', content: 'A brute force approach would be to use recursion with memoization. From each index, we try all possible jumps from 1 to nums[i] and recursively check if any reach the end. This is O(N^2) time and O(N) space.' },
      { role: 'assistant', content: 'Good, can we do better?' },
      { role: 'user', content: 'Yes, we can optimize this to O(N) time and O(1) space using a greedy approach. We iterate from left to right and maintain a variable `maxReach` which stores the maximum index we can reach so far. If our current index `i` is greater than `maxReach`, it means we are stuck and we return false. Otherwise, we update `maxReach = Math.max(maxReach, i + nums[i])`. If `maxReach` reaches the last index, we return true.' },
      { role: 'assistant', content: 'Excellent explanation. Please implement the greedy approach.' },
      { role: 'user', content: `
\`\`\`java
class Solution {
    public boolean canJump(int[] nums) {
        int maxReach = 0;
        for (int i = 0; i < nums.length; i++) {
            if (i > maxReach) {
                return false;
            }
            maxReach = Math.max(maxReach, i + nums[i]);
        }
        return true;
    }
}
\`\`\``}
    ]
  }
];

async function generateScorecard(scenario) {
  const messages = [...INITIAL_SYSTEM_MESSAGES, ...scenario.userMessages];
  
  const userMessages = messages.filter(m => m.role === 'user');
  const totalMessages = messages.filter(m => m.role !== 'system').length;

  const transcript = messages
      .filter(m => m.role !== 'system')
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

  const systemPrompt = `You are a Principal Engineer and expert technical interviewer at a top tech company.
Your task is to evaluate the following interview transcript and generate a final scorecard.

CRITICAL SCORING RULES:
- The transcript contains ${totalMessages} total messages, of which ${userMessages.length} are from the CANDIDATE.
- Base your score ONLY on what the candidate actually said and demonstrated. Never infer or hallucinate abilities not shown in the transcript.
- If the candidate provided very few responses (1-2 messages) or only trivial/vague answers, the score MUST be between 0-25 and the verdict MUST be "No Hire".
- If the candidate attempted the problem but made significant errors or had incomplete solutions, score 25-50.
- If the candidate provided a reasonable approach with minor gaps, score 50-75.
- Only give 75+ if the candidate demonstrated strong problem-solving, clear communication, and working code.
- A candidate who never wrote code for a DSA/LLD problem cannot score above 40.
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
${transcript}`;

  const aiMessages = [
    { role: 'user', content: 'Generate the scorecard for this interview.' }
  ];

  try {
    const responseText = await generateGroqResponse(aiMessages, systemPrompt, MODEL);
    
    // Parse
    let cleanedText = responseText;
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
    }
    const scorecard = JSON.parse(cleanedText);
    return scorecard;
  } catch (err) {
    console.error('Error generating scorecard for', scenario.name, err);
    return null;
  }
}

async function runTests() {
  console.log('Starting Scorecard Tests with model:', MODEL);
  console.log('===============================================\n');

  for (const scenario of SCENARIOS) {
    console.log(`Running: ${scenario.name}...`);
    const scorecard = await generateScorecard(scenario);
    if (scorecard) {
      console.log(`Result: [${scorecard.score}/100] ${scorecard.verdict}`);
      console.log(`Strengths: ${scorecard.strengths.join(' | ')}`);
      console.log(`Weaknesses: ${scorecard.weaknesses.join(' | ')}`);
      console.log('-----------------------------------------------');
    } else {
      console.log('Result: FAILED TO GENERATE OR PARSE');
      console.log('-----------------------------------------------');
    }
    // Pause briefly to respect rate limits
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('Tests Complete.');
}

runTests();
