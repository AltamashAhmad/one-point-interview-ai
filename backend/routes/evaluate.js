const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { generateInterviewResponse } = require('../services/gemini');
const { generateGroqResponse, isGroqModel } = require('../services/groq');

router.post('/generate-template', verifyToken, async (req, res) => {
  try {
    const { problemTitle, language, model } = req.body;

    if (!problemTitle || !language) {
      return res.status(400).json({ error: 'Missing problemTitle or language' });
    }

    const systemPrompt = `You are an expert ${language} coding interviewer and test engineer.
The candidate is solving the problem: "${problemTitle}".

Your task is to generate a fully runnable ${language} test script.
This script will be executed by a remote compiler (Piston) to test the candidate's code.

REQUIREMENTS:
1. The script MUST contain a placeholder exact string: {{USER_CODE}} (I will string-replace this later with their actual code).
2. The script MUST contain a main execution block that runs 3 to 5 test cases (including edge cases) specifically for "${problemTitle}".
3. The script MUST capture the results of these test cases and print them to standard output (stdout) as a STRICT JSON array of objects.
   Example JSON format: [{"testCase": "nums=[2,7,11,15], target=9", "expected": "[0,1]", "actual": "[0,1]", "passed": true}, ...]
4. Do NOT wrap the JSON output in markdown blocks or any other text when printing. Print exactly the JSON array.
5. The output of your response MUST BE ONLY the raw, runnable ${language} code. Do not include markdown formatting (like \`\`\`java) in your response, just the raw code.

Example structure for Javascript:
// --- Setup ---
{{USER_CODE}}
// --- Tests ---
const results = [];
try {
  const res1 = twoSum([2,7,11,15], 9);
  results.push({ testCase: "nums=[2,7,11,15], target=9", expected: "[0,1]", actual: JSON.stringify(res1), passed: JSON.stringify(res1) === "[0,1]" });
} catch(e) {
  results.push({ testCase: "nums=[2,7,11,15], target=9", expected: "[0,1]", actual: e.toString(), passed: false });
}
console.log(JSON.stringify(results));
`;

    const messages = [
      { role: 'user', content: `Please generate the runnable test template for ${problemTitle} in ${language}. Remember: output ONLY the raw code, no markdown block.` }
    ];

    let codeTemplate = '';
    const selectedModel = model || 'llama-3.1-8b-instant';

    if (isGroqModel(selectedModel)) {
      codeTemplate = await generateGroqResponse(messages, systemPrompt, selectedModel);
    } else {
      codeTemplate = await generateInterviewResponse(messages, systemPrompt, selectedModel);
    }

    // Clean up if the model accidentally included markdown blocks
    codeTemplate = codeTemplate.replace(/^```[a-z]*\n/gi, '').replace(/\n```$/g, '');

    res.json({ template: codeTemplate });

  } catch (error) {
    console.error('Error generating test template:', error);
    res.status(500).json({ error: 'Failed to generate test template' });
  }
});

router.post('/run', verifyToken, async (req, res) => {
  try {
    const { code, language, model } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Missing code' });
    }

    const systemPrompt = `You are a strict, ultra-fast code execution sandbox for ${language}.
I will provide you with a script that contains user code and test cases. 
Your ONLY job is to dry-run the script in your mind and output the EXACT standard output (stdout) that the script would print.
CRITICAL INSTRUCTION: DO NOT assume the user's code is correct. You must act as a literal compiler/interpreter. Mentally trace the execution of the user's code against each test case input. 
If the user's code returns incorrect values, null, throws an error, or contains infinite loops, the test MUST fail. The JSON you output MUST accurately reflect what the script would print if it were executed in reality, meaning "actual" will be the wrong value, and "passed" will be false.
The script is designed to print a JSON array of test results. You must output exactly that JSON array, and NOTHING else.
If there is a compilation error or a runtime syntax error, output a JSON object with a "compileError" field explaining the error.
DO NOT wrap the JSON in markdown blocks (no \`\`\`json). Just return the raw JSON.`;

    const messages = [
      { role: 'user', content: `Execute this code and give me the exact output:\n\n${code}` }
    ];

    let output = '';
    const selectedModel = model || 'gemini-3.1-flash-lite';

    if (isGroqModel(selectedModel)) {
      output = await generateGroqResponse(messages, systemPrompt, selectedModel);
    } else {
      output = await generateInterviewResponse(messages, systemPrompt, selectedModel);
    }

    // Clean up markdown blocks just in case
    output = output.replace(/^```[a-z]*\n/gi, '').replace(/\n```$/g, '');

    res.json({ output });

  } catch (error) {
    console.error('Error executing code:', error);
    res.status(500).json({ error: 'Failed to execute code' });
  }
});

module.exports = router;
